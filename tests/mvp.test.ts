import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes, createCipheriv } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  addEmails,
  parseEmails,
  completeRegistration,
  findAccess,
  rateLimit,
} from "../src/lib/registration";
import { blankMinister, ownProfile } from "../src/lib/profile";
import {
  generate,
  emptyData,
  validateSchedule,
  requireFuture,
  syncSchedule,
  agendaChanged,
  Minister,
  Event,
  Assisted,
} from "../src/lib/domain";
import { visitGuidePdf, schedulePdf } from "../src/lib/pdf";
import { resolveActor } from "../src/lib/auth";
import { openLegacy } from "../src/lib/legacy";
import {
  previewEnabled,
  passwordMatches,
  createPreviewSession,
  readPreviewSession,
} from "../src/lib/preview-session";
process.env.MESCE_DATA_KEY_HEX = "c".repeat(64);
const m = (extra: Partial<Minister> = {}): Minister => ({
  ...blankMinister(randomUUID(), "synthetic@example.invalid"),
  name: "Pessoa Sintética",
  monthlyLimit: 20,
  ...extra,
});
const e = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Evento Sintético",
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
async function setup() {
  const db = new PGlite();
  for (const name of ["001_initial.sql", "002_access.sql"])
    await db.exec(await readFile("migrations/" + name, "utf8"));
  return {
    db,
    client: {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient,
  };
}
test("allowlist normaliza e deduplica; rejeita formato inválido", () => {
  assert.deepEqual(
    parseEmails(
      " PESSOA@example.invalid ;pessoa@example.invalid;segunda@example.invalid",
    ),
    ["pessoa@example.invalid", "segunda@example.invalid"],
  );
  assert.throws(() => parseEmails("email inválido"));
});
test("login fora da lista e e-mail não verificado não concluem cadastro", async () => {
  const { db, client } = await setup();
  try {
    const user = {
      id: "auth0|synthetic",
      email: "pessoa@example.invalid",
      verified: true,
    };
    await assert.rejects(completeRegistration(client, user, m()));
    await addEmails(client, "coord", [user.email]);
    await assert.rejects(
      completeRegistration(client, { ...user, verified: false }, m()),
    );
  } finally {
    await db.close();
  }
});
test("cadastro usa identidade autenticada, mantém UUID e é idempotente", async () => {
  const { db, client } = await setup();
  try {
    const user = {
      id: "auth0|synthetic",
      email: "pessoa@example.invalid",
      verified: true,
    };
    await addEmails(client, "coord", [user.email, user.email]);
    const access = await findAccess(client, user);
    assert.ok(access);
    const profile = m({ email: "forged@example.invalid", id: randomUUID() });
    const first = await completeRegistration(client, user, profile);
    assert.equal(first.id, access.minister_id);
    assert.equal(first.email, user.email);
    const second = await completeRegistration(client, user, {
      ...profile,
      name: "Outro Nome",
    });
    assert.equal(second.id, first.id);
    assert.equal(second.name, first.name);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM mesce_records",
        )
      ).rows[0].n,
      1,
    );
    const actor = await resolveActor(client, user);
    assert.equal(actor?.ministerId, first.id);
    assert.equal(
      await findAccess(client, { ...user, id: "auth0|other" }),
      undefined,
    );
  } finally {
    await db.close();
  }
});
test("revogação entre login e conclusão impede cadastro; revogação invalida acesso ativo", async () => {
  const { db, client } = await setup();
  try {
    const user = {
      id: "auth0|synthetic",
      email: "pessoa@example.invalid",
      verified: true,
    };
    await addEmails(client, "coord", [user.email]);
    await db.exec("UPDATE mesce_access SET status='REVOKED'");
    await assert.rejects(completeRegistration(client, user, m()));
    await db.exec("UPDATE mesce_access SET status='PENDING'");
    await completeRegistration(client, user, m());
    await db.exec("UPDATE mesce_access SET status='REVOKED'");
    assert.equal(await resolveActor(client, user), null);
  } finally {
    await db.close();
  }
});
test("edição própria ignora tentativa de mudar ID, e-mail, atividade e privilégios", () => {
  const original = m();
  const changed = ownProfile(
    {
      id: randomUUID(),
      email: "forged@example.invalid",
      active: false,
      role: "COORDINATOR",
      name: "Nome Atualizado",
      monthlyLimit: "4",
    },
    original,
  );
  assert.equal(changed.id, original.id);
  assert.equal(changed.email, original.email);
  assert.equal(changed.active, true);
  assert.equal(changed.name, "Nome Atualizado");
  assert.equal(changed.monthlyLimit, 4);
  assert.ok(!("role" in changed));
});
test("agendamentos futuros usam horário de Brasília e preservam leitura de históricos", () => {
  const now = Date.parse("2030-11-03T11:00:00Z");
  assert.throws(() =>
    requireFuture({ date: "2030-11-03", time: "08:00" }, now),
  );
  assert.throws(() =>
    requireFuture({ date: "2030-11-02", time: "23:59" }, now),
  );
  assert.doesNotThrow(() =>
    requireFuture({ date: "2030-11-03", time: "08:01" }, now),
  );
});
test("candidatos escassos têm prioridade para cobrir os dois locais", () => {
  const flexible = m({ id: "00000000-0000-4000-8000-000000000001" }),
    exclusive = m({
      id: "00000000-0000-4000-8000-000000000002",
      locationPreference: "EXCLUSIVE",
    });
  const a = e(),
    b = e({ location: "Capela" });
  const data = {
    ...emptyData(),
    ministers: [flexible, exclusive],
    events: [a, b],
  };
  const result = generate(data, "2030-11");
  assert.equal(result.assignments.length, 2);
  assert.deepEqual(validateSchedule(result, data), []);
});
test("evento publicado que atravessa o mês impede sobreposição", () => {
  const minister = m(),
    previous = e({ date: "2030-10-31", time: "23:30", duration: 120 }),
    next = e({ date: "2030-11-01", time: "00:00" });
  const prior = {
    ...generate(
      { ...emptyData(), ministers: [minister], events: [previous] },
      "2030-10",
    ),
    status: "PUBLISHED" as const,
  };
  const data = {
    ...emptyData(),
    ministers: [minister],
    events: [next],
    schedules: [prior],
  };
  assert.equal(generate(data, "2030-11").assignments.length, 0);
});
test("agenda nova bloqueia aprovação até sincronizar, preservando vagas e designações", () => {
  const minister = m(),
    first = e();
  const data = { ...emptyData(), ministers: [minister], events: [first] };
  const draft = generate(data, "2030-11");
  draft.events[0].required = 2;
  data.events.push(e({ time: "18:00" }));
  assert.ok(agendaChanged(draft, data));
  assert.ok(
    validateSchedule(draft, data).some((e) => e.includes("agenda mudou")),
  );
  const synced = syncSchedule(draft, data);
  assert.equal(synced.events.length, 2);
  assert.equal(synced.events[0].required, 2);
  assert.equal(synced.assignments.length, 1);
  assert.equal(agendaChanged(synced, data), false);
});
test("cancelamento é preservado no histórico e sai da próxima geração", () => {
  const event = e({ cancelled: true });
  assert.equal(
    generate({ ...emptyData(), ministers: [m()], events: [event] }, "2030-11")
      .events.length,
    0,
  );
});
test("PDF geral não transporta título, local ou observações livres de visita", async () => {
  const event = e({
    kind: "VISIT",
    assistedId: randomUUID(),
    title: "TITULO_PRIVADO",
    location: "ENDERECO_PRIVADO",
    notes: "NOTA_PRIVADA",
  });
  const schedule = {
    ...generate(
      { ...emptyData(), ministers: [m()], events: [event] },
      "2030-11",
    ),
    status: "PUBLISHED" as const,
  };
  const doc = await PDFDocument.load(await schedulePdf(schedule));
  const text = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream)
    .map(([, obj]) =>
      Buffer.from(decodePDFRawStream(obj as PDFRawStream).decode()).toString(),
    )
    .join("");
  for (const marker of ["TITULO_PRIVADO", "ENDERECO_PRIVADO", "NOTA_PRIVADA"])
    assert.ok(
      !text.includes(Buffer.from(marker).toString("hex").toUpperCase()),
    );
});
test("limite de tentativas persiste no PostgreSQL", async () => {
  const { db, client } = await setup();
  try {
    await rateLimit(client, "synthetic", 2);
    await rateLimit(client, "synthetic", 2);
    await assert.rejects(rateLimit(client, "synthetic", 2));
  } finally {
    await db.close();
  }
});
test("cifra legada é recuperável com a chave original sem alterar o legado", () => {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.MESCE_DATA_KEY_HEX!, "hex"),
      iv,
    ),
    body = Buffer.concat([
      cipher.update("Pessoa Sintética", "utf8"),
      cipher.final(),
    ]),
    legacy = Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64");
  assert.equal(openLegacy(legacy), "Pessoa Sintética");
});
test("sessão de homologação é cifrada, expira e nunca funciona em Production", () => {
  const previous = { ...process.env };
  process.env.VERCEL_ENV = "preview";
  process.env.MESCE_AUTH_MODE = "bypass";
  process.env.MESCE_DEV_PASSWORD = "test-only-password";
  process.env.MESCE_DEV_SESSION_SECRET =
    "test-only-session-secret-32-characters";
  try {
    assert.ok(previewEnabled());
    assert.ok(passwordMatches("same", "same"));
    assert.equal(passwordMatches("wrong", "same"), false);
    const session = createPreviewSession(1000);
    assert.ok(readPreviewSession(session, 2000));
    assert.equal(readPreviewSession(session, 3601001), null);
    process.env.VERCEL_ENV = "production";
    assert.equal(previewEnabled(), false);
    assert.equal(readPreviewSession(session, 2000), null);
  } finally {
    for (const key of [
      "VERCEL_ENV",
      "MESCE_AUTH_MODE",
      "MESCE_DEV_PASSWORD",
      "MESCE_DEV_SESSION_SECRET",
    ]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("política de não resposta exige consolidação até decisão explícita da coordenação", () => {
  const minister = m(),
    event = e();
  const data = {
    ...emptyData(),
    ministers: [minister],
    events: [event],
    settings: {
      unansweredPolicy: "REVIEW" as const,
      monthlyLimit: 6,
      historyMonths: 12,
    },
    responses: [] as NonNullable<ReturnType<typeof emptyData>["responses"]>,
  };
  assert.equal(generate(data, "2030-11").assignments.length, 0);
  data.responses.push({
    id: randomUUID(),
    ministerId: minister.id,
    month: "2030-11",
    submittedAt: new Date().toISOString(),
  });
  assert.equal(generate(data, "2030-11").assignments.length, 1);
});

test("publicação precisa revalidar impedimentos informados após a aprovação", () => {
  const minister = m(),
    event = e();
  const data = { ...emptyData(), ministers: [minister], events: [event] };
  const approved = {
    ...generate(data, "2030-11"),
    status: "APPROVED" as const,
  };
  data.absences.push({
    id: randomUUID(),
    ministerId: minister.id,
    scope: "DAY",
    start: event.date,
    end: event.date,
    eventId: "",
    reason: "",
  });
  assert.ok(
    validateSchedule(approved, data).some((message) =>
      message.includes("Impedimento"),
    ),
  );
});

test("guia restrito inclui apenas assistidos das visitas atribuídas ao destinatário", async () => {
  const own = m(),
    other = m(),
    first = e({
      id: "00000000-0000-4000-8000-000000000001",
      kind: "VISIT",
      assistedId: randomUUID(),
    }),
    second = e({
      id: "00000000-0000-4000-8000-000000000002",
      kind: "VISIT",
      assistedId: randomUUID(),
    });
  const schedule = {
    ...generate(
      { ...emptyData(), ministers: [own, other], events: [first, second] },
      "2030-11",
    ),
    status: "PUBLISHED" as const,
    assignments: [
      { eventId: first.id, ministerId: own.id },
      { eventId: second.id, ministerId: other.id },
    ],
    assistedSnapshot: [
      {
        id: first.assistedId,
        name: "ASSISTIDO_PROPRIO",
        address: "ENDERECO_PROPRIO",
      },
      {
        id: second.assistedId,
        name: "ASSISTIDO_TERCEIRO",
        address: "ENDERECO_TERCEIRO",
      },
    ] as Assisted[],
  };
  const doc = await PDFDocument.load(await visitGuidePdf(schedule, own.id));
  const streams = doc.context
    .enumerateIndirectObjects()
    .filter(([, o]) => o instanceof PDFRawStream)
    .map(([, o]) =>
      Buffer.from(decodePDFRawStream(o as PDFRawStream).decode()).toString(),
    )
    .join("");
  assert.ok(
    streams.includes(
      Buffer.from("ENDERECO_PROPRIO").toString("hex").toUpperCase(),
    ),
  );
  assert.ok(
    !streams.includes(
      Buffer.from("ENDERECO_TERCEIRO").toString("hex").toUpperCase(),
    ),
  );
});
