import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Data, Event, Schedule } from "./domain";
import { eventInstant, latestPublished } from "./domain";
import { decrypt, encrypt } from "./crypto";
import { calendarUid } from "./personal-calendar";
import type { InviteEvent, InviteMethod } from "./calendar-invite";
import { buildCalendarInvite } from "./calendar-invite";
import nodemailer from "nodemailer";
import { sendNotification, setVapidDetails } from "web-push";
import type { PushSubscription } from "web-push";
import { pool } from "./store";

type InviteSnapshot = {
  recipient: string;
  recipientHash: string;
  event: InviteEvent;
  sequence: number;
  mailStatus: string;
};

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const enabled = (name: string) => process.env[name] === "true";

function inviteEvent(event: Event): InviteEvent {
  return {
    id: event.id,
    date: event.date,
    time: event.time,
    duration: event.duration,
    kind: event.kind,
    location: event.kind === "VISIT" ? "" : event.location,
  };
}

function fingerprint(event: InviteEvent, recipientHash: string) {
  return hash(
    JSON.stringify({
      event: {
        date: event.date,
        time: event.time,
        duration: event.duration,
        kind: event.kind,
        location: event.location,
      },
      recipientHash,
    }),
  );
}

async function enqueue(
  client: PoolClient,
  value: {
    channel: "EMAIL" | "PUSH";
    method?: InviteMethod;
    ministerId: string;
    scheduleId: string;
    sequence: number;
    deliveryKey: string;
    dedupeKey: string;
    payload: unknown;
  },
) {
  await client.query(
    `INSERT INTO mesce_outbox
       (id,dedupe_key,delivery_key,channel,method,minister_id,schedule_id,sequence,payload,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING')
     ON CONFLICT(dedupe_key) DO NOTHING`,
    [
      randomUUID(),
      value.dedupeKey,
      value.deliveryKey,
      value.channel,
      value.method ?? null,
      value.ministerId,
      value.scheduleId,
      value.sequence,
      encrypt(value.payload),
    ],
  );
}

async function activeEmailOwners(client: PoolClient, ministerIds: string[]) {
  if (!ministerIds.length)
    return new Map<string, { email: string; emailHash: string }>();
  const result = await client.query(
    `SELECT a.minister_id,a.email_ciphertext,a.email_hmac
     FROM mesce_access a
     JOIN mesce_delivery_preferences p
       ON p.minister_id=a.minister_id AND p.auth0_sub=a.auth0_sub
     WHERE a.minister_id=ANY($1::uuid[]) AND a.status='ACTIVE'
       AND a.email_ciphertext IS NOT NULL AND a.email_hmac IS NOT NULL
       AND p.email_enabled=true`,
    [ministerIds],
  );
  const owners = new Map<string, { email: string; emailHash: string }>();
  for (const row of result.rows) {
    const email = decrypt(row.email_ciphertext) as string;
    owners.set(String(row.minister_id), {
      email,
      emailHash: String(row.email_hmac).trim(),
    });
  }
  return owners;
}

function activeScheduleForMonth(data: Data, month: string) {
  return latestPublished(data).find((schedule) => schedule.month === month);
}

function assignmentEvents(schedule: Schedule | undefined) {
  const result = new Map<string, Map<string, InviteEvent>>();
  if (!schedule) return result;
  for (const assignment of schedule.assignments) {
    const source = schedule.events.find(
      (event) => event.id === assignment.eventId,
    );
    if (!source || source.cancelled || eventInstant(source) <= Date.now())
      continue;
    const event = inviteEvent(source);
    const assigned = result.get(assignment.ministerId) ?? new Map();
    assigned.set(event.id, event);
    result.set(assignment.ministerId, assigned);
  }
  return result;
}

