import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import {
  previewProfiles,
  createPreviewSession,
  readPreviewSession,
  previewEnabled,
} from "../src/lib/preview-session";
import { ensurePreviewMinister } from "../src/lib/preview-profiles";
import { resolveActor, assertCurrentActor } from "../src/lib/auth";
import { readData, write } from "../src/lib/store";
import { ownProfile } from "../src/lib/profile";
import { PreviewProfileFields } from "../src/components/preview-profile-fields";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
const keys = [
  "VERCEL_ENV",
  "MESCE_AUTH_MODE",
  "MESCE_DEV_PASSWORD",
  "MESCE_DEV_SESSION_SECRET",
  "MESCE_DATA_KEY_HEX",
  "MESCE_COORDINATOR_EMAILS",
];
async function setup(fn: () => Promise<void> | void) {
  const old = { ...process.env };
  Object.assign(process.env, {
    VERCEL_ENV: "preview",
    MESCE_AUTH_MODE: "bypass",
    MESCE_DEV_PASSWORD: "test-only",
    MESCE_DEV_SESSION_SECRET: "test-only-preview-secret-32-characters",
    MESCE_DATA_KEY_HEX: "a".repeat(64),
  });
  try {
    await fn();
  } finally {
    for (const key of keys)
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
  }
}
async function database(fn: (client: PoolClient) => Promise<void>) {
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "002_access.sql"])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    await fn({
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient);
  } finally {
    await db.close();
  }
}
test("sessão cifra o perfil e rejeita adulteração, expiração e uso em produção", () =>
  setup(() => {
    for (const profile of [
      "COORDINATOR",
      "MINISTER_A",
      "MINISTER_B",
    ] as const) {
      const token = createPreviewSession(1000, profile);
      const session = readPreviewSession(token, 2000)!;
      assert.equal(session.previewProfile, profile);
      assert.equal(session.id, previewProfiles[profile].sub);
      assert.equal(
        session.previewRole,
        profile === "COORDINATOR" ? "COORDINATOR" : "MINISTER",
      );
      assert.ok(!token.includes(previewProfiles[profile].email));
      assert.equal(readPreviewSession(token, 3601001), null);
      const bytes = Buffer.from(token, "base64url");
      bytes[30] ^= 1;
      assert.equal(readPreviewSession(bytes.toString("base64url"), 2000), null);
    }
    const token = createPreviewSession(1000, "MINISTER_A");
    process.env.VERCEL_ENV = "production";
    assert.equal(previewEnabled(), false);
    assert.equal(readPreviewSession(token, 2000), null);
    assert.throws(() => createPreviewSession());
  }));
test("perfis de ministro usam cadastro e acesso persistidos sem promover papel", () =>
  setup(() =>
    database(async (client) => {
      await ensurePreviewMinister(client, "MINISTER_A");
      await ensurePreviewMinister(client, "MINISTER_B");
      const a = readPreviewSession(
        createPreviewSession(Date.now(), "MINISTER_A"),
      )!;
      const b = readPreviewSession(
        createPreviewSession(Date.now(), "MINISTER_B"),
      )!;
      const actorA = (await resolveActor(client, a))!,
        actorB = (await resolveActor(client, b))!;
      assert.equal(actorA.coordinator, false);
      assert.equal(actorB.coordinator, false);
      assert.notEqual(actorA.ministerId, actorB.ministerId);
      await assert.rejects(
        () => assertCurrentActor(client, actorA, true),
        /não autorizado/,
      );
      const data = await readData(client);
      assert.equal(data.ministers.length, 2);
      assert.ok(
        data.ministers.every((m) => m.registrationStatus === "COMPLETE"),
      );
      const current = data.ministers.find((m) => m.id === actorA.ministerId)!;
      await write(
        client,
        "minister",
        ownProfile({ name: "Nome de teste atualizado" }, current),
      );
      await ensurePreviewMinister(client, "MINISTER_A");
      assert.equal(
        (await readData(client)).ministers.find((m) => m.id === current.id)!
          .name,
        "Nome de teste atualizado",
      );
      await client.query(
        "UPDATE mesce_access SET status='REVOKED' WHERE minister_id=$1",
        [actorA.ministerId],
      );
      await ensurePreviewMinister(client, "MINISTER_A");
      assert.equal(await resolveActor(client, a), null);
      await assert.rejects(() => assertCurrentActor(client, actorA));
      assert.equal((await resolveActor(client, b))!.coordinator, false);
    }),
  ));
test("inativação e papel administrativo indevido não elevam ministro em homologação", () =>
  setup(() =>
    database(async (client) => {
      await ensurePreviewMinister(client, "MINISTER_A");
      const session = readPreviewSession(
        createPreviewSession(Date.now(), "MINISTER_A"),
      )!;
      process.env.MESCE_COORDINATOR_EMAILS = session.email;
      await client.query(
        "UPDATE mesce_access SET role='COORDINATOR' WHERE minister_id=$1",
        [previewProfiles.MINISTER_A.ministerId],
      );
      assert.equal(await resolveActor(client, session), null);
      await client.query(
        "UPDATE mesce_access SET role='MINISTER' WHERE minister_id=$1",
        [previewProfiles.MINISTER_A.ministerId],
      );
      const m = (await readData(client)).ministers[0];
      await write(client, "minister", { ...m, active: false });
      assert.equal(await resolveActor(client, session), null);
      const coord = readPreviewSession(
        createPreviewSession(Date.now(), "COORDINATOR"),
      )!;
      assert.equal((await resolveActor(client, coord))!.coordinator, true);
      process.env.VERCEL_ENV = "production";
      assert.equal(await resolveActor(client, coord), null);
      await assert.rejects(() => ensurePreviewMinister(client, "MINISTER_B"));
    }),
  ));
test("seletor oferece coordenação e dois ministros e proxy preserva entrada Preview", () =>
  setup(async () => {
    const html = renderToStaticMarkup(
      createElement(PreviewProfileFields, { selected: "MINISTER_A" }),
    );
    assert.ok(html.includes('value="MINISTER_A" selected=""'));
    assert.ok(html.includes("Ministro de teste B"));
    assert.ok(html.includes("Coordenador"));
    const response = await proxy(
      new NextRequest("https://preview.example.invalid/auth/login"),
    );
    assert.equal(
      response.headers.get("location"),
      "https://preview.example.invalid/acesso-dev",
    );
    assert.equal(
      (
        await proxy(
          new NextRequest("https://preview.example.invalid/meus-dados"),
        )
      ).headers.get("x-middleware-next"),
      "1",
    );
  }));
