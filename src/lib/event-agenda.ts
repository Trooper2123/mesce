import { z } from "zod";
import {
  type Data,
  type Event,
  requireFuture,
  overlaps,
  eventSchema,
} from "./domain";
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
/** Within each day, celebrations by time, followed by assisted visits by time. */
export function sortCalendarEvents(events: Event[]) {
  return sortEvents(events).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(a.kind === "VISIT") - Number(b.kind === "VISIT"),
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
  const mode = z
    .enum(["SINGLE", "MULTIPLE"])
    .parse(form.get("dateMode") ?? "SINGLE");
  const rawDates = form.getAll("dates").map((date) => String(date).trim());
  if (
    mode === "MULTIPLE" &&
    (previous || !rawDates.length || rawDates.length > 53)
  )
    throw new Error(
      previous
        ? "Edite apenas esta ocorrência; selecione múltiplas datas em um novo cadastro."
        : "Selecione de 1 a 53 datas.",
    );
  const dates = [...new Set(rawDates)].sort();
  const source = new FormData();
  for (const [key, value] of form.entries()) source.append(key, value);
  if (mode === "MULTIPLE") source.set("date", dates[0]);
  const parsed = applyVisitStaffing(
    parseEventForm(source, id, previous),
    data.assisted,
  );
  const event = {
    ...parsed,
    eventClass: parsed.eventClass ?? eventClassOf(parsed),
  };
  requireFuture(event, now);
  const permanent = form.get("permanent") === "on";
  if (permanent && (mode !== "SINGLE" || event.eventClass !== "FIXED"))
    throw new Error(
      "A recorrência permanente está disponível somente para eventos fixos.",
    );
  const raw = form.get("occurrences");
  const count = permanent ? 53 : raw === null ? 1 : Number(raw);
  if (mode === "MULTIPLE" && count !== 1)
    throw new Error(
      "Escolha várias datas ou repetição semanal, sem combinar os dois modos.",
    );
  const occurrences =
    mode === "MULTIPLE"
      ? dates.map((date, index) =>
          eventSchema.parse({
            ...event,
            date,
            id: index === 0 ? event.id : crypto.randomUUID(),
            seriesId:
              event.eventClass === "FIXED" && dates.length > 1
                ? event.id
                : undefined,
          }),
        )
      : weeklyOccurrences(event, count, data.events);
  for (const occurrence of occurrences) requireFuture(occurrence, now);
  return occurrences;
}

/** Group repeated occurrences by their registered title, without merging events. */
export function eventNameKey(title: string) {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
export function eventNameOptions(events: Event[]): [string, string][] {
  const names = new Map<string, string>();
  for (const event of events) {
    const label = event.title.trim().replace(/\s+/g, " ");
    const key = eventNameKey(label);
    if (key && !names.has(key)) names.set(key, label);
  }
  return [...names].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
}
export function matchesEventName(event: Event, selected?: string) {
  return !selected || eventNameKey(event.title) === selected;
}

/** Search only public event fields, including both supported date formats. */
export function matchesEventSearch(event: Event, query?: string) {
  const terms =
    query?.trim().toLocaleLowerCase("pt-BR").split(/\s+/).filter(Boolean) ?? [];
  const searchable = [
    event.title,
    event.date,
    event.date.split("-").reverse().join("/"),
    event.time,
    event.location,
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return terms.every((term) => searchable.includes(term));
}