async function enqueueEmailDelta(
  client: PoolClient,
  month: string,
  previous: Schedule | undefined,
  current: Schedule | undefined,
  scheduleId: string,
  applicationUrl: string,
) {
  if (!enabled("MESCE_EMAIL_SEND_ENABLED")) return;
  const states = await client.query(
    `SELECT minister_id,event_id,sequence,fingerprint,state,mail_status,payload
     FROM mesce_calendar_delivery_state WHERE month=$1 FOR UPDATE`,
    [month],
  );
  const existing = new Map(
    states.rows.map((row) => [`${row.minister_id}:${row.event_id}`, row]),
  );
  const desired = assignmentEvents(current);
  const ministerIds = new Set<string>([
    ...desired.keys(),
    ...states.rows.map((row) => String(row.minister_id)),
  ]);
  const owners = await activeEmailOwners(client, [...ministerIds]);
  const processed = new Set<string>();

  for (const [ministerId, events] of desired) {
    const owner = owners.get(ministerId);
    if (!owner) continue;
    for (const event of events.values()) {
      const key = `${ministerId}:${event.id}`;
      const row = existing.get(key);
      const prior = row ? (decrypt(row.payload) as InviteSnapshot) : undefined;
      const nextFingerprint = fingerprint(event, owner.emailHash);
      if (
        row?.state === "ACTIVE" &&
        String(row.fingerprint).trim() === nextFingerprint &&
        row.mail_status !== "NONE"
      ) {
        processed.add(key);
        continue;
      }

      let sequence = row ? Number(row.sequence) + 1 : 1;
      if (
        row?.state === "ACTIVE" &&
        prior &&
        prior.recipientHash !== owner.emailHash
      ) {
        const cancelSequence = sequence;
        await enqueueInvite(
          client,
          scheduleId,
          ministerId,
          prior,
          cancelSequence,
          "CANCEL",
          applicationUrl,
        );
        sequence++;
      }
      const next: InviteSnapshot = {
        recipient: owner.email,
        recipientHash: owner.emailHash,
        event,
        sequence,
        mailStatus: "PENDING",
      };
      await enqueueInvite(
        client,
        scheduleId,
        ministerId,
        next,
        sequence,
        "REQUEST",
        applicationUrl,
      );
      await client.query(
        `INSERT INTO mesce_calendar_delivery_state
           (minister_id,event_id,month,sequence,fingerprint,state,mail_status,payload)
         VALUES($1,$2,$3,$4,$5,'ACTIVE','PENDING',$6)
         ON CONFLICT(minister_id,event_id) DO UPDATE SET
           month=EXCLUDED.month,sequence=EXCLUDED.sequence,
           fingerprint=EXCLUDED.fingerprint,state='ACTIVE',
           mail_status='PENDING',payload=EXCLUDED.payload,updated_at=now()`,
        [ministerId, event.id, month, sequence, nextFingerprint, encrypt(next)],
      );
      processed.add(key);
    }
  }

  for (const [key, row] of existing) {
    if (processed.has(key) || row.state !== "ACTIVE") continue;
    const snapshot = decrypt(row.payload) as InviteSnapshot;
    const owner = owners.get(String(row.minister_id));
    const sequence = Number(row.sequence) + 1;
    if (owner) {
      const cancelled = { ...snapshot, sequence, mailStatus: "CANCEL_PENDING" };
      await enqueueInvite(
        client,
        scheduleId,
        String(row.minister_id),
        cancelled,
        sequence,
        "CANCEL",
        applicationUrl,
      );
      await client.query(
        `UPDATE mesce_calendar_delivery_state
         SET sequence=$3,state='CANCELLED',mail_status='CANCEL_PENDING',payload=$4,updated_at=now()
         WHERE minister_id=$1 AND event_id=$2`,
        [row.minister_id, row.event_id, sequence, encrypt(cancelled)],
      );
    } else {
      await client.query(
        `UPDATE mesce_calendar_delivery_state
         SET sequence=$3,state='CANCELLED',mail_status='NONE',updated_at=now()
         WHERE minister_id=$1 AND event_id=$2`,
        [row.minister_id, row.event_id, sequence],
      );
      await client.query(
        `UPDATE mesce_outbox SET status='OBSOLETE',updated_at=now()
         WHERE minister_id=$1 AND channel='EMAIL' AND status IN ('PENDING','RETRY')`,
        [row.minister_id],
      );
    }
  }
}

async function enqueueInvite(
  client: PoolClient,
  scheduleId: string,
  ministerId: string,
  snapshot: InviteSnapshot,
  sequence: number,
  method: InviteMethod,
  applicationUrl: string,
) {
  const uid = calendarUid(snapshot.event.id, ministerId);
  const deliveryKey = hash(`email:${uid}`);
  await enqueue(client, {
    channel: "EMAIL",
    method,
    ministerId,
    scheduleId,
    sequence,
    deliveryKey,
    dedupeKey: hash(`${deliveryKey}:${sequence}:${method}`),
    payload: {
      method,
      ministerId,
      eventId: snapshot.event.id,
      event: snapshot.event,
      recipient: snapshot.recipient,
      recipientHash: snapshot.recipientHash,
      sequence,
      applicationUrl,
      dtstamp: new Date().toISOString(),
    },
  });
}

