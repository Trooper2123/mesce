import type { Event } from "./domain";
import {
  calendarUid,
  escapeCalendarText,
  localDateTimeToUtc,
  publicCalendarSummary,
} from "./personal-calendar";

export type InviteEvent = Pick<
  Event,
  "id" | "date" | "time" | "duration" | "kind" | "location"
>;
export type InviteMethod = "REQUEST" | "CANCEL";
export type CalendarInvite = {
  event: InviteEvent;
  ministerId: string;
  sequence: number;
  method: InviteMethod;
  attendeeEmail: string;
  organizerEmail: string;
  applicationUrl: string;
  dtstamp: string;
};

function utc(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function fold(line: string) {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > 73) {
      parts.push(current);
      current = ` ${char}`;
      bytes = size + 1;
    } else {
      current += char;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

export function inviteUid(eventId: string, ministerId: string) {
  return calendarUid(eventId, ministerId);
}

export function buildCalendarInvite(input: CalendarInvite) {
  const start = localDateTimeToUtc(input.event.date, input.event.time);
  const end = new Date(start.getTime() + input.event.duration * 60000);
  const appUrl = new URL("/minhas-escalas", input.applicationUrl).toString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MESCE//Convite pessoal//PT-BR",
    `METHOD:${input.method}`,
    "BEGIN:VEVENT",
    `UID:${inviteUid(input.event.id, input.ministerId)}`,
    `DTSTAMP:${utc(new Date(input.dtstamp))}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${escapeCalendarText(publicCalendarSummary(input.event))}`,
    `ORGANIZER:mailto:${input.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${input.attendeeEmail}`,
    ...(input.method === "CANCEL" ? ["STATUS:CANCELLED"] : []),
    ...(input.event.kind !== "VISIT" && input.event.location
      ? [`LOCATION:${escapeCalendarText(input.event.location)}`]
      : []),
    `DESCRIPTION:${escapeCalendarText(`Consulte os detalhes na aplicação MESCE: ${appUrl}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
