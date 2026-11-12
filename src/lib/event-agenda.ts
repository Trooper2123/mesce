import { type Data, type Event, requireFuture, overlaps } from "./domain";
import { parseEventForm, applyVisitStaffing } from "./event-input";
import { weeklyOccurrences } from "./recurrence";
export function eventClassOf(event: Event): "FIXED" | "EXTRAORDINARY" {
  if (event.kind === "VISIT") return "EXTRAORDINARY";
  return (
    event.eventClass ??
    (["MASS", "ADORATION"].includes(event.kind) ? "FIXED" : "EXTRAORDINARY")
  );
}
export function sortEvents(events: Event[]) {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time) ||
      a.title.localeCompare(b.title, "pt-BR") ||
      a.id.localeCompare(b.id),
  );
}
export function overlappingEvents(event: Event, events: Event[]) {
  if (event.cancelled) return [];
  return sortEvents(
    events.filter(
      (other) =>
        other.id !== event.id && !other.cancelled && overlaps(event, other),
    ),
  );
}
export function eventOverlapNotice(event: Event, events: Event[]) {
  const matches = overlappingEvents(event, events);
  return matches.length
    ? `Atenção: horário sobreposto com ${matches.map((other) => `${other.title} (${other.time})`).join(", ")}. O cadastro é permitido; revise a equipe.`
    : "";
}
/** Each occurrence has its own ID. Shared names and times are allowed. */
export function planEventSave(
  form: FormData,
  id: string,
  data: Data,
  now = Date.now(),
) {
  const previous = data.events.find((e) => e.id === id);
  const parsed = applyVisitStaffing(
    parseEventForm(form, id, previous),
    data.assisted,
  );
  const event = {
    ...parsed,
    eventClass: parsed.eventClass ?? eventClassOf(parsed),
  };
  requireFuture(event, now);
  const raw = form.get("occurrences");
  const count = raw === null ? 1 : Number(raw);
  const occurrences = weeklyOccurrences(event, count, data.events);
  for (const occurrence of occurrences) requireFuture(occurrence, now);
  return occurrences;
}
