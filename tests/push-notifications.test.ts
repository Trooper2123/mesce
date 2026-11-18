import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import {
  endpointHash,
  enqueuePublishedAgenda,
  enqueueScheduledPushNotifications,
  savePushSubscription,
} from "../src/lib/agenda-delivery";
import { decrypt, encrypt } from "../src/lib/crypto";
import type { Data, Event, Minister, Schedule } from "../src/lib/domain";

process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);

const minister = (id: string, name: string): Minister => ({
  id,
  name,
  email: "",
  birthDate: "",
  phone: "",
  ministryStart: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  active: true,
  monthlyLimit: null,
  spouseId: "",
  couplePreference: "NONE",
  location: "",
  locationPreference: "ACCEPT",
  notes: "",
});

const event = (): Event => ({
  id: randomUUID(),
  title: "Celebração privada",
  date: "2099-01-04",
  time: "19:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  required: 1,
  assistedId: "",
  notes: "",
});

const schedule = (
  id: string,
  occurrence: Event,
  ministerId: string,
): Schedule => ({
  id,
  month: "2099-01",
  status: "PUBLISHED",
  revision: 1,
  assignments: [{ eventId: occurrence.id, ministerId }],
  events: [occurrence],
  ministers: [],
  warnings: [],
});

test("push enfileira somente o titular afetado e não duplica republicação", async () => {
  process.env.MESCE_DELIVERY_OUTBOX_ENABLED = "true";
  process.env.MESCE_PUSH_ENABLED = "true";
  const db = new PGlite();
  try {
    for (const file of [
      "001_initial.sql",
      "002_access.sql",
      "005_delivery_outbox.sql",
    ])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const ministerA = minister(randomUUID(), "Ministro A");
    const ministerB = minister(randomUUID(), "Ministro B");
    const occurrence = event();
    const previous = schedule(randomUUID(), occurrence, ministerA.id);
    const current = {
      ...schedule(randomUUID(), { ...occurrence, time: "20:00" }, ministerA.id),
      revision: 2,
    };
    const data: Data = {
      ministers: [ministerA, ministerB],
      assisted: [],
      events: [occurrence],
      absences: [],
      schedules: [previous],
    };
    for (const owner of [ministerA, ministerB])
      await client.query(
        `INSERT INTO mesce_push_subscriptions
           (id,minister_id,auth0_sub,endpoint_hash,payload)
         VALUES($1,$2,$3,$4,$5)`,
        [
          randomUUID(),
          owner.id,
          `auth0|${owner.id}`,
          endpointHash(`https://push.example/${owner.id}`),
          encrypt({ endpoint: `https://push.example/${owner.id}` }),
        ],
      );

    await enqueuePublishedAgenda(client, data, current, "https://mesce.test");
    await enqueuePublishedAgenda(client, data, current, "https://mesce.test");

    const queued = await db.query<{
      minister_id: string;
      payload: string;
      status: string;
    }>("SELECT minister_id,payload,status FROM mesce_outbox");
    assert.equal(queued.rows.length, 1);
    assert.equal(queued.rows[0].minister_id, ministerA.id);
    assert.equal(queued.rows[0].status, "PENDING");
    const payload = decrypt(queued.rows[0].payload) as Record<string, unknown>;
    assert.equal(payload.url, "/minhas-escalas");
    assert.ok(!JSON.stringify(payload).includes(occurrence.title));
    assert.ok(!JSON.stringify(payload).includes(ministerB.name));
  } finally {
    await db.close();
  }
});

test("push diário lembra prazo pendente e atividades do ministro sem duplicar", async () => {
  process.env.MESCE_DELIVERY_OUTBOX_ENABLED = "true";
  process.env.MESCE_PUSH_ENABLED = "true";
  const db = new PGlite();
  try {
    for (const file of [
      "001_initial.sql",
      "002_access.sql",
      "005_delivery_outbox.sql",
      "006_scheduled_push.sql",
    ])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const owner = minister(randomUUID(), "Ministro A");
    const occurrence = { ...event(), date: "2099-01-24" };
    const subscriptionId = randomUUID();
    await client.query(
      `INSERT INTO mesce_access(id,auth0_sub,minister_id,status)
       VALUES($1,$2,$3,'ACTIVE')`,
      [randomUUID(), `auth0|${owner.id}`, owner.id],
    );
    await client.query(
      `INSERT INTO mesce_push_subscriptions
         (id,minister_id,auth0_sub,endpoint_hash,payload)
       VALUES($1,$2,$3,$4,$5)`,
      [
        subscriptionId,
        owner.id,
        `auth0|${owner.id}`,
        endpointHash(`https://push.example/${owner.id}`),
        encrypt({ endpoint: `https://push.example/${owner.id}` }),
      ],
    );
    const data: Data = {
      ministers: [owner],
      assisted: [],
      events: [occurrence],
      absences: [],
      schedules: [schedule(randomUUID(), occurrence, owner.id)],
      responses: [],
    };
    const now = new Date("2099-01-24T12:00:00-03:00");

    await enqueueScheduledPushNotifications(client, data, now);
    await enqueueScheduledPushNotifications(client, data, now);

    const queued = await db.query<{ payload: string }>(
      "SELECT payload FROM mesce_outbox ORDER BY created_at,id",
    );
    assert.equal(queued.rows.length, 2);
    const payloads = queued.rows.map(
      (row) => decrypt(row.payload) as { title: string },
    );
    assert.deepEqual(
      payloads.map((payload) => payload.title).sort(),
      ["Prazo para informar impedimentos", "Você tem atividades hoje"].sort(),
    );
  } finally {
    await db.close();
  }
});

test("hash do endpoint é estável, secreto e depende da chave do ambiente", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/synthetic";
  const first = endpointHash(endpoint);
  assert.equal(first, endpointHash(endpoint));
  assert.ok(!first.includes("synthetic"));
  process.env.MESCE_DATA_KEY_HEX = "c".repeat(64);
  assert.notEqual(endpointHash(endpoint), first);
  process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);
});

test("endpoint revogado pode passar ao novo perfil, mas endpoint ativo não pode ser tomado", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("migrations/005_delivery_outbox.sql", "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/shared-device",
      keys: { p256dh: "p".repeat(65), auth: "a".repeat(24) },
    };
    const firstId = await savePushSubscription(client, {
      id: randomUUID(),
      ministerId: randomUUID(),
      auth0Sub: "preview-coordinator",
      subscription,
    });
    await assert.rejects(
      savePushSubscription(client, {
        id: randomUUID(),
        ministerId: randomUUID(),
        auth0Sub: "preview-minister-a",
        subscription,
      }),
      /outra conta/,
    );
    await db.query(
      "UPDATE mesce_push_subscriptions SET revoked_at=now() WHERE id=$1",
      [firstId],
    );
    const ministerA = randomUUID();
    assert.equal(
      await savePushSubscription(client, {
        id: randomUUID(),
        ministerId: ministerA,
        auth0Sub: "preview-minister-a",
        subscription,
      }),
      firstId,
    );
    const owner = await db.query<{ minister_id: string; auth0_sub: string }>(
      "SELECT minister_id,auth0_sub FROM mesce_push_subscriptions WHERE id=$1",
      [firstId],
    );
    assert.equal(owner.rows[0].minister_id, ministerA);
    assert.equal(owner.rows[0].auth0_sub, "preview-minister-a");
  } finally {
    await db.close();
  }
});
