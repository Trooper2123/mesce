import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import {
  emptyData,
  impeded,
  generate,
  syncSchedule,
  type Event,
  type Absence,
} from "../src/lib/domain";
import { blankMinister } from "../src/lib/profile";
import {
  planAbsenceWithdrawal,
  planEventChange,
} from "../src/lib/operational-changes";
import { operationalReport } from "../src/lib/reports";
import { notificationsFor } from "../src/lib/notifications";
import { validateAbsenceSubmission } from "../src/lib/absence-input";
import type { Identity } from "../src/lib/access";
import { readData, write, audit } from "../src/lib/store";
const now = new Date("2026-11-20T12:00:00Z");
const admin: Identity = {
  id: "admin",
  email: "coord@example.invalid",
  verified: true,
  coordinator: true,
};
function fixture() {
  const data = emptyData();
  const minister = {
    ...blankMinister(randomUUID(), "teste@example.invalid"),
    registrationStatus: "COMPLETE" as const,
  };
  data.ministers = [minister];
  const seriesId = randomUUID();
  const make = (date: string): Event => ({
    id: randomUUID(),
    title: "Missa teste",
    date,
    time: "08:00",
    duration: 60,
    required: 1,
    kind: "MASS",
    location: "Matriz",
    assistedId: "",
    notes: "",
    seriesId,
  });
  data.events = [make("2026-12-06"), make("2026-12-13"), make("2026-12-20")];
  const absence: Absence = {
    id: randomUUID(),
    ministerId: minister.id,
    scope: "CELEBRATION",
    eventId: data.events[0].id,
    start: "",
    end: "",
    reason: "Teste",
  };
  data.absences = [absence];
  const user: Identity = {
    ...admin,
    id: "member",
    coordinator: false,
    ministerId: minister.id,
  };
  return { data, minister, absence, user };
}
function form(
  e: Event,
  operation = "RESCHEDULE",
  scope = "ONE",
  date = "2026-12-07",
) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    id: e.id,
    operation,
    scope,
    date,
    time: "09:30",
    reason: "Ajuste solicitado",
    expectedDate: e.date,
    expectedTime: e.time,
  }))
    f.set(k, v);
  return f;
}
test("retirada auditável preserva o registro e libera o impedimento sem reescrever publicação", () => {
  const { data, absence, user } = fixture();
  const snapshot = generate(data, "2026-12");
  data.schedules = [snapshot];
  const previous = JSON.stringify(snapshot);
  assert.ok(impeded(user.ministerId!, data.events[0], data.absences));
  const revoked = planAbsenceWithdrawal(
    absence.id,
    "Disponibilidade corrigida",
    user,
    data,
    now,
  );
  data.absences = [revoked];
  assert.equal(revoked.id, absence.id);
  assert.equal(revoked.revokedBy, user.id);
  assert.ok(!impeded(user.ministerId!, data.events[0], data.absences));
  assert.equal(JSON.stringify(snapshot), previous);
  assert.throws(
    () => validateAbsenceSubmission({ ...absence }, user, data, now),
    /retirado/,
  );
});
test("retirada respeita titular, verificação, dia 25 e competência; coordenação pode excepcionalizar", () => {
  const { data, absence, user } = fixture();
  assert.throws(() =>
    planAbsenceWithdrawal(
      absence.id,
      "Teste",
      { ...user, ministerId: randomUUID() },
      data,
      now,
    ),
  );
  assert.throws(() =>
    planAbsenceWithdrawal(
      absence.id,
      "Teste",
      { ...user, verified: false },
      data,
      now,
    ),
  );
  assert.throws(
    () =>
      planAbsenceWithdrawal(
        absence.id,
        "Teste",
        user,
        data,
        new Date("2026-11-26T12:00:00Z"),
      ),
    /prazo/,
  );
  assert.throws(
    () =>
      planAbsenceWithdrawal(
        absence.id,
        "Teste",
        user,
        data,
        new Date("2026-12-01T12:00:00Z"),
      ),
    /prazo/,
  );
  assert.ok(
    planAbsenceWithdrawal(
      absence.id,
      "Exceção autorizada",
      admin,
      data,
      new Date("2026-12-01T12:00:00Z"),
    ),
  );
  assert.throws(() => planAbsenceWithdrawal(absence.id, " ", user, data, now));
});
test("retirada de dia e período deixa de bloquear todos os dias correspondentes", () => {
  for (const scope of ["DAY", "PERIOD"] as const) {
    const { data, absence, user } = fixture();
    const a = {
      ...absence,
      scope,
      start: "2026-12-06",
      end: scope === "DAY" ? "2026-12-06" : "2026-12-20",
      eventId: "",
    };
    data.absences = [a];
    assert.ok(impeded(user.ministerId!, data.events[0], data.absences));
    data.absences = [
      planAbsenceWithdrawal(a.id, "Livre novamente", user, data, now),
    ];
    assert.ok(!impeded(user.ministerId!, data.events[0], data.absences));
  }
});
test("remarcar só uma ocorrência mantém ID, as demais datas e impedimentos específicos", () => {
  const { data, absence, user } = fixture();
  const before = JSON.stringify(data);
  const plan = planEventChange(form(data.events[0]), data, now.getTime());
  assert.equal(plan.events.length, 1);
  assert.equal(plan.events[0].date, "2026-12-07");
  assert.equal(plan.events[0].id, data.events[0].id);
  assert.equal(plan.events[0].seriesException, true);
  assert.ok(impeded(user.ministerId!, plan.events[0], [absence]));
  assert.equal(JSON.stringify(data), before);
});
test("alteração da série preserva exceções individuais, exclusões e ocorrências anteriores", () => {
  const { data } = fixture();
  data.events[2].seriesException = true;
  const plan = planEventChange(
    form(data.events[0], "RESCHEDULE", "FOLLOWING"),
    data,
    now.getTime(),
  );
  assert.deepEqual(
    plan.events.map((e) => e.date),
    ["2026-12-07", "2026-12-14"],
  );
  const f = form(data.events[0], "CANCEL", "FOLLOWING");
  f.append("exclude", data.events[1].id);
  assert.deepEqual(
    planEventChange(f, data, now.getTime()).events.map((e) => e.id),
    [data.events[0].id],
  );
  assert.equal(
    planEventChange(
      form(data.events[1], "CANCEL", "FOLLOWING"),
      data,
      now.getTime(),
    ).events.length,
    1,
  );
});
test("série rejeita lote com data inválida, domingo de visita inválido, alvo passado e tela desatualizada", () => {
  const { data } = fixture();
  assert.throws(() =>
    planEventChange(
      form(data.events[0], "RESCHEDULE", "FOLLOWING", "2026-02-30"),
      data,
      now.getTime(),
    ),
  );
  assert.throws(() =>
    planEventChange(
      form(data.events[0], "RESCHEDULE", "FOLLOWING", "2026-11-01"),
      data,
      now.getTime(),
    ),
  );
  const f = form(data.events[0]);
  f.set("expectedTime", "07:00");
  assert.throws(() => planEventChange(f, data, now.getTime()), /mudou/);
  data.events[0] = {
    ...data.events[0],
    kind: "VISIT",
    assistedId: randomUUID(),
  };
  assert.throws(
    () => planEventChange(form(data.events[0]), data, now.getTime()),
    /domingo/,
  );
});
test("cancelamento remove evento da nova escala e gera aviso somente a responsáveis publicados", () => {
  const { data, user } = fixture();
  data.absences = [];
  const published = generate(data, "2026-12");
  published.status = "PUBLISHED";
  data.schedules = [published];
  const before = JSON.stringify(published);
  const updated = planEventChange(
    form(data.events[0], "CANCEL"),
    data,
    now.getTime(),
  ).events[0];
  data.events[0] = updated;
  const notices = notificationsFor(data, user, now.getTime());
  assert.ok(
    notices.some(
      (n) => n.type === "EVENT_CHANGE" && n.title.includes("cancelado"),
    ),
  );
  assert.ok(
    !notificationsFor(
      data,
      { ...user, ministerId: randomUUID() },
      now.getTime(),
    ).some((n) => n.type === "EVENT_CHANGE"),
  );
  assert.ok(!generate(data, "2026-12").events.some((e) => e.id === updated.id));
  assert.ok(
    !syncSchedule({ ...published, status: "DRAFT" }, data).assignments.some(
      (a) => a.eventId === updated.id,
    ),
  );
  assert.equal(JSON.stringify(published), before);
  assert.ok(!JSON.stringify(notices).includes("Matriz"));
});
test("PostgreSQL persiste retirada e alteração da série em transação com auditoria e rollback", async () => {
  process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "002_access.sql"])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const { data, absence, user } = fixture();
    for (const e of data.events) await write(client, "event", e);
    await write(client, "absence", absence);
    await write(client, "minister", data.ministers[0]);
    await db.exec("BEGIN");
    const revoked = planAbsenceWithdrawal(
      absence.id,
      "Livre novamente",
      user,
      data,
      now,
    );
    await write(client, "absence", revoked);
    await audit(client, user.id, "absence:withdraw", absence.id, {
      before: absence,
      after: revoked,
    });
    const plan = planEventChange(
      form(data.events[0], "CANCEL", "FOLLOWING"),
      data,
      now.getTime(),
    );
    for (const e of plan.events) {
      await write(client, "event", e);
      await audit(client, admin.id, "event:cancel", e.id, {
        reason: plan.reason,
      });
    }
    await db.exec("COMMIT");
    const saved = await readData(client);
    assert.ok(saved.absences[0].revokedAt);
    assert.equal(saved.events.filter((e) => e.cancelled).length, 3);
    await db.exec("BEGIN");
    await write(client, "event", { ...saved.events[0], cancelled: false });
    await db.exec("ROLLBACK");
    assert.equal(
      (await readData(client)).events.filter((e) => e.cancelled).length,
      3,
    );
    assert.equal(
      Number(
        (
          await db.query<{ count: string }>(
            "SELECT count(*) AS count FROM mesce_audit",
          )
        ).rows[0].count,
      ),
      4,
    );
  } finally {
    await db.close();
  }
});

