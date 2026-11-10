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
    monthlyLimit: z.number().int().min(1).max(100).nullable(),
    former: z.boolean().optional(),
    registrationStatus: z.enum(["DRAFT", "COMPLETE"]).optional(),
    servicePreference: z.enum(["BOTH", "CELEBRATIONS", "VISITS"]).optional(),
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
    visitSite: z.enum(["HOME", "ALTEVITA"]).optional(),
    assistedId: z.union([z.string().uuid(), z.literal("")]),
    notes: text,
    cancelled: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (
      v.kind === "VISIT" &&
      v.visitSite &&
      (v.visitSite === "ALTEVITA" ? v.required < 3 : v.required !== 1)
    )
      ctx.addIssue({
        code: "custom",
        message: "Visita comum exige 1 ministro; Altevita exige pelo menos 3.",
      });
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
export type Assignment = {
  eventId: string;
  ministerId: string;
  origin?: "AUTO" | "MANUAL";
};
export type Schedule = {
  id: string;
  month: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "CANCELLED";
  revision: number;
  editVersion?: number;
  assignments: Assignment[];
  events: Event[];
  agendaEvents?: Event[];
  algorithmVersion?: string;
  ministers: Pick<Minister, "id" | "name">[];
  warnings: string[];
  assistedSnapshot?: Assisted[];
  approvedBy?: string;
  approvedAt?: string;
};
export type Data = {
  ministers: Minister[];
  assisted: Assisted[];
  events: Event[];
  absences: Absence[];
  schedules: Schedule[];
  responses?: MonthlyResponse[];
  settings?: Settings;
};
export type Settings = {
  unansweredPolicy: "REVIEW" | "ELIGIBLE";
  monthlyLimit: number | null;
  historyMonths: number;
};
export const defaultSettings: Settings = {
  unansweredPolicy: "REVIEW",
  monthlyLimit: null,
  historyMonths: 12,
};
export type MonthlyResponse = {
  id: string;
  ministerId: string;
  month: string;
  submittedAt: string;
};
export type Kind =
  "minister" | "assisted" | "event" | "absence" | "schedule" | "response";
export const kinds = [
  "minister",
  "assisted",
  "event",
  "absence",
  "schedule",
  "response",
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
  if (
    data.settings?.unansweredPolicy === "REVIEW" &&
    !data.responses?.some(
      (r) => r.ministerId === m.id && r.month === e.date.slice(0, 7),
    )
  )
    return "Resposta mensal pendente de consolidação";
  if (e.cancelled) return "Evento cancelado";
  if (m.former) return "Ex-ministro";
  if (m.registrationStatus === "DRAFT") return "Cadastro pendente";
  if (!m.active || m.away) return "Ministro inativo ou afastado";
  if (
    (m.servicePreference === "VISITS" && e.kind !== "VISIT") ||
    (m.servicePreference === "CELEBRATIONS" && e.kind === "VISIT")
  )
    return "Atividade fora da preferência de serviço";
  if (
    e.kind !== "VISIT" &&
    m.locationPreference === "EXCLUSIVE" &&
    m.location !== e.location
  )
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
  const outside = latestPublished(data)
    .filter((s) => s.month !== e.date.slice(0, 7))
    .flatMap((s) =>
      s.assignments
        .filter((a) => a.ministerId === m.id)
        .map((a) => s.events.find((x) => x.id === a.eventId)),
    )
    .filter((x): x is Event => !!x && !x.cancelled);
  if ([...ownEvents, ...outside].some((x) => overlaps(x, e)))
    return "Conflito de horário";
  if (
    m.monthlyLimit != null &&
    ownEvents.filter((x) => x.date.slice(0, 7) === e.date.slice(0, 7)).length >=
      m.monthlyLimit
  )
    return "Limite mensal atingido";
  return "";
}
export function eventInstant(e: Pick<Event, "date" | "time">) {
  return Date.parse(e.date + "T" + e.time + ":00-03:00");
}
export function requireFuture(
  e: Pick<Event, "date" | "time">,
  now = Date.now(),
) {
  if (!Number.isFinite(eventInstant(e)) || eventInstant(e) <= now)
    throw new Error("Agende uma data e horário futuros (horário de Brasília).");
}
export function latestPublished(data: Data) {
  return data.schedules.filter(
    (s) =>
      s.status === "PUBLISHED" &&
      !data.schedules.some(
        (other) =>
          ["PUBLISHED", "CANCELLED"].includes(other.status) &&
          other.month === s.month &&
          other.revision > s.revision,
      ),
  );
}
const agenda = (data: Data, month: string) =>
  data.events
    .filter((e) => e.date.startsWith(month) && !e.cancelled)
    .sort((a, b) =>
      (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id),
    );
