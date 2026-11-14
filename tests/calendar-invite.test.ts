import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  buildCalendarInvite,
  type CalendarInvite,
} from "../src/lib/calendar-invite";

const invite = (method: CalendarInvite["method"]): CalendarInvite => ({
  event: {
    id: randomUUID(),
    date: "2030-11-03",
    time: "08:00",
    duration: 60,
    kind: "VISIT",
    location: "Endereço privado do assistido",
  },
  ministerId: randomUUID(),
  sequence: 7,
  method,
  attendeeEmail: "ministro@example.invalid",
  organizerEmail: "mesce@example.invalid",
  applicationUrl: "https://mesce.example.invalid",
  dtstamp: "2030-10-01T12:00:00.000Z",
});

test("convite de visita usa resumo genérico e não inclui endereço", () => {
  const calendar = buildCalendarInvite(invite("REQUEST"));
  assert.match(calendar, /METHOD:REQUEST/);
  assert.match(calendar, /SUMMARY:Visita a assistido/);
  assert.match(calendar, /DTSTART:20301103T110000Z/);
  assert.ok(!calendar.includes("Endereço privado"));
  assert.ok(!calendar.includes("LOCATION:"));
});

test("cancelamento mantém UID estável e sinaliza sequência cancelada", () => {
  const request = invite("REQUEST");
  const cancel = buildCalendarInvite({
    ...request,
    method: "CANCEL",
    sequence: 8,
  });
  const original = buildCalendarInvite(request);
  assert.equal(
    cancel.match(/UID:([^\r]+)/)?.[1],
    original.match(/UID:([^\r]+)/)?.[1],
  );
  assert.match(cancel, /METHOD:CANCEL/);
  assert.match(cancel, /SEQUENCE:8/);
  assert.match(cancel, /STATUS:CANCELLED/);
});
