import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseUrl } from "../src/lib/config";
test("reconhece nomes de conexão existentes na integração Neon da Vercel", () => {
  for (const key of [
    "DATABASE_URL",
    "MESCE_DATABASE_URL",
    "NEON_MESCE_DATABASE_URL",
    "POSTGRES_URL",
    "NEON_MESCE_POSTGRES_URL",
  ])
    assert.equal(databaseUrl({ [key]: "synthetic-url" }), "synthetic-url");
});
test("Preview exige banco isolado MESCE e não herda URL de produção", () => {
  assert.throws(() =>
    databaseUrl({
      VERCEL_ENV: "preview",
      NEON_MESCE_DATABASE_URL: "production",
    }),
  );
  assert.throws(() =>
    databaseUrl({ VERCEL_ENV: "preview", DATABASE_URL: "production" }),
  );
  assert.equal(
    databaseUrl({
      VERCEL_ENV: "preview",
      MESCE_DATABASE_URL: "isolated",
      NEON_MESCE_DATABASE_URL: "production",
    }),
    "isolated",
  );
});
test("migração prefere conexão direta e preserva override explícito por ambiente", () => {
  assert.equal(
    databaseUrl(
      {
        NEON_MESCE_DATABASE_URL: "pooled",
        NEON_MESCE_DATABASE_URL_UNPOOLED: "direct",
      },
      true,
    ),
    "direct",
  );
  assert.equal(
    databaseUrl(
      {
        MESCE_DATABASE_URL: "isolated",
        NEON_MESCE_DATABASE_URL_UNPOOLED: "production",
      },
      true,
    ),
    "isolated",
  );
  assert.throws(() => databaseUrl({}));
});
