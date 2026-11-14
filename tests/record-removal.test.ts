import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { emptyData, type Event, type Schedule } from "../src/lib/domain";
import { blankMinister } from "../src/lib/profile";
import {
  planRecordRemoval,
  recordVersion,
  removalSeries,
  executeRecordRemoval,
  type RemovalKind,
} from "../src/lib/record-removal";
import { write, readData } from "../src/lib/store";
const event = (): Event => ({
  id: randomUUID(),
  title: "Registro errado",
  date: "2030-01-06",
  time: "08:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  assistedId: "",
  required: 1,
  notes: "",
  cancelled: true,
});
const form = (kind: RemovalKind, record: { id: string }) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    kind,
    id: record.id,
    expectedVersion: recordVersion(record),
    confirm: "yes",
    reason: "Cadastro incorreto de teste",
  }))
    f.set(k, v);
  return f;
};
const schedule = (e: Event): Schedule => ({
  id: randomUUID(),
  month: "2030-01",
  status: "DRAFT",
  revision: 1,
  events: [e],
  ministers: [],
  assignments: [],
  warnings: [],
});
test("exclusão exige confirmação, motivo e versão atual, e aceita evento errado já cancelado", () => {
  const data = emptyData(),
    e = event();
  data.events = [e];
  const f = form("event", e);
  assert.equal(planRecordRemoval(f, data).id, e.id);
  f.delete("confirm");
  assert.throws(() => planRecordRemoval(f, data), /Confirme/);
  f.set("confirm", "yes");
  f.set("reason", "");
  assert.throws(() => planRecordRemoval(f, data));
  f.set("reason", "Erro de teste");
  data.events[0] = { ...e, title: "Alteração concorrente" };
  assert.throws(() => planRecordRemoval(f, data), /mudou desde que a página/);
  f.set("kind", "invalid");
  assert.throws(() => planRecordRemoval(f, data));
});
test("evento em qualquer revisão, snapshot de agenda ou impedimento mantém histórico", () => {
  const data = emptyData(),
    e = event(),
    f = form("event", e);
  data.events = [e];
  for (const status of [
    "DRAFT",
    "IN_REVIEW",
    "APPROVED",
    "PUBLISHED",
    "CANCELLED",
  ] as const) {
    data.schedules = [{ ...schedule(e), status }];
    assert.throws(() => planRecordRemoval(f, data), /vinculado/);
  }
  data.schedules = [{ ...schedule(e), events: [], agendaEvents: [e] }];
  assert.throws(() => planRecordRemoval(f, data), /vinculado/);
  data.schedules = [];
  data.absences = [
    {
      id: randomUUID(),
      ministerId: randomUUID(),
      scope: "CELEBRATION",
      start: "",
      end: "",
      reason: "",
      eventId: e.id,
    },
  ];
  assert.throws(() => planRecordRemoval(f, data), /impedimento.*vinculado/);
});
test("assistido em visita agrupada, ministro com cônjuge e local legado não são apagados", () => {
  const data = emptyData(),
    id = randomUUID();
  const person = { id, name: "Assistido fictício" } as never;
  data.assisted = [person];
  const e = event();
  data.events = [
    {
      ...e,
      kind: "VISIT",
      assistedId: randomUUID(),
      assistedIds: [id],
    } as Event,
  ];
  assert.throws(
    () => planRecordRemoval(form("assisted", person), data),
    /visita.*cadastrada/,
  );
  const m = blankMinister(randomUUID(), "teste@example.invalid"),
    spouse = {
      ...blankMinister(randomUUID(), "outro@example.invalid"),
      spouseId: m.id,
    };
  data.ministers = [m, spouse];
  assert.throws(() => planRecordRemoval(form("minister", m), data), /vínculo conjugal/);
  data.events = [e];
  const location = { id: randomUUID(), name: "Matriz", active: true };
  data.settings = { ...emptyData().settings!, locations: [location] };
  assert.throws(
    () => planRecordRemoval(form("location", location), data),
    /preferência.*ministro/,
  );
});
test("somente rascunho ou revisão sem aprovação pode ser excluído", () => {
  const data = emptyData(),
    s = schedule(event());
  data.schedules = [s];
  assert.equal(planRecordRemoval(form("schedule", s), data).id, s.id);
  for (const status of ["APPROVED", "PUBLISHED", "CANCELLED"] as const) {
    const protectedSchedule = { ...s, status };
    data.schedules = [protectedSchedule];
    assert.throws(
      () => planRecordRemoval(form("schedule", protectedSchedule), data),
      /cancelamento registrado/,
    );
  }
});
test("exclusão persistida é auditada, transacional e restrita à coordenação", async () => {
  process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);
  const db = new PGlite();
  try {
    for (const f of ["001_initial.sql", "002_access.sql"])
      await db.exec(await readFile(`migrations/${f}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const e = event();
    await write(client, "event", e);
    const data = await readData(client);
    const user = {
      id: "auth0|test",
      email: "test@example.invalid",
      verified: true,
      coordinator: true,
    };
    await assert.rejects(
      executeRecordRemoval(
        client,
        data,
        { ...user, coordinator: false },
        form("event", e),
      ),
      /coordenação/,
    );
    const seriesId = randomUUID();
    const first = { ...event(), seriesId },
      second = {
        ...event(),
        seriesId,
        date: "2030-01-13",
        seriesException: true,
      };
    await write(client, "event", first);
    await write(client, "event", second);
    let seriesData = await readData(client);
    const batch = form("event", first);
    batch.set("removalScope", "FOLLOWING");
    batch.set(
      "expectedSeries",
      recordVersion(removalSeries(first, seriesData.events)),
    );
    seriesData.schedules = [schedule(second)];
    await assert.rejects(
      executeRecordRemoval(client, seriesData, user, batch),
      /vinculado/,
    );
    assert.equal((await readData(client)).events.length, 3);
    seriesData = await readData(client);
    await db.exec("BEGIN");
    await executeRecordRemoval(client, seriesData, user, batch);
    await db.exec("COMMIT");
    assert.equal((await readData(client)).events.length, 1);
    await db.exec("BEGIN");
    await executeRecordRemoval(client, data, user, form("event", e));
    assert.equal((await readData(client)).events.length, 0);
    await db.exec("ROLLBACK");
    assert.equal((await readData(client)).events.length, 1);
    await db.exec("BEGIN");
    await executeRecordRemoval(
      client,
      await readData(client),
      user,
      form("event", e),
    );
    await db.exec("COMMIT");
    assert.equal((await readData(client)).events.length, 0);
    const audit = await db.query<{ action: string; details: string }>(
      "SELECT action,details FROM mesce_audit WHERE record_id=$1",
      [e.id],
    );
    assert.equal(audit.rows[0].action, "event:delete");
    assert.ok(!audit.rows[0].details.includes(e.title));
    await assert.rejects(
      executeRecordRemoval(
        client,
        await readData(client),
        user,
        form("event", e),
      ),
      /inexistente/,
    );
  } finally {
    await db.close();
  }
});
