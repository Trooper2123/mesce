"use server";

import { randomBytes } from "node:crypto";
import { actor, assertCurrentActor } from "@/lib/auth";
import { calendarTokenHash } from "@/lib/personal-calendar";
import { audit, pool, transaction } from "@/lib/store";

const featureEnabled = () =>
  process.env.MESCE_CALENDAR_FEEDS_ENABLED === "true";

export async function createPersonalCalendarFeed() {
  if (!featureEnabled())
    return { error: "A assinatura de calendário ainda não está habilitada." };
  const user = await actor();
  const token = randomBytes(32).toString("base64url");
  try {
    await transaction(async (client, data) => {
      const current = await assertCurrentActor(client, user);
      const minister = data.ministers.find(
        (item) => item.id === current.ministerId,
      );
      if (!minister || !minister.active || minister.former)
        throw new Error("Somente um ministro ativo pode assinar a agenda.");
      const access = await client.query(
        `SELECT email_hmac FROM mesce_access
         WHERE auth0_sub=$1 AND minister_id=$2 AND status='ACTIVE'`,
        [current.id, minister.id],
      );
      const emailHash = access.rows[0]?.email_hmac;
      if (!emailHash)
        throw new Error("A conta não possui vínculo ativo e validado.");
      await client.query(
        `INSERT INTO mesce_calendar_feeds(minister_id,auth0_sub,owner_email_hmac,token_hash,revoked_at)
         VALUES($1,$2,$3,$4,NULL)
         ON CONFLICT(minister_id) DO UPDATE SET
           auth0_sub=EXCLUDED.auth0_sub,
           owner_email_hmac=EXCLUDED.owner_email_hmac,
           token_hash=EXCLUDED.token_hash,
           revoked_at=NULL,
           updated_at=now()`,
        [minister.id, current.id, emailHash, calendarTokenHash(token)],
      );
      await audit(
        client,
        current.id,
        "calendar-feed:create-or-rotate",
        minister.id,
      );
    });
  } catch {
    return {
      error:
        "Não foi possível ativar a assinatura. Confirme se a migração de calendário foi aplicada e tente novamente.",
    };
  }
  return { token };
}

export async function revokePersonalCalendarFeed() {
  if (!featureEnabled())
    return { error: "A assinatura de calendário ainda não está habilitada." };
  const user = await actor();
  try {
    await transaction(async (client, data) => {
      const current = await assertCurrentActor(client, user);
      if (!current.ministerId)
        throw new Error("Não há cadastro de ministro vinculado.");
      const minister = data.ministers.find(
        (item) => item.id === current.ministerId,
      );
      if (!minister || !minister.active || minister.former)
        throw new Error("Cadastro de ministro indisponível.");
      await client.query(
        `UPDATE mesce_calendar_feeds
         SET revoked_at=now(), updated_at=now()
         WHERE minister_id=$1 AND auth0_sub=$2 AND revoked_at IS NULL`,
        [minister.id, current.id],
      );
      await audit(client, current.id, "calendar-feed:revoke", minister.id);
    });
  } catch {
    return { error: "Não foi possível revogar a assinatura. Tente novamente." };
  }
  return { revoked: true };
}
