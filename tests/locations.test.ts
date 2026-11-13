import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { readData, write } from "../src/lib/store";
import { encrypt } from "../src/lib/crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyData, blocked, generate, type Event } from "../src/lib/domain";
import { blankMinister } from "../src/lib/profile";
import { defaultLocations, matchesLocation } from "../src/lib/location-rules";
import {
  locationCatalog,
  bindLocationRecords,
  ministerLocations,
  eventLocation,
  planLocationChange,
} from "../src/lib/locations";
import { ServicePreferences } from "../src/components/service-preferences";
import { EventFields } from "../src/components/event-fields";
const event = (locationId: string, location: string): Event => ({
  id: randomUUID(),
  title: "Missa teste",
  date: "2030-12-01",
  time: "08:00",
  duration: 60,
  required: 1,
  kind: "MASS",
  assistedId: "",
  locationId,
  location,
  notes: "",
});
const person = () => ({
  ...blankMinister(randomUUID(), "test@example.invalid"),
  name: "Pessoa fictícia",
  registrationStatus: "COMPLETE" as const,
});
test("catálogo recupera nomes antigos com IDs estáveis sem misturar visitas nem seleção múltipla", () => {
  const data = emptyData();
  data.ministers = [{ ...person(), location: "  Comunidade   Antiga " }];
  const first = locationCatalog(data),
    second = locationCatalog(data);
  assert.deepEqual(first, second);
  assert.equal(first.filter((l) => l.name === "Comunidade Antiga").length, 1);
  data.ministers.push({
    ...person(),
    location: "Matriz; Outra",
    locationIds: [defaultLocations[0].id],
  });
  assert.ok(!locationCatalog(data).some((l) => l.name.includes(";")));
  data.events = [
    {
      ...event("", "Endereço privado"),
      kind: "VISIT",
      assistedId: randomUUID(),
    },
  ];
  assert.ok(!locationCatalog(data).some((l) => l.name === "Endereço privado"));
});
test("catálogo valida duplicidade, renomeação pelo mesmo ID e tela desatualizada", () => {
  const data = emptyData(),
    f = new FormData();
  f.set("name", "  matriz  ");
  assert.throws(() => planLocationChange(f, data), /existe/);
  f.set("id", defaultLocations[0].id);
  f.set("expectedName", "Matriz");
  f.set("name", "Igreja Matriz");
  f.set("active", "on");
  const plan = planLocationChange(f, data);
  assert.equal(plan.after.id, defaultLocations[0].id);
  assert.equal(plan.after.name, "Igreja Matriz");
  f.set("expectedName", "Texto antigo");
  assert.throws(() => planLocationChange(f, data), /alterado/);
});
test("preferências múltiplas validam IDs e inativos sem transformar preferência em bloqueio", () => {
  const data = emptyData(),
    m = person(),
    f = new FormData();
  f.set("locationsSubmitted", "1");
  f.set("locationPreference", "EXCLUSIVE");
  f.set("servicePreference", "BOTH");
  assert.throws(() => ministerLocations(f, m, data), /ao menos/);
  f.append("locationIds", defaultLocations[0].id);
  f.append("locationIds", defaultLocations[1].id);
  const chosen = ministerLocations(f, m, data);
  assert.equal(chosen.locationIds!.length, 2);
  assert.ok(chosen.location.includes("Matriz"));
  const e = event(defaultLocations[1].id, "Nome renomeado"),
    minister = { ...m, ...chosen, locationPreference: "EXCLUSIVE" as const };
  assert.equal(
    blocked(minister, e, { ...data, ministers: [minister] }, [], [e]),
    "",
  );
  assert.match(
    blocked(minister, event(defaultLocations[2].id, "Capela"), data, [], []),
    /exclusiva/,
  );
  assert.equal(
    blocked(
      { ...minister, locationPreference: "PREFER" },
      event(defaultLocations[2].id, "Capela"),
      data,
      [],
      [],
    ),
    "",
  );
  data.settings = {
    unansweredPolicy: "ELIGIBLE",
    monthlyLimit: null,
    historyMonths: 12,
    locations: defaultLocations.map((l) => ({ ...l, active: false })),
  };
  assert.throws(() => ministerLocations(f, m, data), /ativas/);
  assert.doesNotThrow(() => ministerLocations(f, minister, data));
  f.append("locationIds", randomUUID());
  assert.throws(() => ministerLocations(f, minister, data));
});
test("local da celebração vem do catálogo e endereço de visita continua separado", () => {
  const data = emptyData(),
    f = new FormData();
  f.set("eventKind", "MASS");
  f.set("locationId", defaultLocations[0].id);
  f.set("location", "Nome forjado");
  assert.equal(eventLocation(f, undefined, data).location, "Matriz");
  f.set("locationId", randomUUID());
  assert.throws(() => eventLocation(f, undefined, data));
  f.delete("locationId");
  f.set("location", "Novo texto não cadastrado");
  assert.throws(() => eventLocation(f, undefined, data));
  f.set("eventKind", "VISIT");
  assert.equal(eventLocation(f, undefined, data).locationId, undefined);
});
test("motor atende qualquer uma das comunidades exclusivas e preserva legado normalizado", () => {
  const data = emptyData();
  const m = {
    ...person(),
    locationPreference: "EXCLUSIVE" as const,
    locationIds: defaultLocations.slice(0, 2).map((l) => l.id),
    location: "Matriz; Carmelo Nossa Senhora do Carmo",
  };
  data.ministers = [m];
  data.events = [
    event(defaultLocations[1].id, "Carmelo Nossa Senhora do Carmo"),
  ];
  assert.equal(generate(data, "2030-12").assignments.length, 1);
  const preferred = { ...m, locationPreference: "PREFER" as const };
  const other = { ...person(), locationPreference: "ACCEPT" as const };
  assert.equal(
    generate({ ...data, ministers: [other, preferred] }, "2030-12")
      .assignments[0].ministerId,
    preferred.id,
  );
  assert.ok(
    matchesLocation(
      { ...m, locationIds: undefined, location: " matriz " },
      { location: "MATRIZ" },
    ),
  );
  assert.ok(matchesLocation(m, { location: "Carmelo Nossa Senhora do Carmo" }));
});
test("formulários exibem seleção múltipla e eventos usam seletor em vez de texto livre", () => {
  const m = {
    ...person(),
    locationIds: defaultLocations.slice(0, 2).map((l) => l.id),
    locationPreference: "PREFER" as const,
  };
  const html = renderToStaticMarkup(
    createElement(ServicePreferences, {
      minister: m,
      catalog: defaultLocations,
    }),
  );
  assert.equal((html.match(/checked=""/g) ?? []).length, 2);
  assert.ok(html.includes("locationsSubmitted"));
  const eventHtml = renderToStaticMarkup(
    createElement(EventFields, { assisted: [], catalog: defaultLocations }),
  );
  assert.ok(eventHtml.includes('name="locationId"'));
  assert.ok(!eventHtml.includes('name="location"'));
});

