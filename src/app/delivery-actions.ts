"use server";
import { z } from "zod";
import { actor, assertCurrentActor } from "@/lib/auth";
import { linkedMinister } from "@/lib/access";
import {
  enqueueCurrentPushSummaries,
  processOutboxBatch,
  savePushSubscription,
} from "@/lib/agenda-delivery";
import { pool, readData, transaction } from "@/lib/store";
import { revalidatePath } from "next/cache";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
});

function allowedPushEndpoint(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return (
    url.protocol === "https:" &&
    [
      "fcm.googleapis.com",
      "push.services.mozilla.com",
      "push.apple.com",
      "notify.windows.com",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

export async function saveEmailDeliveryPreference(form: FormData) {
  const user = await actor();
  if (!user.verified || !user.email)
    throw new Error("E-mail verificado obrigatório.");
  await transaction(async (client, data) => {
    const current = await assertCurrentActor(client, user);
    const minister = linkedMinister(current, data);
    if (!minister)
      throw new Error("Cadastro de ministro ativo não localizado.");
    const enabled = form.get("enabled") === "on";
    await client.query(
      `INSERT INTO mesce_delivery_preferences(minister_id,auth0_sub,email_enabled)
       VALUES($1,$2,$3) ON CONFLICT(minister_id) DO UPDATE SET
       auth0_sub=EXCLUDED.auth0_sub,email_enabled=EXCLUDED.email_enabled,updated_at=now()`,
      [minister.id, user.id, enabled],
    );
    if (!enabled)
      await client.query(
        `UPDATE mesce_outbox SET status='OBSOLETE',updated_at=now()
         WHERE minister_id=$1 AND channel='EMAIL' AND status IN ('PENDING','RETRY')`,
        [minister.id],
      );
  });
  revalidatePath("/minhas-escalas/avisos");
}

export async function registerPushSubscription(raw: unknown) {
  const user = await actor();
  const subscription = subscriptionSchema.parse(raw);
  if (!allowedPushEndpoint(subscription.endpoint))
    throw new Error("Provedor de notificações não aceito.");
  const id = crypto.randomUUID();
  let subscriptionId = id;
  await transaction(async (client, data) => {
    const current = await assertCurrentActor(client, user);
    const minister = linkedMinister(current, data);
    if (!minister)
      throw new Error("Cadastro de ministro ativo não localizado.");
    subscriptionId = await savePushSubscription(client, {
      id,
      ministerId: minister.id,
      auth0Sub: user.id,
      subscription,
    });
    await enqueueCurrentPushSummaries(
      client,
      data,
      minister.id,
      subscriptionId,
      process.env.APP_BASE_URL ?? "http://localhost:3000",
    );
  });
  await processOutboxBatch();
  return { ok: true };
}

export async function revokePushSubscriptions() {
  const user = await actor();
  await transaction(async (client, data) => {
    const current = await assertCurrentActor(client, user);
    const minister = linkedMinister(current, data);
    if (!minister)
      throw new Error("Cadastro de ministro ativo não localizado.");
    await client.query(
      `UPDATE mesce_push_subscriptions SET revoked_at=now(),updated_at=now()
       WHERE minister_id=$1 AND auth0_sub=$2 AND revoked_at IS NULL`,
      [minister.id, user.id],
    );
  });
  revalidatePath("/minhas-escalas/avisos");
}

export async function notificationSettings() {
  const user = await actor();
  const data = await readData();
  const minister = linkedMinister(user, data);
  if (!minister)
    return { emailEnabled: false, pushEnabled: false, canManage: false };
  const result = await pool().query(
    `SELECT p.email_enabled,
      EXISTS(SELECT 1 FROM mesce_push_subscriptions s WHERE s.minister_id=p.minister_id AND s.auth0_sub=$2 AND s.revoked_at IS NULL) AS push_enabled
     FROM mesce_delivery_preferences p WHERE p.minister_id=$1 AND p.auth0_sub=$2`,
    [minister.id, user.id],
  );
  return {
    emailEnabled: result.rows[0]?.email_enabled === true,
    pushEnabled: result.rows[0]?.push_enabled === true,
    canManage: true,
    vapidPublicKey: process.env.MESCE_VAPID_PUBLIC_KEY ?? "",
  };
}