test("remarcação avisa responsáveis sem revelar assistido e suprime lembrete do horário antigo", () => {
  const { data, user } = fixture();
  data.absences = [];
  const published = generate(data, "2026-12");
  published.status = "PUBLISHED";
  data.schedules = [published];
  const currentTime = Date.parse("2026-12-01T12:00:00Z");
  const f = form(data.events[0], "RESCHEDULE", "ONE", "2026-12-07");
  data.events[0] = planEventChange(f, data, currentTime).events[0];
  const notices = notificationsFor(data, user, currentTime);
  assert.ok(
    notices.some(
      (n) => n.type === "EVENT_CHANGE" && n.description.includes("2026-12-07"),
    ),
  );
  assert.ok(
    !notices.some(
      (n) => n.type === "REMINDER" && n.description.includes("2026-12-06"),
    ),
  );
  assert.equal(notices.filter((n) => n.type === "EVENT_CHANGE").length, 1);
});
test("relatório operacional exclui cancelamento corrente sem alterar o snapshot publicado", () => {
  const { data } = fixture();
  data.absences = [];
  const published = generate(data, "2026-12");
  published.status = "PUBLISHED";
  data.schedules = [published];
  const before = JSON.stringify(published);
  assert.equal(operationalReport(data, "2026-12", 1).events.length, 3);
  data.events[0] = planEventChange(
    form(data.events[0], "CANCEL"),
    data,
    now.getTime(),
  ).events[0];
  assert.equal(operationalReport(data, "2026-12", 1).events.length, 2);
  assert.equal(JSON.stringify(published), before);
});
test("série não toca passado e rejeita exclusão de evento alheio ou da própria âncora", () => {
  const { data } = fixture();
  data.events.push({ ...data.events[0], id: randomUUID(), date: "2026-11-01" });
  const f = form(data.events[0], "CANCEL", "FOLLOWING");
  assert.equal(planEventChange(f, data, now.getTime()).events.length, 3);
  f.append("exclude", randomUUID());
  assert.throws(() => planEventChange(f, data, now.getTime()), /Exceção/);
  f.delete("exclude");
  f.append("exclude", data.events[0].id);
  assert.throws(() => planEventChange(f, data, now.getTime()), /selecionada/);
});
