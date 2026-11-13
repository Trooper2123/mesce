import { sameVisitAddress, visitAssistedIds } from "./visit-group";
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
    assistedIds:
      raw.eventKind === "VISIT"
        ? [...new Set(form.getAll("assistedIds").map(String))]
        : undefined,
    groupMinistersRequired:
      raw.eventKind === "VISIT" && raw.groupMinistersRequired
        ? Number(raw.groupMinistersRequired)
        : undefined,
    duration: Number(raw.duration),
    required: Number(raw.required),
  });
}

export function applyVisitStaffing(event: Event, assisted: Assisted[]): Event {
  if (event.kind !== "VISIT") return event;
  const person = assisted.find((a) => a.id === event.assistedId && a.active);
  if (!person) throw new Error("Selecione um assistido ativo.");
  const ids = visitAssistedIds(event);
  const people = ids.map((id) => assisted.find((a) => a.id === id && a.active));
  if (ids.length > 1 && people.some((a) => !a || !sameVisitAddress(person, a)))
    throw new Error(
      "Agrupe somente assistidos ativos no mesmo endereço completo.",
    );
  if (ids.length > 1 && !event.groupMinistersRequired)
    throw new Error("Informe a quantidade de ministros para o grupo.");
  return eventSchema.parse({
    ...event,
    assistedIds: ids,
    groupMinistersRequired:
      ids.length > 1 ? event.groupMinistersRequired : undefined,
    required:
      ids.length > 1
        ? event.groupMinistersRequired
        : (person.ministersRequired ?? 1),
  });
}
