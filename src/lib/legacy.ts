import { createDecipheriv } from "node:crypto";
import type { PoolClient } from "pg";
import { write, audit } from "./store";
import { blankMinister } from "./profile";
import { Assisted, Event } from "./domain";
export function openLegacy(value: unknown): string {
  if (!value) return "";
  const key = process.env.MESCE_DATA_KEY_HEX;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Chave de proteção inválida.");
  const raw = Buffer.from(String(value), "base64");
  if (raw.length < 28) throw new Error("Formato cifrado legado inválido.");
  try {
    const cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      raw.subarray(0, 12),
    );
    cipher.setAuthTag(raw.subarray(-16));
    return Buffer.concat([
      cipher.update(raw.subarray(12, -16)),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "A chave deste ambiente não decifra o legado. Migração revertida; preserve a chave original.",
    );
  }
}
const ymd = (value: unknown) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value
      ? String(value).slice(0, 10)
      : "";
export async function importLegacy(client: PoolClient, by: string) {
  const table = await client.query(
    "SELECT to_regclass('mesce_dev.ministers') AS name",
  );
  if (!table.rows[0]?.name) return { ministers: 0, assisted: 0, events: 0 };
  // Never discard domains that have no mapped legacy representation yet.
  for (const name of ["schedule_assignments", "impediments", "visits"]) {
    const exists = await client.query("SELECT to_regclass($1) AS name", [
      "mesce_dev." + name,
    ]);
    if (exists.rows[0]?.name) {
      const count = await client.query(
        `SELECT count(*)::int AS total FROM mesce_dev.${name}`,
      );
      if (count.rows[0].total > 0)
        throw new Error(
          "Legado contém escalas, visitas ou impedimentos que exigem migração específica. Nenhum dado foi alterado.",
        );
    }
  }
  const ministers = await client.query(
    "SELECT m.*,a.auth0_sub,a.role,a.active AS actor_active FROM mesce_dev.ministers m LEFT JOIN mesce_dev.actors a ON a.id=m.actor_id",
  );
  const count = { ministers: 0, assisted: 0, events: 0 };
  const already = async (id: string) =>
    (await client.query("SELECT 1 FROM mesce_records WHERE id=$1", [id]))
      .rowCount;
  for (const row of ministers.rows) {
    if (await already(row.id)) continue;
    const details = row.details_ciphertext
      ? JSON.parse(openLegacy(row.details_ciphertext))
      : {};
    const minister = {
      ...blankMinister(row.id, details.email ?? ""),
      name: openLegacy(row.name_ciphertext),
      phone: openLegacy(row.phone_ciphertext),
      ministryStart: ymd(row.started_on),
      birthDate: ymd(row.birth_date) || details.birthDate || "",
      monthlyLimit: row.monthly_limit ?? null,
      active: row.active && row.actor_active !== false,
      address: details.address ?? "",
      neighborhood: details.neighborhood ?? "",
      city: details.city ?? "",
      state: details.state ?? "",
      postalCode: details.postalCode ?? "",
      notes: details.notes ?? "",
    };
    await write(client, "minister", minister);
    if (row.auth0_sub)
      await client.query(
        "INSERT INTO mesce_access(id,auth0_sub,minister_id,status,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(auth0_sub) DO NOTHING",
        [
          crypto.randomUUID(),
          row.auth0_sub,
          row.id,
          minister.active ? "ACTIVE" : "REVOKED",
          row.role,
        ],
      );
    count.ministers++;
  }
  const assisted = await client.query(
    "SELECT * FROM mesce_dev.assisted_people",
  );
  for (const row of assisted.rows) {
    if (await already(row.id)) continue;
    const person: Assisted = {
      id: row.id,
      name: openLegacy(row.name_ciphertext),
      address: openLegacy(row.address_ciphertext),
      neighborhood: "",
      city: "",
      state: "",
      postalCode: "",
      landline: "",
      mobile: openLegacy(row.phone_ciphertext),
      familyName: openLegacy(row.family_contact_ciphertext),
      familyPhone: "",
      notes: "",
      active: row.active,
    };
    await write(client, "assisted", person);
    count.assisted++;
  }
  const celebrations = await client.query(
    "SELECT *,occurs_on::text AS day,starts_at::text AS clock FROM mesce_dev.celebrations",
  );
  for (const row of celebrations.rows) {
    if (await already(row.id)) continue;
    const kinds: Record<string, Event["kind"]> = {
      MASS: "MASS",
      MISSA: "MASS",
      ADORATION: "ADORATION",
      ADORACAO: "ADORATION",
      WEDDING: "WEDDING",
      CASAMENTO: "WEDDING",
      SPECIAL: "SPECIAL",
    };
    const event: Event = {
      id: row.id,
      title: "Celebração migrada",
      date: row.day,
      time: row.clock.slice(0, 5),
      duration: 60,
      kind: kinds[String(row.kind).toUpperCase()] ?? "SPECIAL",
      location: row.location_code,
      required: row.required_ministers,
      assistedId: "",
      notes: row.notes ?? "",
    };
    await write(client, "event", event);
    count.events++;
  }
  await audit(client, by, "legacy:import", undefined, count);
  return count;
}
