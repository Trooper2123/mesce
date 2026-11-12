import { eventSchema, type Event, type Assisted } from "./domain";
export function parseEventForm(form: FormData, id: string, previous?: Event) {
  if (
    form.getAll("kind").length !== 1 ||
    form.get("kind") !== "event" ||
    form.getAll("eventKind").length !== 1
  )
    throw new Error("Tipo de atividade inválido. Reabra o formulário.");
  const raw = Object.fromEntries(form.entries());
  return eventSchema.parse({
    ...raw,
    id,
    kind: raw.eventKind,
    eventClass: raw.eventClass ?? previous?.eventClass,
    seriesId: previous?.seriesId,
    seriesException: previous?.seriesId ? true : undefined,
    changeNotice: previous?.changeNotice,
    cancelled: previous?.cancelled,
    visitSite: undefined,
    assistedId: raw.eventKind === "VISIT" ? raw.assistedId : "",
    duration: Number(raw.duration),
    required: Number(raw.required),
  });
}

export function applyVisitStaffing(event: Event, assisted: Assisted[]): Event {
  if (event.kind !== "VISIT") return event;
  const person = assisted.find((a) => a.id === event.assistedId && a.active);
  if (!person) throw new Error("Selecione um assistido ativo.");
  return eventSchema.parse({
    ...event,
    required: person.ministersRequired ?? 1,
  });
}
