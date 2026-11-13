import { encrypt } from "./crypto";
import { audit } from "./store";
import { defaultSettings } from "./domain";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Data, Event } from "./domain";
import { locationCatalog } from "./locations";
import { locationKey } from "./location-rules";
export const removalKinds = [
  "minister",
  "assisted",
  "event",
  "absence",
  "schedule",
  "location",
] as const;
export type RemovalKind = (typeof removalKinds)[number];
export const removalPages: Record<RemovalKind, string> = {
  minister: "ministros",
  assisted: "assistidos",
  event: "celebracoes",
  absence: "impedimentos",
  schedule: "escalas",
  location: "locais",
};
export function recordVersion(record: unknown) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
const visitHas = (e: Event, id: string) =>
  e.assistedId === id ||
  (e as Event & { assistedIds?: string[] }).assistedIds?.includes(id);
export function planRecordRemoval(form: FormData, data: Data) {
  const kind = z.enum(removalKinds).parse(form.get("kind"));
  const id = z.string().uuid().parse(form.get("id"));
  if (form.get("confirm") !== "yes")
    throw new Error("Confirme a exclusão do cadastro incorreto.");
  const reason = z
    .string()
    .trim()
    .min(3, "Informe o motivo da exclusão.")
    .max(2000)
    .parse(form.get("reason"));
  const collections = {
    minister: data.ministers,
    assisted: data.assisted,
    event: data.events,
    absence: data.absences,
    schedule: data.schedules,
    location: locationCatalog(data),
  };
  const before = collections[kind].find((r) => r.id === id);
  if (!before)
    throw new Error("Registro inexistente ou já excluído. Atualize a página.");
  if (form.get("expectedVersion") !== recordVersion(before))
    throw new Error(
      "O registro foi alterado. Reabra a página antes de excluir.",
    );
  const events = data.schedules.flatMap((s) => [
    ...s.events,
    ...(s.agendaEvents ?? []),
  ]);
  let linked = false;
  if (kind === "event")
    linked =
      events.some((e) => e.id === id) ||
      data.absences.some((a) => a.eventId === id);
  if (kind === "assisted")
    linked =
      [...data.events, ...events].some((e) => visitHas(e, id)) ||
      data.schedules.some((s) => s.assistedSnapshot?.some((a) => a.id === id));
  if (kind === "minister")
    linked =
      data.absences.some((a) => a.ministerId === id) ||
      !!data.responses?.some((r) => r.ministerId === id) ||
      data.ministers.some((m) => m.spouseId === id) ||
      data.schedules.some(
        (s) =>
          s.ministers.some((m) => m.id === id) ||
          s.assignments.some((a) => a.ministerId === id),
      );
  if (kind === "absence") {
    const a = data.absences.find((a) => a.id === id)!;
    linked = data.schedules.some(
      (s) =>
        s.assignments.some((m) => m.ministerId === a.ministerId) &&
        (a.scope === "CELEBRATION"
          ? s.events.some((e) => e.id === a.eventId)
          : s.events.some((e) => e.date >= a.start && e.date <= a.end)),
    );
  }
  if (kind === "schedule")
    linked = !["DRAFT", "IN_REVIEW"].includes(
      data.schedules.find((s) => s.id === id)!.status,
    );
  if (kind === "location") {
    const l = locationCatalog(data).find((l) => l.id === id)!;
    linked =
      [...data.events, ...events].some(
        (e) =>
          e.kind !== "VISIT" &&
          (e.locationId === id ||
            locationKey(e.location) === locationKey(l.name)),
      ) ||
      data.ministers.some(
        (m) =>
          m.locationIds?.includes(id) ||
          (!m.locationIds?.length &&
            locationKey(m.location) === locationKey(l.name)),
      );
  }
  if (linked)
    throw new Error(
      "Este registro possui vínculos ou histórico e não pode ser excluído. Corrija os dados, inative o cadastro ou use cancelar/retirar. Para eventos de uma escala em preparação, corrija ou exclua primeiro o rascunho.",
    );
  return { kind, id, reason, before };
}

export function removalSeries(anchor: Event, events: Event[]) {
  return anchor.seriesId
    ? events
        .filter(
          (e) =>
            e.seriesId === anchor.seriesId &&
            e.date + e.time >= anchor.date + anchor.time,
        )
        .sort((a, b) => a.id.localeCompare(b.id))
    : [anchor];
}
export async function executeRecordRemoval(
  client: import("pg").PoolClient,
  data: Data,
  user: import("./access").Identity,
  form: FormData,
) {
  if (!user.coordinator) throw new Error("Acesso exclusivo da coordenação.");
  const plan = planRecordRemoval(form, data);
  if (plan.kind === "event" && form.get("removalScope") === "FOLLOWING") {
    const targets = removalSeries(
      data.events.find((e) => e.id === plan.id)!,
      data.events,
    );
    if (form.get("expectedSeries") !== recordVersion(targets))
      throw new Error(
        "A série foi alterada. Reabra a página antes de excluir.",
      );
    const forms = targets.map((event) => {
      const f = new FormData();
      for (const [key, value] of form.entries()) f.append(key, value);
      f.set("id", event.id);
      f.set("expectedVersion", recordVersion(event));
      f.set("removalScope", "ONE");
      return f;
    });
    // Validate the whole batch before deleting the first record.
    for (const f of forms) planRecordRemoval(f, data);
    for (const f of forms) await executeRecordRemoval(client, data, user, f);
    return plan;
  }

  if (plan.kind === "minister") {
    const access = await client.query(
      "SELECT id FROM mesce_access WHERE minister_id=$1",
      [plan.id],
    );
    if (access.rows.length)
      throw new Error(
        "Este ministro possui pré-cadastro ou acesso. Revogue o acesso e inative o cadastro para preservar os vínculos.",
      );
  }
  if (plan.kind === "location") {
    await client.query(
      "INSERT INTO mesce_settings(id,payload) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
      [
        encrypt({
          ...defaultSettings,
          ...data.settings,
          locations: locationCatalog(data).filter((l) => l.id !== plan.id),
        }),
      ],
    );
  } else {
    await client.query("DELETE FROM mesce_records WHERE id=$1 AND kind=$2", [
      plan.id,
      plan.kind,
    ]);
  }
  await audit(client, user.id, `${plan.kind}:delete`, plan.id, {
    before: plan.before,
    reason: plan.reason,
  });

  return plan;
}
