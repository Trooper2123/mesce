import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { databaseUrl } from "../src/lib/config";
const pool = new Pool({
  connectionString: databaseUrl(process.env, true),
  connectionTimeoutMillis: 5000,
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(781049)");
  for (const name of (await readdir("migrations"))
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
    await client.query(await readFile("migrations/" + name, "utf8"));
  await client.query("COMMIT");
  console.log("Migrações aditivas concluídas.");
} catch {
  await client.query("ROLLBACK");
  console.error(
    "Migração falhou e foi revertida. Verifique destino e permissões.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
