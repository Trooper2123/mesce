import { test } from "node:test";
import assert from "node:assert/strict";
import { authEntryRedirect } from "../src/lib/auth-routing";
const prod = {
  NODE_ENV: "production" as const,
  VERCEL_ENV: "production",
  APP_BASE_URL: "https://mescensrdf.vercel.app",
};
const preview = {
  ...prod,
  VERCEL_ENV: "preview",
  MESCE_AUTH_MODE: "bypass",
  MESCE_DEV_PASSWORD: "synthetic",
  MESCE_DEV_SESSION_SECRET: "s".repeat(32),
};
test("login pelo endereço do deploy começa no mesmo domínio do callback antes de criar cookie", () => {
  assert.equal(
    authEntryRedirect(
      "https://deployment.example/auth/login?returnTo=%2Fescalas&_vercel_share=private",
      prod,
    ),
    "https://mescensrdf.vercel.app/auth/login?returnTo=%2Fescalas",
  );
  assert.equal(
    authEntryRedirect("https://mescensrdf.vercel.app/auth/login", prod),
    null,
  );
});
test("callback não é reescrito nem tem validação de state desativada em produção", () => {
  assert.equal(
    authEntryRedirect(
      "https://deployment.example/api/auth/callback?state=synthetic",
      prod,
    ),
    null,
  );
  assert.equal(
    authEntryRedirect("https://deployment.example/escalas", prod),
    null,
  );
  assert.equal(
    authEntryRedirect("https://deployment.example/auth/login", {
      ...prod,
      APP_BASE_URL: undefined,
    }),
    null,
  );
});
test("preview válido direciona entradas Auth0 antigas para sua própria sessão de homologação", () => {
  for (const route of [
    "/auth/login",
    "/auth/logout",
    "/api/auth/callback?state=expired",
  ])
    assert.equal(
      authEntryRedirect("https://preview.example" + route, preview),
      "https://preview.example/acesso-dev",
    );
  assert.equal(
    authEntryRedirect("https://preview.example/escalas", preview),
    null,
  );
  assert.equal(
    authEntryRedirect("https://preview.example/auth/login", {
      ...preview,
      MESCE_DEV_SESSION_SECRET: "",
    }),
    null,
  );
  assert.equal(
    authEntryRedirect("https://deployment.example/auth/login", {
      ...preview,
      VERCEL_ENV: "production",
    }),
    "https://mescensrdf.vercel.app/auth/login",
  );
});
test("origem vem da configuração e não de returnTo, header ou query de quem inicia login", () => {
  for (const returnTo of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
  ])
    assert.equal(
      authEntryRedirect(
        "https://deployment.example/auth/login?returnTo=" +
          encodeURIComponent(returnTo),
        prod,
      ),
      "https://mescensrdf.vercel.app/auth/login",
    );
  assert.throws(
    () =>
      authEntryRedirect("https://deployment.example/auth/login", {
        ...prod,
        APP_BASE_URL: "http://wrong.example",
      }),
    /HTTPS/,
  );
});

test("proxy redireciona login antes de emitir cookie e não aciona SDK no Preview válido", async () => {
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("../src/proxy");
  const keys = [
    "NODE_ENV",
    "VERCEL_ENV",
    "APP_BASE_URL",
    "MESCE_AUTH_MODE",
    "MESCE_DEV_PASSWORD",
    "MESCE_DEV_SESSION_SECRET",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, prod);
    const response = await proxy(
      new NextRequest("https://deployment.example/auth/login"),
    );
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://mescensrdf.vercel.app/auth/login",
    );
    assert.equal(response.headers.get("set-cookie"), null);
    Object.assign(process.env, preview);
    const next = await proxy(
      new NextRequest("https://preview.example/escalas"),
    );
    assert.equal(next.headers.get("x-middleware-next"), "1");
    const login = await proxy(
      new NextRequest("https://preview.example/auth/login"),
    );
    assert.equal(
      login.headers.get("location"),
      "https://preview.example/acesso-dev",
    );
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) Reflect.deleteProperty(process.env, key);
      else Object.assign(process.env, { [key]: previous[key] });
    }
  }
});
