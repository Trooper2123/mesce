import { createHash } from "node:crypto";
import { latestPublished, type Event, type Schedule } from "./domain";
import type { Data } from "./domain";

export type StoredSchedule = { schedule: Schedule; updatedAt: string };
export type LiveEventState = { cancelled?: boolean; updatedAt: string };
type CalendarEntry = {
  event: Event;
  uid: string;
  sequence: number;
  modifiedAt: string;
  cancelled: boolean;
};

const zone = "America/Sao_Paulo";
const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const dateTime = (value: Date) =>
  value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const uidFor = (eventId: string, ministerId: string) =>
  `${createHash("sha256").update(`${eventId}:${ministerId}`).digest("hex")}@calendar.mesce.invalid`;

function localDateTimeToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const intended = Date.UTC(year, month - 1, day, hour, minute);
  let guess = intended;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const delta = intended - represented;
    if (!delta) break;
    guess += delta;
  }
  return new Date(guess);
}

const publicSummary = (event: Event) =>
  event.kind === "VISIT"
    ? "Visita a assistido"
    : event.kind === "MASS"
      ? "Missa"
      : event.kind === "ADORATION"
        ? "Adoração"
        : event.kind === "WEDDING"
          ? "Celebração matrimonial"
          : "Celebração especial";

function foldLine(line: string) {
  const output: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > 73) {
      output.push(current);
      current = ` ${char}`;
      bytes = 1 + size;
    } else {
      current += char;
      bytes += size;
    }
  }
  output.push(current);
  return output.join("\r\n");
}

function currentAssignments(
  schedules: StoredSchedule[],
  ministerId: string,
  now: Date,
  liveEvents?: Map<string, LiveEventState>,
) {
  const data: Data = {
    ministers: [],
    assisted: [],
    events: [],
    absences: [],
    schedules: schedules.map(({ schedule }) => schedule),
  };
  const latest = new Set(latestPublished(data).map((schedule) => schedule.id));
  const active = new Map<string, CalendarEntry>();
  const historical = new Map<string, CalendarEntry>();
  const historyCutoff = new Date(now.getTime() - 30 * 86400000);

  const orderedSchedules = [...schedules].sort(
    (a, b) =>
      a.schedule.month.localeCompare(b.schedule.month) ||
      a.schedule.revision - b.schedule.revision,
  );
  for (const stored of orderedSchedules) {
    const { schedule, updatedAt } = stored;
    if (!["PUBLISHED", "CANCELLED"].includes(schedule.status)) continue;
    for (const assignment of schedule.assignments) {
      if (assignment.ministerId !== ministerId) continue;
      const event = schedule.events.find(
        (item) => item.id === assignment.eventId,
      );
      if (!event) continue;
      const start = localDateTimeToUtc(event.date, event.time);
      if (start < historyCutoff) continue;
      const entry: CalendarEntry = {
        event,
        uid: uidFor(event.id, ministerId),
        sequence: Math.max(0, schedule.revision),
        modifiedAt: updatedAt,
        cancelled: false,
      };
      historical.set(entry.uid, entry);
      const currentEvent = liveEvents?.get(event.id);
      const explicitlyCancelled =
        !!liveEvents && (!currentEvent || currentEvent.cancelled === true);
      if (latest.has(schedule.id) && !event.cancelled && !explicitlyCancelled)
        active.set(entry.uid, entry);
      else if (explicitlyCancelled) {
        historical.set(entry.uid, {
          ...entry,
          sequence: entry.sequence + 1,
          modifiedAt: currentEvent?.updatedAt ?? updatedAt,
          cancelled: true,
        });
      }
    }
  }

  for (const [uid, entry] of historical) {
    if (!active.has(uid) && !entry.cancelled) {
      const relevant = schedules
        .filter(
          ({ schedule }) =>
            schedule.month === entry.event.date.slice(0, 7) &&
            ["PUBLISHED", "CANCELLED"].includes(schedule.status),
        )
        .sort((a, b) => b.schedule.revision - a.schedule.revision)[0];
      historical.set(uid, {
        ...entry,
        sequence: Math.max(entry.sequence, relevant?.schedule.revision ?? 0),
        modifiedAt: relevant?.updatedAt ?? entry.modifiedAt,
        cancelled: true,
      });
    }
  }
  return [...historical.values()].map(
    (entry) => active.get(entry.uid) ?? entry,
  );
}

export function personalCalendarIcs(
  schedules: StoredSchedule[],
  ministerId: string,
  applicationUrl: string,
  now = new Date(),
  liveEvents?: Map<string, LiveEventState>,
) {
  const entries = currentAssignments(
    schedules,
    ministerId,
    now,
    liveEvents,
  ).sort((a, b) =>
    `${a.event.date}${a.event.time}${a.uid}`.localeCompare(
      `${b.event.date}${b.event.time}${b.uid}`,
    ),
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MESCE//Agenda pessoal//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Minhas atividades MESCE",
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];
  const appLink = new URL("/minhas-escalas", applicationUrl).toString();
  for (const entry of entries) {
    const start = localDateTimeToUtc(entry.event.date, entry.event.time);
    const end = new Date(start.getTime() + entry.event.duration * 60000);
    const modified = new Date(entry.modifiedAt);
    const safeModified = Number.isNaN(modified.getTime()) ? now : modified;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.uid}`,
      `DTSTAMP:${dateTime(safeModified)}`,
      `LAST-MODIFIED:${dateTime(safeModified)}`,
      `SEQUENCE:${entry.sequence}`,
      `DTSTART:${dateTime(start)}`,
      `DTEND:${dateTime(end)}`,
      `SUMMARY:${escapeText(publicSummary(entry.event))}`,
      ...(entry.cancelled ? ["STATUS:CANCELLED"] : []),
      ...(entry.event.kind !== "VISIT" && entry.event.location
        ? [`LOCATION:${escapeText(entry.event.location)}`]
        : []),
      `DESCRIPTION:${escapeText(`Consulte os detalhes na aplicação MESCE: ${appLink}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function calendarTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
