import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { pool, transaction, write, audit } from "../src/lib/store";
import {
  ministerSchema,
  assistedSchema,
  eventSchema,
  absenceSchema,
  emptyData,
  defaultSettings,
  generate,
  validateSchedule,
  type Data,
} from "../src/lib/domain";
import { schedulePdf, visitGuidePdf } from "../src/lib/pdf";
import { operationalReport } from "../src/lib/reports";

export const seedMarker = "MESCE-E2E-2026-v1";
function id(label: string) {
  const hex = createHash("sha256")
    .update(`${seedMarker}:${label}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function fixture(): Data {
  const data = emptyData();
  data.settings = { ...defaultSettings };
  data.responses = [];
  const address = {
    address: "Rua Fictícia, 100 — TESTE",
    neighborhood: "Bairro Teste",
    city: "Cidade Fictícia",
    state: "DF",
    postalCode: "",
  };
  data.ministers = Array.from({ length: 18 }, (_, i) =>
    ministerSchema.parse({
      id: id(`minister:${i}`),
      name: `TESTE Ministro ${String(i + 1).padStart(2, "0")}`,
      email: `ministro${i + 1}@example.invalid`,
      birthDate: "1980-01-01",
      phone: "",
      ministryStart: "2025-01-01",
      ...address,
      active: i !== 16,
      away: i === 17,
      registrationStatus: "COMPLETE",
      servicePreference:
        i === 14 ? "CELEBRATIONS" : i === 15 ? "VISITS" : "BOTH",
      monthlyLimit: null,
      spouseId: i === 0 ? id("minister:1") : i === 1 ? id("minister:0") : "",
      couplePreference: i < 2 ? "TOGETHER" : "NONE",
      location: "Matriz TESTE",
      locationPreference: "ACCEPT",
      notes: seedMarker,
    }),
  );
  data.assisted = Array.from({ length: 3 }, (_, i) =>
    assistedSchema.parse({
      id: id(`assisted:${i}`),
      name: i === 2 ? "TESTE Instituição coletiva" : `TESTE Assistido ${i + 1}`,
      ...address,
      landline: "",
      mobile: "",
      familyName: `TESTE Responsável ${i + 1}`,
      familyPhone: "",
      ministersRequired: i === 2 ? 3 : 1,
      active: true,
      notes: seedMarker,
    }),
  );
  for (const month of ["2026-10", "2026-11", "2026-12"]) {
    for (const minister of data.ministers)
      data.responses.push({
        id: id(`response:${month}:${minister.id}`),
        ministerId: minister.id,
        month,
        submittedAt: `${month}-01T12:00:00Z`,
      });
    for (let day = 1; day <= 31; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const parsed = new Date(`${date}T12:00:00Z`);
      if (
        parsed.toISOString().slice(0, 10) !== date ||
        parsed.getUTCDay() !== 0
      )
        continue;
      for (let slot = 0; slot < 5; slot++)
        data.events.push(
          eventSchema.parse({
            id: id(`event:${date}:${slot}`),
            title:
              slot < 2
                ? `TESTE Missa ${slot === 0 ? "matutina" : "vespertina"}`
                : `TESTE Visita ${slot - 1}`,
            date,
            time: ["08:00", "18:00", "10:00", "10:00", "10:00"][slot],
            duration: 60,
            kind: slot < 2 ? "MASS" : "VISIT",
            location: slot < 2 ? "Matriz TESTE" : "Local fictício TESTE",
            required: slot === 4 ? 3 : slot < 2 ? 2 : 1,
            assistedId: slot < 2 ? "" : data.assisted[slot - 2].id,
            visitSite: slot === 4 ? "ALTEVITA" : "HOME",
            notes: seedMarker,
          }),
        );
    }
    const events = data.events.filter((e) => e.date.startsWith(month));
    data.absences.push(
      absenceSchema.parse({
        id: id(`absence:${month}`),
        ministerId: data.ministers[2].id,
        scope: "DAY",
        start: events[0].date,
        end: events[0].date,
        eventId: "",
        reason: `${seedMarker} — indisponibilidade fictícia`,
      }),
    );
    if (month !== "2026-12") {
      const schedule = generate(data, month);
      schedule.id = id(`schedule:${month}`);
      schedule.status = "PUBLISHED";
      schedule.assistedSnapshot = data.assisted.map((a) => ({ ...a }));
      schedule.approvedBy = "seed:synthetic";
      schedule.approvedAt = `${month}-01T12:00:00Z`;
      const errors = validateSchedule(schedule, data);
      if (errors.length || schedule.warnings.length)
        throw new Error("Fixture não cobre integralmente a escala.");
      data.schedules.push(schedule);
    }
  }
  return data;
}

async function main() {
  try {
    const expectedHost =
      "ep-little-darkness-b68gy9au.c-2.sa-east-1.aws.neon.tech";
    const connection = process.env.MESCE_DATABASE_URL;
    if (
      process.env.VERCEL_ENV !== "preview" ||
      !connection ||
      new URL(connection).hostname.replace("-pooler.", ".") !== expectedHost
    )
      throw new Error("Carga restrita ao banco confirmado de homologação.");
    const seed = fixture();
    // Verify the actual report renderers before any database writes.
    for (const schedule of seed.schedules) {
      await schedulePdf(schedule);
      await visitGuidePdf(schedule);
    }
    const summary = await transaction(async (client, existing) => {
      const role = await client.query("SELECT current_user AS name");
      if (role.rows[0].name !== "mesce_mvp_runtime")
        throw new Error("Papel de homologação inesperado.");
      let inserted = 0,
        skipped = 0;
      for (const [kind, records, current] of [
        ["minister", seed.ministers, existing.ministers],
        ["assisted", seed.assisted, existing.assisted],
        ["event", seed.events, existing.events],
        ["absence", seed.absences, existing.absences],
        ["schedule", seed.schedules, existing.schedules],
        ["response", seed.responses!, existing.responses ?? []],
      ] as const)
        for (const record of records) {
          if (current.some((r) => r.id === record.id)) {
            skipped++;
            continue;
          }
          // Preserve all pre-existing versions, including any client-generated revisions.
          if (
            kind === "schedule" &&
            existing.schedules.some(
              (s) =>
                s.month === (record as (typeof seed.schedules)[number]).month,
            )
          ) {
            skipped++;
            continue;
          }
          await write(client, kind, record);
          inserted++;
        }
      await audit(client, "seed:synthetic", "seed:e2e", undefined, {
        marker: seedMarker,
        inserted,
        skipped,
      });
      return { inserted, skipped };
    });
    const report = operationalReport(seed, "2026-11", 12);
    console.log(
      "MESCE_E2E_SEED_OK",
      JSON.stringify({
        ...summary,
        ministers: seed.ministers.length,
        assisted: seed.assisted.length,
        events: seed.events.length,
        absences: seed.absences.length,
        publishedSchedules: seed.schedules.length,
        participations: report.entries.length,
        clientFlowMonth: "2026-12",
      }),
    );
  } catch {
    // Database errors can contain encrypted values or connection details.
    console.error(
      "MESCE_E2E_SEED_FAILED: nenhuma carga parcial; verificar isolamento, chave e meses históricos.",
    );
    process.exitCode = 1;
  } finally {
    await pool().end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