test("renomeação vincula legado, mantém preferências e histórico e persiste catálogo cifrado", async () => {
  process.env.MESCE_DATA_KEY_HEX = "a".repeat(64);
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "002_access.sql"])
      await db.exec(await readFile(`migrations/${file}`, "utf8"));
    const client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as PoolClient;
    const data = emptyData();
    data.ministers = [
      { ...person(), location: "Matriz", locationPreference: "EXCLUSIVE" },
    ];
    const e = event(defaultLocations[0].id, "Matriz");
    delete e.locationId;
    data.events = [e];
    const published = generate(data, "2030-12");
    published.status = "PUBLISHED";
    data.schedules = [published];
    const snapshot = JSON.stringify(published);
    const form = new FormData();
    for (const [key, value] of Object.entries({
      id: defaultLocations[0].id,
      expectedName: "Matriz",
      name: "Igreja Matriz",
      active: "on",
    }))
      form.set(key, value);
    const plan = planLocationChange(form, data);
    const rebound = bindLocationRecords(data, plan.catalog);
    assert.equal(rebound.events[0].locationId, defaultLocations[0].id);
    assert.equal(rebound.events[0].location, "Igreja Matriz");
    assert.ok(matchesLocation(rebound.ministers[0], rebound.events[0]));
    assert.equal(JSON.stringify(published), snapshot);
    await db.exec("BEGIN");
    await client.query("INSERT INTO mesce_settings(id,payload) VALUES(1,$1)", [
      encrypt({
        unansweredPolicy: "ELIGIBLE",
        monthlyLimit: null,
        historyMonths: 12,
        locations: plan.catalog,
      }),
    ]);
    for (const m of rebound.ministers) await write(client, "minister", m);
    for (const e of rebound.events) await write(client, "event", e);
    await write(client, "schedule", published);
    await db.exec("COMMIT");
    const saved = await readData(client);
    assert.equal(
      saved.settings!.locations!.find((l) => l.id === defaultLocations[0].id)!
        .name,
      "Igreja Matriz",
    );
    assert.ok(matchesLocation(saved.ministers[0], saved.events[0]));
    assert.equal(JSON.stringify(saved.schedules[0]), snapshot);
  } finally {
    await db.close();
  }
});
