import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyVisitStaffing, parseEventForm } from "../src/lib/event-input";
import { sameVisitAddress, visitAssistedIds } from "../src/lib/visit-group";
import {
  nextScheduleMonth,
  specificCelebrations,
} from "../src/lib/celebration-options";
import { emptyData, type Event, type Assisted } from "../src/lib/domain";
import { validateAbsenceSubmission } from "../src/lib/absence-input";
const person = (extra: Partial<Assisted> = {}): Assisted => ({
  id: randomUUID(),
  name: "Pessoa fictícia",
  address: "Rua A, 10",
  neighborhood: "Centro",
  city: "Brasília",
  state: "DF",
  postalCode: "70000-000",
  landline: "",
  mobile: "",
  familyName: "",
  familyPhone: "",
  notes: "",
  active: true,
  ministersRequired: 3,
  ...extra,
});
const event = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Celebração",
  date: "2030-01-06",
  time: "08:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  required: 1,
  assistedId: "",
  notes: "",
  ...extra,
});
test("grupo mantém cadastros individuais e usa uma única equipe sem somar", () => {
  const a = person(),
    b = person({ address: "  rua A, 10  " });
  const e = event({
    kind: "VISIT",
    assistedId: a.id,
    assistedIds: [a.id, b.id, b.id],
    groupMinistersRequired: 2,
  });
  const saved = applyVisitStaffing(e, [a, b]);
  assert.equal(saved.required, 2);
  assert.deepEqual(visitAssistedIds(saved), [a.id, b.id]);
  assert.equal(a.ministersRequired, 3);
  for (const invalid of [
    { ...b, address: "Rua A, 11" },
    { ...b, active: false },
    { ...b, postalCode: "71000-000" },
  ])
    assert.throws(() => applyVisitStaffing(e, [a, invalid]));
  assert.throws(() =>
    applyVisitStaffing({ ...e, groupMinistersRequired: undefined }, [a, b]),
  );
  assert.equal(
    sameVisitAddress(person({ address: "" }), person({ address: "" })),
    false,
  );
  assert.equal(
    applyVisitStaffing(
      { ...e, assistedIds: [], groupMinistersRequired: undefined },
      [a],
    ).required,
    3,
  );
});
test("formulário preserva membros e descarta grupo ao mudar para missa", () => {
  const a = person(),
    b = person();
  const e = event({ kind: "VISIT", assistedId: a.id });
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, String(v));
  f.set("kind", "event");
  f.set("eventKind", "VISIT");
  f.append("assistedIds", b.id);
  f.set("groupMinistersRequired", "2");
  assert.equal(applyVisitStaffing(parseEventForm(f, e.id), [a, b]).required, 2);
  f.set("eventKind", "MASS");
  assert.equal(parseEventForm(f, e.id).assistedIds, undefined);
});
test("seletor usa próximo mês em Brasília, virada de ano e ordem de data/hora", () => {
  const now = new Date("2029-12-20T12:00:00Z");
  const early = event(),
    late = event({ time: "19:00" });
  assert.equal(nextScheduleMonth(now), "2030-01");
  assert.deepEqual(
    specificCelebrations(
      [
        late,
        event({ date: "2029-12-30" }),
        event({ kind: "VISIT" }),
        event({ cancelled: true }),
        early,
      ],
      now,
    ).map((e) => e.id),
    [early.id, late.id],
  );
  assert.equal(nextScheduleMonth(new Date("2030-01-01T01:00:00Z")), "2030-01");
});
test("envio direto não permite coordenação selecionar celebrações de outra competência", () => {
  const data = emptyData();
  const id = randomUUID();
  data.ministers.push({ id } as never);
  const e = event({ date: "2030-02-03" });
  data.events.push(e);
  const absence = {
    id: randomUUID(),
    ministerId: id,
    scope: "CELEBRATION" as const,
    start: "",
    end: "",
    eventId: e.id,
    reason: "",
  };
  assert.throws(
    () =>
      validateAbsenceSubmission(
        absence,
        { coordinator: true } as never,
        data,
        new Date("2029-12-20T12:00:00Z"),
      ),
    /próximo mês/,
  );
});
