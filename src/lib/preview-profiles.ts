import type { PoolClient } from "pg";
import {
  previewEnabled,
  previewProfiles,
  type PreviewProfile,
} from "./preview-session";
import { blankMinister, requireCompleteMinister } from "./profile";
import { emailHash } from "./registration";
import { encrypt } from "./crypto";
import { write, audit } from "./store";
/** Called only after password/session validation, inside the serialized Preview transaction. */
export async function ensurePreviewMinister(
  client: PoolClient,
  profile: PreviewProfile,
) {
  if (!previewEnabled()) throw new Error("Perfis de teste indisponíveis.");
  const selected = previewProfiles[profile];
  if (!selected.ministerId) return;
  const records = await client.query(
    "SELECT payload FROM mesce_records WHERE id=$1",
    [selected.ministerId],
  );
  const access = await client.query(
    "SELECT id FROM mesce_access WHERE minister_id=$1",
    [selected.ministerId],
  );
  if (records.rows.length || access.rows.length) {
    // Never overwrite edits, revive revoked access, or hijack an existing partial identity.
    if (!records.rows.length || !access.rows.length)
      throw new Error("Perfil de teste incompleto; revise com a coordenação.");
    return;
  }
  const minister = requireCompleteMinister({
    ...blankMinister(selected.ministerId, selected.email),
    name: selected.label,
    preferredName: selected.label,
    birthDate: "1990-01-01",
    phone: "61999990000",
    ministryStart: "2020-01-01",
    address: "Rua Fictícia, 100",
    neighborhood: "Bairro de Testes",
    city: "Brasília",
    state: "DF",
    notes: "Cadastro sintético para homologação; sem dados de pessoa real.",
  });
  await write(client, "minister", minister);
  await client.query(
    "INSERT INTO mesce_access(id,email_hmac,email_ciphertext,auth0_sub,minister_id,status,role) VALUES($1,$2,$3,$4,$5,'ACTIVE','MINISTER')",
    [
      crypto.randomUUID(),
      emailHash(selected.email),
      encrypt(selected.email),
      selected.sub,
      selected.ministerId,
    ],
  );
  await audit(
    client,
    "preview-profile",
    "preview:minister-created",
    minister.id,
    { profile },
  );
}
