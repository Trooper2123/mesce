import { Pool } from "pg";
import { databaseUrl } from "../src/lib/config";
import { readFile } from "node:fs/promises";
const pool = new Pool({ connectionString: databaseUrl(process.env, true) });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(await readFile("migrations/001_initial.sql", "utf8"));
  await client.query("COMMIT");
  console.log("Migração concluída.");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
