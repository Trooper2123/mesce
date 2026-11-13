import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Calendar } from "../src/components/calendar";
import { blankMinister } from "../src/lib/profile";
import {
  emptyData,
  generate,
  validateSchedule,
  syncSchedule,
  impeded,
  overlappingAgenda,
  type Event,
  type Schedule,
} from "../src/lib/domain";
import { notificationsFor } from "../src/lib/notifications";
import type { Identity } from "../src/lib/access";
const event = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Celebração fictícia",
  date: "2026-11-22",
  time: "08:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  required: 1,
  assistedId: "",
  notes: "",
  ...extra,
});
const person = () => ({
  ...blankMinister(randomUUID(), "pessoa@example.invalid"),
  name: "Ministro fictício",
  registrationStatus: "COMPLETE" as const,
});
const admin: Identity = {
  id: "coordinator",
  email: "coord@example.invalid",
  verified: true,
  coordinator: true,
};
function fixture() {
  const data = emptyData();
  data.ministers = [person(), person(), person()];
  data.events = [event()];
  const s = generate(data, "2026-11");
  s.status = "PUBLISHED";
  data.schedules = [s];
  return {
    data,
    s,
    user: {
      ...admin,
      coordinator: false,
      ministerId: s.assignments[0].ministerId,
    },
  };
}
test("notificações são deduplicadas por versão e evento, com detalhes sem dados de assistidos", () => {
  const { data, s, user } = fixture();
  data.schedules.push(structuredClone(s));
  const notices = notificationsFor(
    data,
    user,
    Date.parse("2026-11-20T12:00:00Z"),
  );
  assert.equal(notices.filter((n) => n.type === "PUBLICATION").length, 1);
  assert.equal(notices.filter((n) => n.type === "REMINDER").length, 1);
  assert.equal(new Set(notices.map((n) => n.id)).size, notices.length);
  assert.ok(notices.every((n) => n.href.startsWith("/minhas-escalas#")));
  assert.ok(!JSON.stringify(notices).includes("Matriz"));
  assert.deepEqual(notificationsFor(data, { ...user, verified: false }), []);
  assert.deepEqual(
    notificationsFor(data, { ...user, ministerId: randomUUID() }),
    [],
  );
});
test("aviso de revisão preserva publicação anterior e só revela rascunho à coordenação", () => {
  const { data, s, user } = fixture();
  const draft: Schedule = {
    ...s,
    id: randomUUID(),
    revision: 2,
    status: "DRAFT",
  };
  data.schedules.push(draft);
  assert.ok(
    notificationsFor(data, admin).some((n) => n.id === `review:${draft.id}`),
  );
  assert.ok(
    !notificationsFor(data, user).some((n) => n.scheduleId === draft.id),
  );
  draft.status = "PUBLISHED";
  const notices = notificationsFor(data, user);
  assert.ok(notices.some((n) => n.type === "REVISION" && n.revision === 2));
  assert.ok(!notices.some((n) => n.scheduleId === s.id));
});
test("cancelamento deixa aviso e desativação remove feed pessoal", () => {
  const { data, s, user } = fixture();
  s.status = "CANCELLED";
  assert.deepEqual(
    notificationsFor(data, user).map((n) => n.type),
    ["CANCELLATION"],
  );
  data.ministers.find((m) => m.id === user.ministerId)!.active = false;
  assert.deepEqual(notificationsFor(data, user), []);
});
test("calendário marca somente a ocorrência impedida e período inclui extremos", () => {
  const { data } = fixture();
  const morning = data.events[0],
    evening = event({ time: "18:00" });
  data.events.push(evening);
  data.absences = [
    {
      id: randomUUID(),
      ministerId: data.ministers[0].id,
      scope: "CELEBRATION",
      start: "",
      end: "",
      eventId: morning.id,
      reason: "privado",
    },
  ];
  assert.equal(impeded(data.ministers[0].id, morning, data.absences), true);
  assert.equal(impeded(data.ministers[0].id, evening, data.absences), false);
  const markup = renderToStaticMarkup(
    createElement(Calendar, {
      month: "2026-11",
      events: data.events,
      impediments: { [morning.id]: ["Pessoa fictícia"] },
    }),
  );
  assert.equal(markup.split("Impedido: Pessoa fictícia").length - 1, 1);
  assert.ok(!markup.includes("privado"));
  data.absences = [
    {
      ...data.absences[0],
      scope: "PERIOD",
      start: "2026-11-20",
      end: "2026-11-22",
      eventId: "",
    },
  ];
  for (const date of ["2026-11-20", "2026-11-21", "2026-11-22"])
    assert.ok(impeded(data.ministers[0].id, event({ date }), data.absences));
  assert.equal(
    impeded(data.ministers[0].id, event({ date: "2026-11-23" }), data.absences),
    false,
  );
});
test("pendência de resposta não esconde conflito de horário na validação", () => {
  const { data, s } = fixture();
  const visit = event({
    title: "Visita fictícia",
    kind: "VISIT",
    assistedId: randomUUID(),
  });
  s.events.push(visit);
  data.events.push(visit);
  s.assignments.push({
    eventId: visit.id,
    ministerId: s.assignments[0].ministerId,
  });
  data.settings = {
    unansweredPolicy: "REVIEW",
    monthlyLimit: null,
    historyMonths: 12,
  };
  const warnings = validateSchedule(s, data);
  assert.ok(warnings.some((w) => w.includes("Resposta mensal")));
  assert.ok(warnings.some((w) => w.includes("Conflito de horário")));
  assert.equal(overlappingAgenda(s).length, 1);
});
test("sincronizar inclui visita com três vagas e novos ministros sem alterar publicação", () => {
  const { data, s } = fixture();
  const before = structuredClone(s);
  const visit = event({
    title: "Visita fictícia",
    kind: "VISIT",
    assistedId: randomUUID(),
    time: "12:00",
    required: 3,
  });
  data.events.push(visit);
  const newcomer = person();
  data.ministers.push(newcomer);
  const draft = syncSchedule(s, data);
  assert.equal(draft.events.find((e) => e.id === visit.id)?.required, 3);
  assert.ok(draft.ministers.some((m) => m.id === newcomer.id));
  assert.deepEqual(s, before);
  for (const minister of data.ministers.slice(0, 3))
    draft.assignments.push({ eventId: visit.id, ministerId: minister.id });
  assert.deepEqual(validateSchedule(draft, data), []);
});

test("remarcar 1 de dezembro para dia 2 não move a ocorrência de terça dia 8", async () => {
  const { weeklyOccurrences } = await import("../src/lib/recurrence");
  const original = event({ date: "2026-12-01" });
  const series = weeklyOccurrences(original, 3, []);
  assert.deepEqual(
    series.map((e) => e.date),
    ["2026-12-01", "2026-12-08", "2026-12-15"],
  );
  const changes = weeklyOccurrences(
    { ...series[0], date: "2026-12-02" },
    1,
    series,
  );
  const persisted = series.map(
    (e) => changes.find((change) => change.id === e.id) ?? e,
  );
  assert.deepEqual(
    persisted.map((e) => e.date),
    ["2026-12-02", "2026-12-08", "2026-12-15"],
  );
  assert.equal(persisted[1].id, series[1].id);
  assert.throws(
    () => weeklyOccurrences({ ...series[0], date: "2026-12-02" }, 3, series),
    /apenas esta ocorrência/,
  );
});