function fingerprintForMinister(
  schedule: Schedule | undefined,
  ministerId: string,
) {
  const events = assignmentEvents(schedule).get(ministerId);
  return hash(
    JSON.stringify(
      [...(events?.values() ?? [])]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((event) => ({
          id: event.id,
          date: event.date,
          time: event.time,
          duration: event.duration,
          kind: event.kind,
          location: event.location,
        })),
    ),
  );
}

async function enqueuePushDelta(
  client: PoolClient,
  previous: Schedule | undefined,
  current: Schedule | undefined,
  scheduleId: string,
  month: string,
  data: Data,
) {
  if (!enabled("MESCE_PUSH_ENABLED")) return;
  const before = assignmentEvents(previous);
  const after = assignmentEvents(current);
  const ministerIds = new Set([...before.keys(), ...after.keys()]);
  const activeMinisters = new Set(
    data.ministers
      .filter((minister) => minister.active && !minister.former)
      .map((minister) => minister.id),
  );
  for (const ministerId of ministerIds) {
    if (!activeMinisters.has(ministerId)) continue;
    const nextFingerprint = fingerprintForMinister(current, ministerId);
    const priorFingerprint = fingerprintForMinister(previous, ministerId);
    if (nextFingerprint === priorFingerprint) continue;
    const state = await client.query(
      `SELECT fingerprint FROM mesce_push_month_state
       WHERE minister_id=$1 AND month=$2 FOR UPDATE`,
      [ministerId, month],
    );
    if (state.rows[0]?.fingerprint?.trim() === nextFingerprint) continue;
    await client.query(
      `INSERT INTO mesce_push_month_state(minister_id,month,fingerprint)
       VALUES($1,$2,$3)
       ON CONFLICT(minister_id,month) DO UPDATE SET
         fingerprint=EXCLUDED.fingerprint,updated_at=now()`,
      [ministerId, month, nextFingerprint],
    );
    const subscriptions = await client.query(
      `SELECT id FROM mesce_push_subscriptions
       WHERE minister_id=$1 AND revoked_at IS NULL`,
      [ministerId],
    );
    for (const subscription of subscriptions.rows) {
      const subscriptionId = String(subscription.id);
      const deliveryKey = hash(`push-device:${subscriptionId}`);
      await enqueue(client, {
        channel: "PUSH",
        ministerId,
        scheduleId,
        sequence: 0,
        deliveryKey,
        dedupeKey: hash(`push:${subscriptionId}:${month}:${nextFingerprint}`),
        payload: {
          subscriptionId,
          ministerId,
          scheduleId,
          month,
          title: "Atualização do MESCE",
          body: "Há uma atualização nas suas atividades. Abra o MESCE para consultar.",
          url: "/minhas-escalas",
        },
      });
    }
  }
}

export async function enqueuePublishedAgenda(
  client: PoolClient,
  data: Data,
  schedule: Schedule,
  applicationUrl: string,
) {
  if (!enabled("MESCE_DELIVERY_OUTBOX_ENABLED")) return;
  const previous = activeScheduleForMonth(data, schedule.month);
  const current = schedule.status === "PUBLISHED" ? schedule : undefined;
  await enqueueEmailDelta(
    client,
    schedule.month,
    previous,
    current,
    schedule.id,
    applicationUrl,
  );
  await enqueuePushDelta(
    client,
    previous,
    current,
    schedule.id,
    schedule.month,
    data,
  );
}

export async function enqueueCurrentPushSummaries(
  client: PoolClient,
  data: Data,
  ministerId: string,
  subscriptionId: string,
  applicationUrl: string,
) {
  if (
    !enabled("MESCE_DELIVERY_OUTBOX_ENABLED") ||
    !enabled("MESCE_PUSH_ENABLED")
  )
    return;
  for (const schedule of latestPublished(data)) {
    const assigned = assignmentEvents(schedule).has(ministerId);
    if (!assigned) continue;
    const fingerprint = fingerprintForMinister(schedule, ministerId);
    const deliveryKey = hash(`push-device:${subscriptionId}`);
    await enqueue(client, {
      channel: "PUSH",
      ministerId,
      scheduleId: schedule.id,
      sequence: 0,
      deliveryKey,
      dedupeKey: hash(
        `push:current:${subscriptionId}:${schedule.month}:${fingerprint}`,
      ),
      payload: {
        subscriptionId,
        ministerId,
        scheduleId: schedule.id,
        month: schedule.month,
        title: "Suas atividades do MESCE",
        body: "Abra o MESCE para consultar suas atividades publicadas.",
        url: "/minhas-escalas",
      },
    });
  }
}

