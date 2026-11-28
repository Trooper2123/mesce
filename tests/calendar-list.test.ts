import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Calendar } from "../src/components/calendar";
import type { Event } from "../src/lib/domain";

Object.assign(globalThis, { React });

test("lista de impedimentos mostra pessoas, eventos sem impedimentos e acesso direto ao formulário", () => {
  const event: Event = {
    id: "event-1",
    date: "2026-12-01",
    time: "19:00",
    duration: 60,
    title: "Missa semanal",
    kind: "MASS",
    assistedId: "",
    notes: "",
    location: "Matriz",
    required: 1,
  };
  const html = renderToStaticMarkup(
    React.createElement(Calendar, {
      month: "2026-12",
      view: "LIST",
      eventAction: "ABSENCE",
      events: [event, { ...event, id: "event-2", date: "2026-12-02" }],
      impediments: { "event-1": ["Ministro de teste"] },
    }),
  );
  assert.match(html, /Ministro de teste/);
  assert.match(html, /Sem impedimentos/);
  assert.match(html, /dateTime="2026-12-01"/);
  assert.match(html, /new=1&amp;eventId=event-1#cadastro/);
  assert.match(html, /Registrar ausência/);
  assert.ok(!html.includes("<table"));
});

test("lista de impedimentos informa mês sem eventos", () => {
  const html = renderToStaticMarkup(
    React.createElement(Calendar, {
      month: "2026-12",
      view: "LIST",
      events: [],
    }),
  );
  assert.match(html, /Nenhum evento neste mês/);
});
