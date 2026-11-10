import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { write, readData, audit } from "../src/lib/store";
process.env.MESCE_DATA_KEY_HEX = "b".repeat(64);
test("migração PostgreSQL, persistência cifrada, atualização e rollback atômico", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("migrations/001_initial.sql", "utf8"));
    await db.exec(await readFile("migrations/002_access.sql", "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const id = randomUUID();
    const person = {
      id,
      name: "Cadastro Inteiramente Sintético",
      active: true,
    };
    await write(client, "minister", person);
    let data = await readData(client);
    assert.equal(data.ministers[0].name, person.name);
    const raw = await db.query<{ payload: string; version: number }>(
      "SELECT payload,version FROM mesce_records",
    );
    assert.ok(!raw.rows[0].payload.includes(person.name));
    assert.equal(raw.rows[0].version, 1);
    await write(client, "minister", { ...person, name: "Alteração Sintética" });
    assert.equal(
      (await db.query<{ version: number }>("SELECT version FROM mesce_records"))
        .rows[0].version,
      2,
    );
    await audit(client, "auth0|synthetic", "save:minister", id);
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM mesce_audit",
        )
      ).rows[0].count,
      1,
    );
    await db.exec("BEGIN");
    await write(client, "minister", {
      id: randomUUID(),
      name: "Será revertido",
    } as { id: string });
    await db.exec("ROLLBACK");
    data = await readData(client);
    assert.equal(data.ministers.length, 1);
    await assert.rejects(
      db.query("INSERT INTO mesce_records(id,kind,payload) VALUES ($1,$2,$3)", [
        randomUUID(),
        "invalid",
        "x",
      ]),
    );
  } finally {
    await db.close();
  }
});
