import { z } from "zod";
const text = z.string().trim().max(2000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida",
  );
const optionalDate = z.union([date, z.literal("")]);
const address = {
  address: text,
  neighborhood: text,
  city: text,
  state: z.string().max(2),
  postalCode: z.string().max(10),
};
const base = { id: z.string().uuid() };
export const ministerSchema = z
  .object({
    ...base,
    name: text.min(3),
    email: z.union([z.email(), z.literal("")]),
    birthDate: optionalDate,
    phone: text,
    ministryStart: optionalDate,
    ...address,
    active: z.boolean(),
    away: z.boolean(),
    monthlyLimit: z.number().int().min(1).max(100),
    spouseId: z.union([z.string().uuid(), z.literal("")]),
    couplePreference: z.enum(["TOGETHER", "SEPARATE", "NONE"]),
    location: text,
    locationPreference: z.enum(["ACCEPT", "PREFER", "EXCLUSIVE"]),
    notes: text,
  })
  .refine((v) => v.id !== v.spouseId, "O cônjuge deve ser outra pessoa");
export const assistedSchema = z.object({
  ...base,
  name: text.min(3),
  ...address,
  landline: text,
  mobile: text,
  familyName: text,
  familyPhone: text,
  notes: text,
  active: z.boolean(),
});
export const eventSchema = z
  .object({
    ...base,
    title: text.min(3),
    date,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration: z.number().int().min(15).max(1440),
    kind: z.enum(["MASS", "ADORATION", "WEDDING", "SPECIAL", "VISIT"]),
    location: text.min(1),
    required: z.number().int().min(1).max(100),
    assistedId: z.union([z.string().uuid(), z.literal("")]),
    notes: text,
  })
  .superRefine((v, ctx) => {
    if (
      v.kind === "VISIT" &&
      (new Date(v.date + "T12:00:00Z").getUTCDay() !== 0 || !v.assistedId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Visita exige domingo e assistido",
      });
  });
export const absenceSchema = z
  .object({
    ...base,
    ministerId: z.string().uuid(),
    scope: z.enum(["DAY", "PERIOD", "CELEBRATION"]),
    start: optionalDate,
    end: optionalDate,
    eventId: z.union([z.string().uuid(), z.literal("")]),
    reason: text,
  })
  .superRefine((v, ctx) => {
    if (
      v.scope === "CELEBRATION"
        ? !v.eventId
        : !v.start ||
          !v.end ||
          v.start > v.end ||
          (v.scope === "DAY" && v.start !== v.end)
    )
      ctx.addIssue({
        code: "custom",
        message: "Informe a celebração ou um intervalo válido",
      });
  });
