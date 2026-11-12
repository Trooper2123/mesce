import { createHmac } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { encrypt, decrypt } from "./crypto";
import { readData, write, audit } from "./store";
import { ministerSchema, Minister } from "./domain";
export type SessionIdentity = {
  id: string;
  email: string;
  verified: boolean;
  preview?: boolean;
  previewRole?: "COORDINATOR" | "MINISTER";
  previewProfile?: import("./preview-session").PreviewProfile;
};
export type Access = {
  id: string;
  email_hmac: string | null;
  email_ciphertext: string | null;
  auth0_sub: string | null;
  minister_id: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  role: "MINISTER" | "COORDINATOR";
};
export const normalizeEmail = (email: string) =>
  z.email().parse(email.trim().toLowerCase());
export function emailHash(email: string) {
  const key = process.env.MESCE_DATA_KEY_HEX;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Chave de proteção não configurada.");
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update("mesce:email:v1:" + normalizeEmail(email))
    .digest("hex");
}
export function parseEmails(raw: string) {
  const emails = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(normalizeEmail),
    ),
  ];
  if (!emails.length || emails.length > 100)
    throw new Error("Informe entre 1 e 100 e-mails por operação.");
  return emails;
}
export async function findAccess(
  client: Pick<PoolClient, "query">,
  identity: SessionIdentity,
): Promise<Access | undefined> {
  if (!identity.verified || !identity.email) return undefined;
  const hash = emailHash(identity.email);
  const result = await client.query<Access>(
    "SELECT * FROM mesce_access WHERE auth0_sub=$1 OR email_hmac=$2",
    [identity.id, hash],
  );
  if (result.rows.length !== 1) return undefined;
  const row = result.rows[0];
  if (row.auth0_sub && row.auth0_sub !== identity.id) return undefined;
  if (row.email_hmac && row.email_hmac !== hash) return undefined;
  return row;
}
export async function addEmails(
  client: PoolClient,
  by: string,
  emails: string[],
) {
  const result: string[] = [];
  const ministers = (await readData(client)).ministers;
  for (const email of emails) {
    const id = crypto.randomUUID();
    const existing = ministers.find((m) => m.email.toLowerCase() === email);
    const row = await client.query<Access>(
      "INSERT INTO mesce_access(id,email_hmac,email_ciphertext,minister_id,status) VALUES($1,$2,$3,$4,'PENDING') ON CONFLICT(email_hmac) DO NOTHING RETURNING *",
      [
        id,
        emailHash(email),
        encrypt(email),
        existing?.id ?? crypto.randomUUID(),
      ],
    );
    if (row.rowCount) {
      result.push(row.rows[0].id);
      await audit(client, by, "allowlist:add", id);
    }
  }
  return result;
}
export async function completeRegistration(
  client: PoolClient,
  identity: SessionIdentity,
  input: unknown,
): Promise<Minister> {
  const access = await findAccess(client, identity);
  if (!access || access.status === "REVOKED")
    throw new Error("Cadastro não autorizado. Procure a coordenação.");
  if (access.status === "ACTIVE") {
    const existing = (await readData(client)).ministers.find(
      (m) => m.id === access.minister_id,
    );
    if (existing) return existing;
    throw new Error("Vínculo incompleto. Procure a coordenação.");
  }
  const raw = typeof input === "object" && input !== null ? input : {};
  const prior = (await readData(client)).ministers.find(
    (m) => m.id === access.minister_id,
  );
  if (prior?.former)
    throw new Error("Cadastro de ex-ministro. Procure a coordenação.");
  const minister = ministerSchema.parse({
    ...raw,
    id: access.minister_id,
    email: normalizeEmail(identity.email),
    active: prior?.active ?? true,
    away: prior?.away ?? false,
    former: prior?.former ?? false,
  });
  await write(client, "minister", minister);
  await client.query(
    "UPDATE mesce_access SET auth0_sub=$1,status='ACTIVE',updated_at=now() WHERE id=$2 AND status='PENDING'",
    [identity.id, access.id],
  );
  await audit(client, identity.id, "registration:complete", minister.id);
  return minister;
}
export async function listAccess(client: Pick<PoolClient, "query">) {
  const result = await client.query<Access>(
    "SELECT * FROM mesce_access ORDER BY created_at DESC",
  );
  return result.rows.map((row) => ({
    ...row,
    email: row.email_ciphertext
      ? String(decrypt(row.email_ciphertext))
      : "Identidade migrada",
  }));
}
export async function rateLimit(
  client: Pick<PoolClient, "query">,
  fingerprint: string,
  limit = 10,
) {
  const result = await client.query<{ count: number }>(
    "INSERT INTO mesce_attempts(fingerprint) VALUES($1) ON CONFLICT(fingerprint) DO UPDATE SET count=CASE WHEN mesce_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE mesce_attempts.count+1 END,window_start=CASE WHEN mesce_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE mesce_attempts.window_start END RETURNING count",
    [fingerprint],
  );
  if (result.rows[0].count > limit)
    throw new Error("Muitas tentativas. Aguarde 15 minutos.");
}
