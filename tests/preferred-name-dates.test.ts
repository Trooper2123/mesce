import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  blankMinister,
  ownProfile,
  requireCompleteMinister,
} from "../src/lib/profile";
import {
  ministerSchema,
  emptyData,
  generate,
  syncSchedule,
  type Event,
} from "../src/lib/domain";
import { ministerDisplayName } from "../src/lib/minister-name";
import { planEventSave } from "../src/lib/event-agenda";
import { planMinisterCsv } from "../src/lib/minister-csv";
import { schedulePdf } from "../src/lib/pdf";
import { write, readData } from "../src/lib/store";
import { MultiDatePicker } from "../src/components/multi-date-picker";
const event = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Missa semanal",
  date: "2030-11-03",
  time: "08:00",
  duration: 60,
  required: 1,
  location: "Matriz",
  kind: "MASS",
  assistedId: "",
  notes: "",
  eventClass: "FIXED",
  ...extra,
});
function batch(e: Event, dates: string[]) {
  const f = new FormData();
  for (const [key, value] of Object.entries(e))
    if (value !== undefined) f.set(key, String(value));
  f.set("kind", "event");
  f.set("eventKind", e.kind);
  f.set("dateMode", "MULTIPLE");
  f.set("occurrences", "1");
  for (const date of dates) f.append("dates", date);
  return f;
}
const now = Date.parse("2026-11-11T12:00:00Z");
test("nome de preferência é opcional, pode ser editado pelo ministro e preserva nome completo", () => {
  const original = {
    ...blankMinister(randomUUID(), "nome@example.invalid"),
    name: "HELENA_NOME_COMPLETO",
  };
  const changed = ownProfile({ preferredName: "  Lena  " }, original);
  assert.equal(changed.name, original.name);
  assert.equal(changed.preferredName, "Lena");
  assert.equal(ministerDisplayName(changed), "Lena");
  assert.equal(
    ministerDisplayName(ownProfile({ preferredName: "" }, changed)),
    original.name,
  );
  assert.equal(ministerDisplayName({ name: "Nome legado" }), "Nome legado");
  assert.throws(() =>
    ministerSchema.parse({ ...changed, preferredName: "a".repeat(81) }),
  );
  const complete = requireCompleteMinister({
    ...changed,
    birthDate: "1980-01-01",
    phone: "61000000000",
    ministryStart: "2020-01-01",
    address: "Rua teste",
    neighborhood: "Teste",
    city: "Brasília",
    state: "DF",
  });
  assert.equal(complete.registrationStatus, "COMPLETE");
});
test("escala e PDF usam o nome escolhido e mantêm a versão anterior imutável", async () => {
  const m = {
    ...blankMinister(randomUUID(), "nome@example.invalid"),
    name: "HELENA_NOME_COMPLETO",
    preferredName: "Lena",
    registrationStatus: "COMPLETE" as const,
  };
  const data = { ...emptyData(), ministers: [m], events: [event()] };
  const s = generate(data, "2030-11");
  s.status = "PUBLISHED";
  assert.equal(s.ministers[0].name, "Lena");
  const doc = await PDFDocument.load(await schedulePdf(s));
  const streams = doc.context
    .enumerateIndirectObjects()
    .filter(([, o]) => o instanceof PDFRawStream)
    .map(([, o]) =>
      Buffer.from(decodePDFRawStream(o as PDFRawStream).decode()).toString(),
    )
    .join("");
  assert.ok(
    streams.includes(Buffer.from("Lena").toString("hex").toUpperCase()),
  );
  assert.ok(
    !streams.includes(Buffer.from(m.name).toString("hex").toUpperCase()),
  );
  data.ministers[0] = { ...m, preferredName: "Helena" };
  assert.equal(syncSchedule(s, data).ministers[0].name, "Helena");
  assert.equal(s.ministers[0].name, "Lena");
  assert.equal(data.ministers[0].name, "HELENA_NOME_COMPLETO");
});
test("CSV aceita nome_preferencia e arquivos antigos não apagam a preferência existente", () => {
  const m = {
    ...blankMinister(randomUUID(), "nome@example.invalid"),
    name: "Helena Exemplo",
    preferredName: "Lena",
  };
  const plan = planMinisterCsv(
    "nome;email;nome_preferencia\nHelena Exemplo;nome@example.invalid;Helena\n",
    [m],
    true,
  );
  assert.equal(plan.ministers[0].preferredName, "Helena");
  const legacy = planMinisterCsv(
    "nome;email\nHelena Exemplo;nome@example.invalid\n",
    [m],
    true,
  );
  assert.equal(legacy.ministers[0].preferredName, "Lena");
});
test("várias datas, inclusive em meses diferentes, geram um encontro por data sem duplicar seleção", () => {
  const e = event();
  const result = planEventSave(
    batch(e, ["2030-12-01", "2030-11-03", "2030-11-17", "2030-11-03"]),
    e.id,
    emptyData(),
    now,
  );
  assert.deepEqual(
    result.map((e) => e.date),
    ["2030-11-03", "2030-11-17", "2030-12-01"],
  );
  assert.equal(new Set(result.map((e) => e.id)).size, 3);
  assert.ok(
    result.every(
      (e) =>
        e.title === "Missa semanal" &&
        e.time === "08:00" &&
        e.location === "Matriz",
    ),
  );
  assert.equal(new Set(result.map((e) => e.seriesId)).size, 1);
});
test("lote rejeita datas impossíveis/passadas, mistura com recorrência e edição de múltiplas ocorrências", () => {
  const e = event();
  for (const dates of [
    [],
    ["2030-02-30"],
    ["2030-11-03", "2020-01-01"],
    Array.from({ length: 54 }, () => "2030-11-03"),
  ])
    assert.throws(() => planEventSave(batch(e, dates), e.id, emptyData(), now));
  const f = batch(e, ["2030-11-03", "2030-11-17"]);
  f.set("occurrences", "2");
  assert.throws(() => planEventSave(f, e.id, emptyData(), now), /sem combinar/);
  assert.throws(
    () =>
      planEventSave(
        batch(e, [e.date]),
        e.id,
        { ...emptyData(), events: [e] },
        now,
      ),
    /Edite apenas/,
  );
});
test("calendário de seleção marca dias e envia todas as datas, preservando escolhas de outros meses", () => {
  const markup = renderToStaticMarkup(
    createElement(MultiDatePicker, {
      value: ["2030-11-03", "2030-12-01"],
      initialMonth: "2030-11",
      onChange: () => {},
    }),
  );
  assert.ok(markup.includes('aria-label="03/11/2030" aria-pressed="true"'));
  assert.ok(markup.includes('name="dates" value="2030-11-03"'));
  assert.ok(markup.includes('name="dates" value="2030-12-01"'));
  assert.ok(markup.includes("2 data(s) selecionada(s)"));
});
test("persistência cifrada grava todo o lote e preserva preferência do cadastro", async () => {
  process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "002_access.sql"])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const m = {
      ...blankMinister(randomUUID(), "nome@example.invalid"),
      name: "Helena Exemplo",
      preferredName: "Lena",
    };
    await write(client, "minister", m);
    const e = event();
    await db.exec("BEGIN");
    const planned = planEventSave(
      batch(e, ["2030-11-03", "2030-11-17"]),
      e.id,
      await readData(client),
      now,
    );
    for (const item of planned) await write(client, "event", item);
    await db.exec("COMMIT");
    assert.equal((await readData(client)).events.length, 2);
    assert.equal((await readData(client)).ministers[0].preferredName, "Lena");
    await db.exec("BEGIN");
    let rejected = false;
    try {
      for (const item of planEventSave(
        batch(event(), ["2030-11-10", "2030-02-30"]),
        randomUUID(),
        await readData(client),
        now,
      ))
        await write(client, "event", item);
      await db.exec("COMMIT");
    } catch {
      await db.exec("ROLLBACK");
      rejected = true;
    }
    assert.ok(rejected, "Lote inválido deve ser rejeitado");
    assert.equal((await readData(client)).events.length, 2);
  } finally {
    await db.close();
  }
});
