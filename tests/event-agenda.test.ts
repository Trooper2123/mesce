import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { Calendar } from "../src/components/calendar";
import { EventFields } from "../src/components/event-fields";
import { type Event, emptyData, blocked } from "../src/lib/domain";
import { blankMinister } from "../src/lib/profile";
import {
  eventClassOf,
  eventNameOptions,
  matchesEventName,
  matchesEventSearch,
  eventOverlapNotice,
  overlappingEvents,
  planEventSave,
  sortEvents,
} from "../src/lib/event-agenda";
import { write, readData } from "../src/lib/store";
const now = Date.parse("2026-11-01T12:00:00Z");
const event = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Missa semanal",
  date: "2030-11-03",
  time: "08:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  required: 1,
  assistedId: "",
  notes: "",
  ...extra,
});
function form(e: Event, count = 1) {
  const f = new FormData();
  for (const [key, value] of Object.entries(e))
    if (value !== undefined) f.set(key, String(value));
  f.set("kind", "event");
  f.set("eventKind", e.kind);
  f.set("occurrences", String(count));
  return f;
}
test("nomes e horários iguais são permitidos, inclusive no mesmo local, com aviso", () => {
  const first = event(),
    second = event();
  const data = { ...emptyData(), events: [first] };
  const planned = planEventSave(form(second), second.id, data, now);
  assert.equal(planned.length, 1);
  assert.equal(planned[0].title, first.title);
  assert.notEqual(planned[0].id, first.id);
  assert.match(
    eventOverlapNotice(planned[0], data.events),
    /Atenção: horário sobreposto/,
  );
  assert.equal(
    eventOverlapNotice(event({ date: "2030-11-04" }), data.events),
    "",
  );
});
test("avisos consideram duração, ignoram cancelados e a própria ocorrência", () => {
  const first = event(),
    overlap = event({ time: "08:30" }),
    adjacent = event({ time: "09:00" }),
    cancelled = event({ cancelled: true });
  assert.deepEqual(
    overlappingEvents(first, [first, overlap, adjacent, cancelled]).map(
      (e) => e.id,
    ),
    [overlap.id],
  );
  assert.deepEqual(overlappingEvents(cancelled, [first]), []);
});
test("série fixa preserva nomes e IDs distintos; remarcação individual mantém as próximas datas", () => {
  const first = event({ eventClass: "FIXED" });
  const data = emptyData();
  const series = planEventSave(form(first, 3), first.id, data, now);
  assert.equal(new Set(series.map((e) => e.id)).size, 3);
  assert.equal(new Set(series.map((e) => e.seriesId)).size, 1);
  assert.ok(
    series.every((e) => e.title === first.title && e.eventClass === "FIXED"),
  );
  data.events = series;
  const moved = { ...series[0], date: "2030-11-04" };
  const [updated] = planEventSave(form(moved), moved.id, data, now);
  assert.equal(updated.seriesId, series[1].seriesId);
  assert.equal(series[1].date, "2030-11-10");
  assert.equal(updated.date, "2030-11-04");
});
test("eventos extraordinários são avulsos e visita não pode ser classificada como fixa", () => {
  const extra = event({ eventClass: "EXTRAORDINARY" });
  assert.equal(
    planEventSave(form(extra), extra.id, emptyData(), now)[0].eventClass,
    "EXTRAORDINARY",
  );
  assert.throws(
    () => planEventSave(form(extra, 2), extra.id, emptyData(), now),
    /extraordinários/,
  );
  const visit = event({
    kind: "VISIT",
    assistedId: randomUUID(),
    eventClass: "FIXED",
  });
  assert.throws(
    () => planEventSave(form(visit), visit.id, emptyData(), now),
    /Visitas/,
  );
  assert.equal(eventClassOf(event()), "FIXED");
  assert.equal(eventClassOf(event({ kind: "SPECIAL" })), "EXTRAORDINARY");
});
test("calendário ordena por horário, filtra o mês e distingue categorias sem depender só da cor", () => {
  const evening = event({ title: "NOITE_TESTE", time: "19:00" });
  const morning = event({ title: "MANHA_TESTE", time: "08:00" });
  const extra = event({
    title: "EXTRA_TESTE",
    time: "10:00",
    eventClass: "EXTRAORDINARY",
  });
  const hidden = event({ title: "OUTRO_MES_TESTE", date: "2030-12-03" });
  const before = [evening, extra, morning, hidden];
  const markup = renderToStaticMarkup(
    createElement(Calendar, { month: "2030-11", events: before }),
  );
  assert.ok(markup.indexOf("MANHA_TESTE") < markup.indexOf("EXTRA_TESTE"));
  assert.ok(markup.indexOf("EXTRA_TESTE") < markup.indexOf("NOITE_TESTE"));
  assert.ok(!markup.includes("OUTRO_MES_TESTE"));
  assert.ok(markup.includes("calendar-event-extraordinary"));
  assert.ok(markup.includes("Fixo recorrente"));
  assert.deepEqual(before[0], evening);
  assert.equal(sortEvents(before)[0].id, morning.id);
  const coincident = event({
    title: "COINCIDENTE_TESTE",
    time: "08:00",
    eventClass: "EXTRAORDINARY",
  });
  const filtered = renderToStaticMarkup(
    createElement(Calendar, {
      month: "2030-11",
      events: [morning],
      agendaEvents: [morning, coincident],
    }),
  );
  assert.ok(filtered.includes("horário sobreposto com COINCIDENTE_TESTE"));
});
test("cadastro fixo oferece recorrência e visita usa ocorrência extraordinária", () => {
  const fixed = renderToStaticMarkup(
    createElement(EventFields, { assisted: [] }),
  );
  assert.ok(fixed.includes('name="occurrences"'));
  assert.ok(fixed.includes("Repetir semanalmente"));
  const visit = renderToStaticMarkup(
    createElement(EventFields, { assisted: [], visit: true }),
  );
  assert.ok(visit.includes('name="eventClass" value="EXTRAORDINARY"'));
  assert.ok(!visit.includes("Repetir semanalmente"));
});
test("eventos simultâneos não liberam a mesma pessoa para duas atividades", () => {
  const minister = {
    ...blankMinister(randomUUID(), "teste@example.invalid"),
    registrationStatus: "COMPLETE" as const,
  };
  const first = event(),
    second = event();
  assert.match(
    blocked(
      minister,
      second,
      { ...emptyData(), events: [first, second] },
      [{ eventId: first.id, ministerId: minister.id }],
      [first, second],
    ),
    /Conflito/,
  );
});
test("PostgreSQL persiste dois eventos de mesmo nome e horário sem sobrescrever", async () => {
  process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "002_access.sql"])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const first = event(),
      second = event();
    for (const value of [first, second]) {
      const planned = planEventSave(
        form(value),
        value.id,
        await readData(client),
        now,
      );
      for (const item of planned) await write(client, "event", item);
    }
    const saved = (await readData(client)).events;
    assert.equal(saved.length, 2);
    assert.equal(saved[0].title, saved[1].title);
    assert.equal(saved[0].time, saved[1].time);
    assert.equal(overlappingEvents(saved[0], saved).length, 1);
  } finally {
    await db.close();
  }
});