export type Minister = z.infer<typeof ministerSchema>;
export type Assisted = z.infer<typeof assistedSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Absence = z.infer<typeof absenceSchema>;
export type Assignment = { eventId: string; ministerId: string };
export type Schedule = {
  id: string;
  month: string;
  status: "DRAFT" | "APPROVED" | "PUBLISHED";
  revision: number;
  editVersion?: number;
  assignments: Assignment[];
  events: Event[];
  ministers: Pick<Minister, "id" | "name">[];
  warnings: string[];
  approvedBy?: string;
  approvedAt?: string;
};
export type Data = {
  ministers: Minister[];
  assisted: Assisted[];
  events: Event[];
  absences: Absence[];
  schedules: Schedule[];
};
export type Kind = "minister" | "assisted" | "event" | "absence" | "schedule";
export const kinds = [
  "minister",
  "assisted",
  "event",
  "absence",
  "schedule",
] as const;
export const emptyData = (): Data => ({
  ministers: [],
  assisted: [],
  events: [],
  absences: [],
  schedules: [],
});
export function overlaps(a: Event, b: Event) {
  const start = (e: Event) => Date.parse(e.date + "T" + e.time + ":00Z");
  return (
    start(a) < start(b) + b.duration * 60000 &&
    start(b) < start(a) + a.duration * 60000
  );
}
export function blocked(
  m: Minister,
  e: Event,
  data: Data,
  assignments: Assignment[],
  events: Event[],
) {
  if (!m.active || m.away) return "Ministro inativo ou afastado";
  if (m.locationPreference === "EXCLUSIVE" && m.location !== e.location)
    return "Local fora da preferência exclusiva";
  if (
    data.absences.some(
      (a) =>
        a.ministerId === m.id &&
        (a.scope === "CELEBRATION"
          ? a.eventId === e.id
          : a.start <= e.date && a.end >= e.date),
    )
  )
    return "Impedimento informado";
  const own = assignments.filter((a) => a.ministerId === m.id);
  if (own.some((a) => a.eventId === e.id)) return "Ministro já alocado";
  const ownEvents = own
    .map((a) => events.find((x) => x.id === a.eventId))
    .filter((v): v is Event => !!v);
  if (ownEvents.some((x) => overlaps(x, e))) return "Conflito de horário";
  if (
    ownEvents.filter((x) => x.date.slice(0, 7) === e.date.slice(0, 7)).length >=
    m.monthlyLimit
  )
    return "Limite mensal atingido";
  return "";
}
export function generate(data: Data, month: string): Schedule {
  const events = data.events
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) =>
      (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id),
    );
  const assignments: Assignment[] = [];
  const warnings: string[] = [];
  const cutoff = new Date(month + "-01T12:00:00Z");
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const published = data.schedules
    .filter(
      (s) =>
        s.status === "PUBLISHED" &&
        s.month < month &&
        s.month >= cutoff.toISOString().slice(0, 7),
    )
    .filter(
      (s) =>
        !data.schedules.some(
          (other) =>
            other.month === s.month &&
            other.status === "PUBLISHED" &&
            other.revision > s.revision,
        ),
    );
  const history = (id: string, visit: boolean) =>
    published.reduce(
      (total, s) =>
        total +
        s.assignments.filter(
          (a) =>
            a.ministerId === id &&
            (s.events.find((e) => e.id === a.eventId)?.kind === "VISIT") ===
              visit,
        ).length,
      0,
    );
  const nearby = (m: Minister, e: Event) =>
    e.kind === "VISIT" &&
    !!m.neighborhood &&
    data.assisted.some(
      (a) =>
        a.id === e.assistedId &&
        a.neighborhood.toLowerCase() === m.neighborhood.toLowerCase(),
    );
  const preferred = (m: Minister, e: Event) =>
    m.locationPreference === "PREFER" && m.location === e.location;

  const count = (id: string, visit: boolean) =>
    assignments.filter(
      (a) =>
        a.ministerId === id &&
        (events.find((e) => e.id === a.eventId)?.kind === "VISIT") === visit,
    ).length;
  for (const e of events) {
    while (assignments.filter((a) => a.eventId === e.id).length < e.required) {
      const candidates = data.ministers
        .filter((m) => !blocked(m, e, data, assignments, events))
        .sort(
          (a, b) =>
            count(a.id, e.kind === "VISIT") +
              history(a.id, e.kind === "VISIT") -
              (count(b.id, e.kind === "VISIT") +
                history(b.id, e.kind === "VISIT")) ||
            count(a.id, e.kind === "VISIT") - count(b.id, e.kind === "VISIT") ||
            Number(preferred(b, e)) - Number(preferred(a, e)) ||
            Number(nearby(b, e)) - Number(nearby(a, e)) ||
            a.id.localeCompare(b.id),
        );
      let allocated = false;
      for (const m of candidates) {
        const spouse = data.ministers.find((s) => s.id === m.spouseId);
        const pair =
          spouse &&
          (m.couplePreference === "TOGETHER" ||
            spouse.couplePreference === "TOGETHER")
            ? [m, spouse]
            : [m];
        if (
          pair.length >
            e.required - assignments.filter((a) => a.eventId === e.id).length ||
          pair.some((p) => blocked(p, e, data, assignments, events))
        )
          continue;
        if (
          spouse &&
          (m.couplePreference === "SEPARATE" ||
            spouse.couplePreference === "SEPARATE") &&
          assignments.some(
            (a) => a.eventId === e.id && a.ministerId === spouse.id,
          )
        )
          continue;
        pair.forEach((p) =>
          assignments.push({ eventId: e.id, ministerId: p.id }),
        );
        allocated = true;
        break;
      }
      if (!allocated) {
        warnings.push(
          `${e.date} ${e.time} • ${e.title}: vagas sem ministros elegíveis.`,
        );
        break;
      }
    }
  }
  return {
    id: crypto.randomUUID(),
    month,
    status: "DRAFT",
    revision: 1,
    assignments,
    events,
    ministers: data.ministers.map(({ id, name }) => ({ id, name })),
    warnings,
  };
}
export function validateSchedule(s: Schedule, data: Data): string[] {
  const errors: string[] = [];
  const checked: Assignment[] = [];
  for (const e of s.events) {
    if (s.assignments.filter((a) => a.eventId === e.id).length !== e.required)
      errors.push(
        `${e.title}: quantidade de ministros diferente da necessária.`,
      );
    try {
      eventSchema.parse(e);
    } catch {
      errors.push(`${e.title}: evento inválido.`);
    }
  }
  for (const a of s.assignments) {
    const m = data.ministers.find((m) => m.id === a.ministerId);
    const e = s.events.find((e) => e.id === a.eventId);
    if (!m || !e) {
      errors.push("Designação sem ministro ou evento.");
      continue;
    }
    const reason = blocked(m, e, data, checked, s.events);
    if (reason) errors.push(`${m.name}: ${reason}.`);
    const spouse = data.ministers.find((x) => x.id === m.spouseId);
    if (spouse) {
      const together = s.assignments.some(
        (x) => x.eventId === e.id && x.ministerId === spouse.id,
      );
      if (
        (m.couplePreference === "TOGETHER" ||
          spouse.couplePreference === "TOGETHER") &&
        !together
      )
        errors.push(`${m.name}: casal deve servir junto.`);
      if (
        (m.couplePreference === "SEPARATE" ||
          spouse.couplePreference === "SEPARATE") &&
        together
      )
        errors.push(`${m.name}: casal prefere servir separado.`);
    }
    checked.push(a);
  }
  return [...new Set(errors)];
}
