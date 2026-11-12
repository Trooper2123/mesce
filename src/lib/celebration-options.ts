import type { Event } from "./domain";
export function nextScheduleMonth(now = new Date()): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}
export function specificCelebrations(
  events: Event[],
  now = new Date(),
): Event[] {
  const month = nextScheduleMonth(now);
  return events
    .filter(
      (e) => e.kind !== "VISIT" && !e.cancelled && e.date.startsWith(month),
    )
    .sort(
      (a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time) ||
        a.title.localeCompare(b.title),
    );
}