const fingerprint = (events: Event[]) =>
  JSON.stringify(
    events
      .map((e) =>
        Object.fromEntries(
          Object.entries(e).sort(([a], [b]) => a.localeCompare(b)),
        ),
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
  );
export function agendaChanged(s: Schedule, data: Data) {
  return (
    fingerprint(s.agendaEvents ?? s.events) !==
    fingerprint(agenda(data, s.month))
  );
}
export function syncSchedule(s: Schedule, data: Data): Schedule {
  const current = agenda(data, s.month);
  const events = current.map((e) => {
    const before = (s.agendaEvents ?? s.events).find((x) => x.id === e.id),
      effective = s.events.find((x) => x.id === e.id);
    return {
      ...e,
      required:
        before && effective && before.required === e.required
          ? effective.required
          : e.required,
    };
  });
  return {
    ...s,
    events,
    agendaEvents: current.map((e) => ({ ...e })),
    assignments: s.assignments.filter((a) =>
      events.some((e) => e.id === a.eventId),
    ),
    warnings: [],
  };
}
export function generate(data: Data, month: string): Schedule {
  const events = agenda(data, month);
  let assignments: Assignment[] = [];
  const warnings: string[] = [];
  const cutoff = new Date(month + "-01T12:00:00Z");
  cutoff.setUTCMonth(
    cutoff.getUTCMonth() - (data.settings?.historyMonths ?? 12),
  );
  const past = latestPublished(data).filter(
    (s) => s.month < month && s.month >= cutoff.toISOString().slice(0, 7),
  );
  const historical = (id: string, visit: boolean) =>
    past.reduce(
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
  function groups(e: Event, used: Assignment[]) {
    const count = (m: Minister) =>
      used.filter(
        (a) =>
          a.ministerId === m.id &&
          (events.find((x) => x.id === a.eventId)?.kind === "VISIT") ===
            (e.kind === "VISIT"),
      ).length;
    const consecutive = (m: Minister) =>
      used
        .filter((a) => a.ministerId === m.id)
        .some((a) => {
          const x = events.find((x) => x.id === a.eventId);
          return (
            x && Math.abs(Date.parse(x.date) - Date.parse(e.date)) <= 86400000
          );
        });
    const nearby = (m: Minister) =>
      e.kind === "VISIT" &&
      !!m.neighborhood &&
      data.assisted.some(
        (a) =>
          a.id === e.assistedId &&
          a.neighborhood.toLowerCase() === m.neighborhood.toLowerCase(),
      );
    const candidates = data.ministers
      .filter((m) => !blocked(m, e, data, used, events))
      .sort(
        (a, b) =>
          count(a) +
            historical(a.id, e.kind === "VISIT") -
            (count(b) + historical(b.id, e.kind === "VISIT")) ||
          Number(consecutive(a)) - Number(consecutive(b)) ||
          Number(
            b.locationPreference === "PREFER" && b.location === e.location,
          ) -
            Number(
              a.locationPreference === "PREFER" && a.location === e.location,
            ) ||
          Number(nearby(b)) - Number(nearby(a)) ||
          a.id.localeCompare(b.id),
      );
    const result: Minister[][] = [];
    const seen = new Set<string>();
    for (const m of candidates) {
      const spouse = data.ministers.find((x) => x.id === m.spouseId);
      const pair =
        spouse &&
        (m.couplePreference === "TOGETHER" ||
          spouse.couplePreference === "TOGETHER")
          ? [m, spouse]
          : [m];
      if (pair.some((p) => blocked(p, e, data, used, events))) continue;
      if (
        spouse &&
        (m.couplePreference === "SEPARATE" ||
          spouse.couplePreference === "SEPARATE") &&
        used.some((a) => a.eventId === e.id && a.ministerId === spouse.id)
      )
        continue;
      const key = pair
        .map((p) => p.id)
        .sort()
        .join();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(pair);
      }
    }
    return result;
  }
  // Allocate scarce occurrences first; then use bounded branch-and-bound only if vacancies remain.
  const ordered = [...events].sort(
    (a, b) =>
      groups(a, []).flat().length / a.required -
        groups(b, []).flat().length / b.required ||
      (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id),
  );
  for (const e of ordered) {
    while (assignments.filter((a) => a.eventId === e.id).length < e.required) {
      const remaining =
        e.required - assignments.filter((a) => a.eventId === e.id).length;
      const group = groups(e, assignments).find((g) => g.length <= remaining);
      if (!group) break;
      assignments.push(
        ...group.map((m) => ({
          eventId: e.id,
          ministerId: m.id,
          origin: "AUTO" as const,
        })),
      );
    }
  }
  const target = events.reduce((total, e) => total + e.required, 0);
  let best = [...assignments],
    nodes = 0;
  const visit = (index: number, used: Assignment[]) => {
    if (++nodes > 50000 || best.length === target) return;
    if (used.length > best.length) best = [...used];
    if (index >= ordered.length) return;
    const e = ordered[index],
      already = used.filter((a) => a.eventId === e.id).length;
    const remaining = e.required - already;
    if (remaining <= 0) {
      visit(index + 1, used);
      return;
    }
    const bound =
      remaining + ordered.slice(index + 1).reduce((n, x) => n + x.required, 0);
    if (used.length + bound <= best.length) return;
    for (const group of groups(e, used).filter((g) => g.length <= remaining)) {
      visit(index, [
        ...used,
        ...group.map((m) => ({
          eventId: e.id,
          ministerId: m.id,
          origin: "AUTO" as const,
        })),
      ]);
      if (best.length === target || nodes > 50000) return;
    }
    visit(index + 1, used);
  };
  if (best.length < target) visit(0, []);
  assignments = best;
  for (const e of events)
    if (assignments.filter((a) => a.eventId === e.id).length < e.required)
      warnings.push(
        `${e.date} ${e.time} • ${e.title}: vagas pendentes de revisão.`,
      );
  if (nodes > 50000)
    warnings.push(
      "Busca limitada para preservar o tempo de resposta. A coordenação deve revisar as vagas restantes.",
    );
  return {
    id: crypto.randomUUID(),
    month,
    status: "DRAFT",
    revision: 1,
    assignments,
    events: events.map((e) => ({ ...e })),
    agendaEvents: events.map((e) => ({ ...e })),
    algorithmVersion: "mvp-scarcity-search-v2",
    ministers: data.ministers.map(({ id, name }) => ({ id, name })),
    warnings,
  };
}
export function validateSchedule(s: Schedule, data: Data): string[] {
  const errors: string[] = [];
  const checked: Assignment[] = [];
  if (agendaChanged(s, data))
    errors.push(
      "A agenda mudou. Sincronize a revisão antes de aprovar ou publicar.",
    );
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

export function advisories(s: Schedule) {
  const result: string[] = [];
  for (const m of s.ministers) {
    const own = s.assignments
      .filter((a) => a.ministerId === m.id)
      .map((a) => s.events.find((e) => e.id === a.eventId))
      .filter((e): e is Event => !!e)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < own.length; i++) {
      const distance = Date.parse(own[i].date) - Date.parse(own[i - 1].date);
      if (distance === 0)
        result.push(`${m.name}: mais de um compromisso em ${own[i].date}.`);
      else if (distance === 86400000)
        result.push(`${m.name}: compromissos em dias consecutivos.`);
    }
  }
  return [...new Set(result)];
}