test("cards ordenam missas antes das visitas e abrem edição da ocorrência", () => {
  const visitEarly = event({
    kind: "VISIT",
    title: "VISITA_CEDO",
    time: "07:00",
  });
  const visitLate = event({
    kind: "VISIT",
    title: "VISITA_TARDE",
    time: "09:00",
  });
  const massEarly = event({ title: "MISSA_CEDO", time: "08:00" });
  const massLate = event({ title: "MISSA_TARDE", time: "19:00" });
  const sameTime = event({
    title: "MISSA_OUTRO_LOCAL",
    time: "08:00",
    location: "Capela",
  });
  const events = [visitLate, massLate, sameTime, visitEarly, massEarly];
  const html = renderToStaticMarkup(
    createElement(Calendar, { month: "2030-11", events }),
  );
  const cards = [
    ...html.matchAll(/<a [^>]*class="calendar-event [^>]*>[\s\S]*?<\/a>/g),
  ].map((m) => m[0]);
  assert.equal(cards.length, 5);
  const positions = [massEarly, sameTime, massLate, visitEarly, visitLate].map(
    (e) => cards.findIndex((card) => card.includes(`edit=${e.id}`)),
  );
  assert.ok(positions[0] < positions[1]);
  assert.ok(positions[1] < positions[2]);
  assert.ok(positions[2] < positions[3]);
  assert.ok(positions[3] < positions[4]);
  for (const e of events) {
    const card = cards.find((card) => card.includes(`edit=${e.id}`))!;
    assert.ok(
      card.includes(
        `href="/celebracoes?edit=${e.id}&amp;month=2030-11&amp;calendarView=FULL&amp;eventClass=ALL#cadastro"`,
      ),
    );
    assert.ok(card.includes('aria-label="Editar '));
    assert.ok(card.includes(e.title));
  }
  assert.equal(events[0], visitLate);
});

test("resumo exibe todos os eventos apenas com hora e nome e preserva edição", () => {
  const mass = event({ title: "MISSA_RESUMIDA", time: "19:00" });
  const visit = event({
    title: "VISITA_RESUMIDA",
    kind: "VISIT",
    time: "07:00",
  });
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      month: "2030-11",
      events: [visit, mass],
      view: "SUMMARY",
      impediments: { [mass.id]: ["MINISTRO_OCULTO"] },
    }),
  );
  const cards = [
    ...html.matchAll(/<a [^>]*class="calendar-event [^>]*>[\s\S]*?<\/a>/g),
  ].map((m) => m[0]);
  assert.equal(cards.length, 2);
  assert.ok(cards[0].includes("MISSA_RESUMIDA"));
  assert.ok(cards[1].includes("VISITA_RESUMIDA"));
  for (const card of cards) {
    assert.ok(card.includes("calendarView=SUMMARY"));
    assert.ok(!card.includes("<small"));
    assert.ok(!card.includes("vagas"));
    assert.ok(!card.includes("MINISTRO_OCULTO"));
  }
});
test("modo separado isola missas e visitas com todos os domingos do mês", () => {
  const mass = event({ title: "MISSA_SEPARADA" });
  const visit = event({
    title: "ASSISTIDO_SEPARADO",
    kind: "VISIT",
    time: "07:00",
  });
  const nextMonth = event({
    title: "OUTRO_MES_OCULTO",
    date: "2030-12-01",
    kind: "VISIT",
  });
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      month: "2030-11",
      events: [mass, visit, nextMonth],
      view: "SPLIT",
    }),
  );
  const tables = [...html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)].map(
    (m) => m[0],
  );
  assert.equal(tables.length, 2);
  assert.ok(tables[0].includes("MISSA_SEPARADA"));
  assert.ok(!tables[0].includes("ASSISTIDO_SEPARADO"));
  assert.ok(tables[1].includes("ASSISTIDO_SEPARADO"));
  assert.ok(!tables[1].includes("MISSA_SEPARADA"));
  assert.ok(!html.includes("OUTRO_MES_OCULTO"));
  assert.equal((tables[1].match(/<th /g) ?? []).length, 4);
  for (const day of ["03", "10", "17", "24"])
    assert.ok(tables[1].includes(`Domingo ${day}/11`));
  assert.ok(!tables[1].includes("Segunda"));
  assert.ok(tables[1].includes("calendarView=SPLIT"));
});
test("calendário de assistidos inclui meses com cinco domingos e fevereiro bissexto", () => {
  for (const [month, expected] of [
    ["2030-12", ["01", "08", "15", "22", "29"]],
    ["2032-02", ["01", "08", "15", "22", "29"]],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(Calendar, { month, events: [], view: "VISITS" }),
    );
    assert.equal((html.match(/<th /g) ?? []).length, 5);
    for (const day of expected)
      assert.ok(html.includes(`Domingo ${day}/${month.slice(5)}`));
    assert.equal((html.match(/<td>/g) ?? []).length, 5);
  }
});