export function endpointHash(endpoint: string) {
  const key = process.env.MESCE_DATA_KEY_HEX;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Chave de proteção não configurada.");
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update("mesce:push-endpoint:v1:" + endpoint)
    .digest("hex");
}

type OutboxRow = {
  id: string;
  channel: "EMAIL" | "PUSH";
  method: InviteMethod | null;
  minister_id: string;
  sequence: number;
  payload: string;
  attempts: number;
};

function mailTransport() {
  const host = process.env.MESCE_SMTP_HOST;
  const user = process.env.MESCE_SMTP_USER;
  const pass = process.env.MESCE_SMTP_PASSWORD;
  const port = Number(process.env.MESCE_SMTP_PORT || 587);
  if (!host || !user || !pass || !process.env.MESCE_SMTP_FROM) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

async function claimOutbox(owner: string): Promise<OutboxRow | undefined> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<OutboxRow>(
      `SELECT o.id,o.channel,o.method,o.minister_id,o.sequence,o.payload,o.attempts
       FROM mesce_outbox o
       WHERE ((o.status IN ('PENDING','RETRY') AND o.available_at<=now())
          OR (o.status='PROCESSING' AND o.lease_until<now()))
         AND NOT EXISTS (
           SELECT 1 FROM mesce_outbox prior
           WHERE prior.delivery_key=o.delivery_key AND prior.sequence<o.sequence
             AND prior.status IN ('PENDING','RETRY','PROCESSING')
         )
       ORDER BY o.created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return undefined;
    }
    await client.query(
      `UPDATE mesce_outbox SET status='PROCESSING',lease_owner=$2,
       lease_until=now()+interval '2 minutes',attempts=attempts+1,updated_at=now()
       WHERE id=$1`,
      [row.id, owner],
    );
    await client.query("COMMIT");
    return { ...row, attempts: Number(row.attempts) + 1 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function sendOutbox(row: OutboxRow) {
  const payload = decrypt(row.payload) as Record<string, unknown>;
  if (row.channel === "EMAIL") {
    if (!enabled("MESCE_EMAIL_SEND_ENABLED")) return "OBSOLETE" as const;
    const recipient = String(payload.recipient ?? "");
    const state = await pool().query(
      `SELECT sequence,state FROM mesce_calendar_delivery_state
       WHERE minister_id=$1 AND event_id=$2`,
      [row.minister_id, payload.eventId],
    );
    const stateRow = state.rows[0];
    const currentInvite =
      row.method === "REQUEST"
        ? stateRow?.state === "ACTIVE" &&
          Number(stateRow.sequence) === row.sequence
        : stateRow &&
          (Number(stateRow.sequence) === row.sequence ||
            (stateRow.state === "ACTIVE" &&
              Number(stateRow.sequence) > row.sequence));
    if (!currentInvite) return "OBSOLETE" as const;
    const allowed = await pool().query(
      `SELECT 1 FROM mesce_access a JOIN mesce_delivery_preferences p
       ON p.minister_id=a.minister_id AND p.auth0_sub=a.auth0_sub
       WHERE a.minister_id=$1 AND a.status='ACTIVE' AND a.auth0_sub IS NOT NULL
       AND a.email_hmac=$2 AND p.email_enabled=true`,
      [row.minister_id, payload.recipientHash],
    );
    if (!allowed.rowCount) return "OBSOLETE" as const;
    const transport = mailTransport();
    if (!transport) throw new Error("SMTP_NOT_CONFIGURED");
    const event = payload.event as InviteEvent;
    const method = row.method;
    if (!method) return "OBSOLETE" as const;
    const ical = buildCalendarInvite({
      event,
      ministerId: row.minister_id,
      sequence: row.sequence,
      method,
      attendeeEmail: recipient,
      organizerEmail: process.env.MESCE_SMTP_FROM!,
      applicationUrl: String(payload.applicationUrl),
      dtstamp: String(payload.dtstamp),
    });
    const info = await transport.sendMail({
      from: process.env.MESCE_SMTP_FROM,
      to: recipient,
      subject:
        method === "CANCEL"
          ? "Atualização de compromisso MESCE"
          : "Convite de agenda MESCE",
      text: "Há uma atualização de agenda do MESCE. Consulte o convite ou acesse o sistema.",
      icalEvent: { method, content: ical },
    });
    return {
      status: "ACCEPTED_SMTP" as const,
      providerId: String(info.messageId ?? ""),
    };
  }

  if (!enabled("MESCE_PUSH_ENABLED")) return "OBSOLETE" as const;
  const vapidPublic = process.env.MESCE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.MESCE_VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.MESCE_VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject)
    throw new Error("VAPID_NOT_CONFIGURED");
  const result = await pool().query(
    `SELECT s.payload FROM mesce_push_subscriptions s
     JOIN mesce_access a ON a.minister_id=s.minister_id AND a.auth0_sub=s.auth0_sub
     WHERE s.id=$1 AND s.minister_id=$2 AND s.revoked_at IS NULL AND a.status='ACTIVE'`,
    [payload.subscriptionId, row.minister_id],
  );
  if (!result.rows[0]) return "OBSOLETE" as const;
  setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const subscription = decrypt(result.rows[0].payload) as PushSubscription;
  await sendNotification(
    subscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
    }),
    { TTL: 3600 },
  );
  await pool().query(
    `UPDATE mesce_push_subscriptions SET last_accepted_at=now(),updated_at=now()
     WHERE id=$1`,
    [payload.subscriptionId],
  );
  return { status: "ACCEPTED_PUSH" as const, providerId: "" };
}

async function finishOutbox(
  row: OutboxRow,
  result?: Awaited<ReturnType<typeof sendOutbox>>,
  error?: unknown,
) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const status = typeof result === "string" ? result : result?.status;
    const providerStatus =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : 0;
    const knownError =
      error instanceof Error &&
      ["SMTP_NOT_CONFIGURED", "VAPID_NOT_CONFIGURED"].includes(error.message)
        ? error.message
        : "DELIVERY_ERROR";
    const code = providerStatus ? String(providerStatus) : knownError;
    const terminal = status === "OBSOLETE" || (!result && row.attempts >= 5);
    const invalidPushEndpoint =
      row.channel === "PUSH" && ["404", "410"].includes(code);
    const nextStatus =
      status ??
      (invalidPushEndpoint ? "OBSOLETE" : terminal ? "FAILED" : "RETRY");
    const delaySeconds = Math.min(
      86_400,
      60 * 2 ** Math.min(row.attempts - 1, 10),
    );
    await client.query(
      `UPDATE mesce_outbox SET status=$2,result_code=$3,provider_message_id=$4,
       available_at=CASE WHEN $2='RETRY' THEN now()+($5::text||' seconds')::interval ELSE available_at END,
       lease_owner=NULL,lease_until=NULL,updated_at=now()
       WHERE id=$1 AND status='PROCESSING'`,
      [
        row.id,
        nextStatus,
        error ? code : null,
        typeof result === "object" ? result.providerId.slice(0, 200) : null,
        delaySeconds,
      ],
    );
    if (row.channel === "EMAIL" && row.method) {
      const payload = decrypt(row.payload) as { eventId?: string };
      const mailStatus =
        row.method === "REQUEST"
          ? nextStatus === "ACCEPTED_SMTP"
            ? "ACCEPTED_SMTP"
            : nextStatus === "OBSOLETE"
              ? "NONE"
              : nextStatus === "FAILED"
                ? "FAILED"
                : "PENDING"
          : nextStatus === "ACCEPTED_SMTP"
            ? "CANCEL_ACCEPTED_SMTP"
            : nextStatus === "OBSOLETE"
              ? "NONE"
              : nextStatus === "FAILED"
                ? "CANCEL_FAILED"
                : "CANCEL_PENDING";
      await client.query(
        `UPDATE mesce_calendar_delivery_state SET mail_status=$3,updated_at=now()
         WHERE minister_id=$1 AND event_id=$2`,
        [row.minister_id, payload.eventId, mailStatus],
      );
    }
    if (error && invalidPushEndpoint) {
      const p = decrypt(row.payload) as { subscriptionId?: string };
      if (p.subscriptionId)
        await client.query(
          "UPDATE mesce_push_subscriptions SET revoked_at=now(),updated_at=now() WHERE id=$1",
          [p.subscriptionId],
        );
    }
    await client.query("COMMIT");
  } catch (failure) {
    await client.query("ROLLBACK");
    throw failure;
  } finally {
    client.release();
  }
}

export async function processOutboxBatch(limit = 15) {
  if (!enabled("MESCE_DELIVERY_OUTBOX_ENABLED")) return 0;
  const owner = randomUUID();
  let processed = 0;
  while (processed < Math.max(1, Math.min(limit, 25))) {
    const row = await claimOutbox(owner);
    if (!row) break;
    try {
      await finishOutbox(row, await sendOutbox(row));
    } catch (error) {
      await finishOutbox(row, undefined, error);
    }
    processed++;
  }
  return processed;
}
