import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyData,
  type Event,
  type Schedule,
  type Assisted,
} from "../src/lib/domain";
import { blankMinister } from "../src/lib/profile";
import { operationalReport, reportPeriod } from "../src/lib/reports";
const m1 = {
  ...blankMinister(randomUUID(), "um@example.invalid"),
  name: "Pessoa um",
  active: true,
};
const m2 = {
  ...blankMinister(randomUUID(), "dois@example.invalid"),
  name: "Pessoa dois",
  active: true,
};
const event = (kind: Event["kind"] = "MASS"): Event => ({
  id: randomUUID(),
  title: "Atividade sintética",
  date: "2030-01-06",
  time: "08:00",
  duration: 60,
  kind,
  location: "Local sintético",
  required: 2,
  assistedId: "",
  notes: "",
});
const schedule = (events: Event[], revision = 1): Schedule => ({
  id: randomUUID(),
  month: "2030-01",
  status: "PUBLISHED",
  revision,
  events,
  assignments: events.map((e) => ({ eventId: e.id, ministerId: m1.id })),
  ministers: [{ id: m1.id, name: "Nome na publicação" }],
  warnings: [],
});
test("período mensal e anual cruza ano e valida entradas", () => {
  assert.deepEqual(reportPeriod("2030-01", 12), {
    start: "2029-02",
    end: "2030-01",
    months: 12,
  });
  assert.equal(reportPeriod("2030-01", 1).start, "2030-01");
  for (const bad of ["2030-13", "2030-00", "30-01", "2030-1", "0000-01"])
    assert.throws(() => reportPeriod(bad, 1));
  assert.throws(() => reportPeriod("2030-01", 2));
});
test("relatório usa somente publicação vigente, não duplica revisões e separa modalidades", () => {
  const d = emptyData();
  d.ministers = [m1, m2];
  const a = event(),
    v = event("VISIT");
  const current = schedule([a, v], 2);
  current.assignments.push({ ...current.assignments[0] });
  d.schedules = [
    schedule([a], 1),
    current,
    { ...schedule([a], 3), status: "DRAFT" },
  ];
  const r = operationalReport(d, "2030-01", 1);
  assert.equal(r.schedules.length, 1);
  assert.equal(r.entries.length, 2);
  assert.equal(r.celebrations.total, 1);
  assert.equal(r.visits.total, 1);
  assert.deepEqual(r.celebrations, {
    total: 1,
    min: 0,
    max: 1,
    average: 0.5,
    difference: 1,
  });
  assert.equal(r.events[0].vacancies, 1);
  assert.equal(r.entries[0].minister, "Nome na publicação");
});
test("cancelamento posterior remove publicação e mês sem dados tem métricas zero", () => {
  const d = emptyData();
  const a = event();
  d.schedules = [
    schedule([a], 1),
    { ...schedule([a], 2), status: "CANCELLED" },
  ];
  const r = operationalReport(d, "2030-01", 12);
  assert.equal(r.schedules.length, 0);
  assert.equal(r.entries.length, 0);
  assert.deepEqual(r.visits, {
    total: 0,
    min: 0,
    max: 0,
    average: 0,
    difference: 0,
  });
});
test("contatos vêm do snapshot, não do cadastro atual; histórico não altera dados", () => {
  const id = randomUUID(),
    v = { ...event("VISIT"), assistedId: id },
    d = emptyData();
  const s = schedule([v]);
  const historical = {
    id,
    name: "Pessoa histórica",
    mobile: "Contato histórico",
    address: "Endereço histórico",
  } as Assisted;
  s.assistedSnapshot = [historical];
  d.schedules = [s];
  d.assisted = [
    { ...historical, name: "Nome atualizado", mobile: "Contato atual" },
  ];
  const before = JSON.stringify(d);
  const r = operationalReport(d, "2030-01", 1);
  assert.equal(r.events[0].assisted?.mobile, "Contato histórico");
  assert.equal(r.participation[0].status, "Somente no histórico");
  assert.equal(JSON.stringify(d), before);
  delete s.assistedSnapshot;
  assert.equal(
    operationalReport(d, "2030-01", 1).events[0].assisted,
    undefined,
  );
});
test("janela exclui meses fora do período e eventos cancelados; ignora referência órfã", () => {
  const d = emptyData(),
    a = event(),
    s = schedule([a, { ...event(), cancelled: true }]);
  s.assignments.push({ eventId: randomUUID(), ministerId: m2.id });
  d.schedules = [
    s,
    { ...schedule([a]), month: "2028-12" },
    { ...schedule([a]), month: "2030-02" },
  ];
  const r = operationalReport(d, "2030-01", 12);
  assert.equal(r.schedules.length, 1);
  assert.equal(r.entries.length, 1);
  assert.equal(r.events.length, 1);
});