test("seletor usa nomes cadastrados sem duplicar ocorrências e filtra pelo nome inteiro", () => {
  const events = [
    event({ title: "Visita Maria" }),
    event({ title: "Missa semanal" }),
    event({ title: " missa   SEMANAL " }),
    event({ title: "Missa semanal especial" }),
  ];
  const options = eventNameOptions(events);
  assert.deepEqual(options, [
    ["missa semanal", "Missa semanal"],
    ["missa semanal especial", "Missa semanal especial"],
    ["visita maria", "Visita Maria"],
  ]);
  assert.equal(
    events.filter((e) => matchesEventName(e, "missa semanal")).length,
    2,
  );
  assert.equal(events.filter((e) => matchesEventName(e, "")).length, 4);
  assert.equal(events.filter((e) => matchesEventName(e, "removido")).length, 0);
  assert.deepEqual(eventNameOptions([]), []);
});
test("card preserva o nome selecionado ao abrir edição nos modos resumido e separado", () => {
  const e = event({ title: "Missa & visita" });
  for (const view of ["SUMMARY", "SPLIT"] as const) {
    const html = renderToStaticMarkup(
      createElement(Calendar, {
        month: "2030-11",
        events: [e],
        view,
        eventName: "missa & visita",
      }),
    );
    assert.ok(html.includes("eventName=missa%20%26%20visita#cadastro"));
  }
});

test("busca encontra a data digitada na imagem tanto em ISO quanto em formato brasileiro", () => {
  const records = [
    event({ date: "2026-12-06" }),
    event({ date: "2026-12-13" }),
    event({ date: "2026-11-06" }),
  ];
  for (const query of ["2026-12-06", "06/12/2026", "  2026-12-06  "]) {
    assert.deepEqual(
      records.filter((e) => matchesEventSearch(e, query)).map((e) => e.date),
      ["2026-12-06"],
    );
  }
  assert.equal(
    records.filter((e) => matchesEventSearch(e, "07/12/2026")).length,
    0,
  );
});
test("busca combina data com nome e horário sem perder o seletor de evento", () => {
  const e = event({
    date: "2026-12-06",
    title: "Missa dominical",
    location: "Capela",
    time: "08:30",
  });
  for (const query of [
    "missa",
    "CAPELA",
    "08:30",
    "dominical 06/12/2026",
    "2026-12-06 08:30 capela",
    "",
    "  ",
  ])
    assert.ok(matchesEventSearch(e, query));
  assert.ok(!matchesEventSearch(e, "2026-12-06 19:00"));
  assert.ok(
    matchesEventName(e, "missa dominical") &&
      matchesEventSearch(e, "2026-12-06"),
  );
  assert.ok(
    !(
      matchesEventName(e, "outro evento") && matchesEventSearch(e, "2026-12-06")
    ),
  );
});
