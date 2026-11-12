import { absenceSchema, type Absence, type Data } from "./domain";
import type { Identity } from "./access";
export function parseAbsenceBatch(form: FormData): Absence[] {
  const rows = form.getAll("rows").map(String);
  if (
    !rows.length ||
    rows.length > 100 ||
    new Set(rows).size !== rows.length ||
    rows.some((r) => !/^\d{1,6}$/.test(r))
  )
    throw new Error("Lote de impedimentos inválido (máximo de 100 itens).");
  const entries = rows.map((row) => {
    const get = (key: string) =>
      String(form.get(`row.${row}.${key}`) ?? "").trim();
    return absenceSchema.parse({
      id: crypto.randomUUID(),
      ministerId: String(form.get("ministerId") ?? ""),
      scope: get("scope"),
      start: get("start"),
      end: get("scope") === "DAY" ? get("start") : get("end"),
      eventId: get("eventId"),
      reason: get("reason"),
    });
  });
  const unique = new Map<string, Absence>();
  for (const entry of entries)
    unique.set(
      JSON.stringify([
        entry.ministerId,
        entry.scope,
        entry.start,
        entry.end,
        entry.eventId,
      ]),
      entry,
    );
  return [...unique.values()];
}
export function validateAbsenceSubmission(
  a: Absence,
  user: Identity,
  data: Data,
  now = new Date(),
) {
  const minister = data.ministers.find((m) => m.id === a.ministerId);
  if (
    !minister ||
    (!user.coordinator &&
      (!user.verified ||
        !minister.active ||
        minister.former ||
        minister.id !== user.ministerId))
  )
    throw new Error("Você só pode informar seus impedimentos.");
  const previous = data.absences.find((x) => x.id === a.id);
  if (previous?.revokedAt)
    throw new Error("Impedimento retirado; crie um novo registro.");
  if (previous && !user.coordinator && previous.ministerId !== user.ministerId)
    throw new Error("Impedimento de outro ministro.");
  const event =
    a.scope === "CELEBRATION"
      ? data.events.find((e) => e.id === a.eventId && e.kind !== "VISIT")
      : undefined;
  if (a.scope === "CELEBRATION" && !event)
    throw new Error("Celebração inexistente.");
  if (user.coordinator) return;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const next = new Date(Date.UTC(parts[0], parts[1], 1))
    .toISOString()
    .slice(0, 7);
  if (
    parts[2] > 25 ||
    !(event?.date ?? a.start).startsWith(next) ||
    (a.scope !== "CELEBRATION" && !a.end.startsWith(next))
  )
    throw new Error(
      "Informe impedimentos do próximo mês até o dia 25. Fora do prazo, procure a coordenação.",
    );
}
