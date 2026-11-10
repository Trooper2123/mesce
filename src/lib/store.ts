import { Pool, PoolClient } from "pg";
import { databaseUrl } from "./config";
import { decrypt, encrypt } from "./crypto";
import { Data, Kind, emptyData, defaultSettings } from "./domain";
const globalPool = globalThis as unknown as { mescePool?: Pool };
export function pool() {
  return (globalPool.mescePool ??= new Pool({
    connectionString: databaseUrl(),
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
  }));
}
const mapping = {
  minister: "ministers",
  assisted: "assisted",
  event: "events",
  absence: "absences",
  schedule: "schedules",
} as const;
export async function readData(client?: PoolClient): Promise<Data> {
  const result = await (client ?? pool()).query(
    "SELECT kind,payload FROM mesce_records ORDER BY created_at,id",
  );
  const data = emptyData();
  data.responses = [];
  for (const row of result.rows)
    (data[mapping[row.kind as Exclude<Kind, "response">]] as unknown[]).push(
      decrypt(row.payload),
    );
  const responses = await (client ?? pool()).query(
    "SELECT payload FROM mesce_responses",
  );
  data.responses = responses.rows.map(
    (row) => decrypt(row.payload) as NonNullable<Data["responses"]>[number],
  );
  const settings = await (client ?? pool()).query(
    "SELECT payload FROM mesce_settings WHERE id=1",
  );
  data.settings = settings.rows[0]
    ? (decrypt(settings.rows[0].payload) as Data["settings"])
    : { ...defaultSettings };
  return data;
}
export async function audit(
  client: PoolClient,
  actor: string,
  action: string,
  id?: string,
  details?: unknown,
) {
  await client.query(
    "INSERT INTO mesce_audit(actor,action,record_id,details) VALUES ($1,$2,$3,$4)",
    [
      actor,
      action,
      id ?? null,
      details === undefined ? null : encrypt(details),
    ],
  );
}
export async function write<T extends { id: string }>(
  client: PoolClient,
  kind: Kind,
  value: T,
) {
  if (kind === "response") {
    const response = value as unknown as NonNullable<Data["responses"]>[number];
    await client.query(
      "INSERT INTO mesce_responses(id,minister_id,month,payload) VALUES($1,$2,$3,$4) ON CONFLICT(minister_id,month) DO UPDATE SET payload=EXCLUDED.payload",
      [response.id, response.ministerId, response.month, encrypt(response)],
    );
    return;
  }
  await client.query(
    "INSERT INTO mesce_records(id,kind,payload) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,version=mesce_records.version+1,updated_at=now() WHERE mesce_records.kind=EXCLUDED.kind",
    [value.id, kind, encrypt(value)],
  );
}
export async function transaction<T>(
  fn: (client: PoolClient, data: Data) => Promise<T>,
) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(781049)");
    const result = await fn(client, await readData(client));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
