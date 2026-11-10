import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  generate,
  validateSchedule,
  emptyData,
  ministerSchema,
  eventSchema,
  absenceSchema,
  Minister,
  Event,
  Data,
  Absence,
} from "../src/lib/domain";
const m = (extra: Partial<Minister> = {}): Minister => ({
  id: randomUUID(),
  name: "Ministro Sintético",
  email: "teste@example.invalid",
  birthDate: "",
  phone: "",
  ministryStart: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  active: true,
  away: false,
  monthlyLimit: 20,
  spouseId: "",
  couplePreference: "NONE",
  location: "Matriz",
  locationPreference: "ACCEPT",
  notes: "",
  ...extra,
});
const e = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Encontro sintético",
  date: "2026-11-08",
  time: "08:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  required: 1,
  assistedId: "",
  notes: "",
  ...extra,
});
const a = (minister: Minister, extra: Partial<Absence> = {}): Absence => ({
  id: randomUUID(),
  ministerId: minister.id,
  scope: "DAY",
  start: "2026-11-08",
  end: "2026-11-08",
  eventId: "",
  reason: "",
  ...extra,
});
const data = (
  ministers: Minister[],
  events: Event[],
  absences: Absence[] = [],
): Data => ({ ...emptyData(), ministers, events, absences });
test("impedimento específico mantém elegibilidade em outra missa no mesmo dia", () => {
  const minister = m(),
    first = e(),
    second = e({ time: "18:00" });
  const d = data(
    [minister],
    [first, second],
    [
      a(minister, {
        scope: "CELEBRATION",
        eventId: first.id,
        start: "",
        end: "",
      }),
    ],
  );
  const s = generate(d, "2026-11");
  assert.deepEqual(s.assignments, [
    { eventId: second.id, ministerId: minister.id },
  ]);
});
test("dia e período inclusivo bloqueiam todas as atividades aplicáveis", () => {
  const minister = m();
  for (const scope of ["DAY", "PERIOD"] as const) {
    const d = data(
      [minister],
      [e(), e({ time: "18:00" })],
      [a(minister, { scope })],
    );
    assert.equal(generate(d, "2026-11").assignments.length, 0);
  }
});
test("não escala ministros inativos, afastados ou fora de local exclusivo", () => {
  const d = data(
    [
      m({ active: false }),
      m({ away: true }),
      m({ location: "Capela", locationPreference: "EXCLUSIVE" }),
    ],
    [e()],
  );
  assert.equal(generate(d, "2026-11").assignments.length, 0);
});
test("não sobrepõe eventos e respeita limite mensal combinado", () => {
  const minister = m({ monthlyLimit: 1 });
  const d = data(
    [minister],
    [e(), e({ time: "08:30" }), e({ date: "2026-11-15" })],
  );
  assert.equal(generate(d, "2026-11").assignments.length, 1);
});
test("casal junto é uma unidade elegível para ambas as vagas", () => {
  const first = m({ couplePreference: "TOGETHER" }),
    second = m({ spouseId: first.id, couplePreference: "TOGETHER" });
  first.spouseId = second.id;
  let d = data([first, second], [e({ required: 2 })]);
  assert.equal(generate(d, "2026-11").assignments.length, 2);
  d = data([first, second], [e()]);
  assert.equal(generate(d, "2026-11").assignments.length, 0);
  d = data([first, second], [e({ required: 2 })], [a(second)]);
  assert.equal(generate(d, "2026-11").assignments.length, 0);
});
test("casal separado não ocupa a mesma celebração", () => {
  const first = m({ couplePreference: "SEPARATE" }),
    second = m({ spouseId: first.id });
  first.spouseId = second.id;
  const s = generate(data([first, second], [e({ required: 2 })]), "2026-11");
  assert.equal(s.assignments.length, 1);
});
test("distribuição determinística equilibra ministros disponíveis", () => {
  const ministers = [m(), m(), m()];
  const events = Array.from({ length: 9 }, (_, i) =>
    e({ date: `2026-11-${String(i + 1).padStart(2, "0")}` }),
  );
  const d = data(ministers, events);
  const s = generate(d, "2026-11");
  assert.deepEqual(s.assignments, generate(d, "2026-11").assignments);
  assert.deepEqual(
    ministers.map(
      (m) => s.assignments.filter((a) => a.ministerId === m.id).length,
    ),
    [3, 3, 3],
  );
  assert.deepEqual(validateSchedule(s, d), []);
});
test("visitas só aos domingos, datas reais e quantitativo positivo", () => {
  assert.throws(() =>
    eventSchema.parse(
      e({ kind: "VISIT", date: "2026-11-09", assistedId: randomUUID() }),
    ),
  );
  assert.throws(() => eventSchema.parse(e({ date: "2026-02-30" })));
  assert.throws(() => eventSchema.parse(e({ required: 0 })));
  assert.doesNotThrow(() =>
    eventSchema.parse(e({ kind: "VISIT", assistedId: randomUUID() })),
  );
});
test("validação barra aprovação com excedentes, duplicidades e impedimentos novos", () => {
  const minister = m();
  const d = data([minister], [e()]);
  const s = generate(d, "2026-11");
  s.assignments.push(s.assignments[0]);
  assert.ok(validateSchedule(s, d).length);
  s.assignments.pop();
  d.absences.push(a(minister));
  assert.ok(validateSchedule(s, d).length);
});
test("não aceita vínculo conjugal consigo mesmo ou intervalo invertido", () => {
  const minister = m();
  assert.throws(() =>
    ministerSchema.parse({ ...minister, spouseId: minister.id }),
  );
  assert.throws(() =>
    absenceSchema.parse(
      a(minister, { scope: "PERIOD", start: "2026-11-17", end: "2026-11-10" }),
    ),
  );
});

test("prioriza menor histórico sem contar revisões antigas do mesmo mês", () => {
  const first = m({ id: "00000000-0000-4000-8000-000000000001" }),
    second = m({ id: "00000000-0000-4000-8000-000000000002" });
  const d = data([first, second], [e()]);
  const historical = generate(
    data([first], [e({ date: "2026-10-04" })]),
    "2026-10",
  );
  historical.status = "PUBLISHED";
  d.schedules.push(historical);
  assert.equal(generate(d, "2026-11").assignments[0].ministerId, second.id);
  const revised = {
    ...historical,
    id: randomUUID(),
    revision: 2,
    assignments: [{ eventId: historical.events[0].id, ministerId: second.id }],
  };
  d.schedules.push(revised);
  assert.equal(generate(d, "2026-11").assignments[0].ministerId, first.id);
});
test("bairro desempata visitas entre ministros igualmente elegíveis", () => {
  const first = m({
      id: "00000000-0000-4000-8000-000000000001",
      neighborhood: "Outro bairro",
    }),
    second = m({
      id: "00000000-0000-4000-8000-000000000002",
      neighborhood: "Bairro sintético",
    });
  const visit = e({ kind: "VISIT", assistedId: randomUUID() });
  const d = data([first, second], [visit]);
  d.assisted.push({
    id: visit.assistedId,
    neighborhood: "Bairro sintético",
  } as Data["assisted"][number]);
  assert.equal(generate(d, "2026-11").assignments[0].ministerId, second.id);
});
