import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { encrypt, decrypt } from "../src/lib/crypto";
import { canDownload, canVisit, Identity } from "../src/lib/access";
import { emptyData, Schedule, Minister } from "../src/lib/domain";
import { schedulePdf } from "../src/lib/pdf";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
process.env.MESCE_DATA_KEY_HEX = "a".repeat(64);
test("AES-GCM protege conteúdo e rejeita adulteração", () => {
  const input = { name: "Pessoa Sintética", phone: "não real" };
  const payload = encrypt(input);
  assert.ok(!payload.includes(input.name));
  assert.deepEqual(decrypt(payload), input);
  const parts = payload.split(".");
  const tag = Buffer.from(parts[1], "base64");
  tag[0] ^= 1;
  parts[1] = tag.toString("base64");
  assert.throws(() => decrypt(parts.join(".")));
  assert.notEqual(encrypt(input), payload);
});
const ministerId = randomUUID(),
  eventId = randomUUID();
const user: Identity = {
  id: "auth0|synthetic",
  email: "synthetic@example.invalid",
  verified: true,
  coordinator: false,
};
const data = emptyData();
data.ministers.push({
  id: ministerId,
  email: user.email,
  active: true,
} as Minister);
const schedule: Schedule = {
  id: randomUUID(),
  month: "2026-11",
  status: "PUBLISHED",
  revision: 1,
  assignments: [{ eventId, ministerId }],
  events: [
    {
      id: eventId,
      title: "Visita sintética",
      date: "2026-11-08",
      time: "10:00",
      duration: 60,
      kind: "VISIT",
      location: "Local comunitário",
      required: 1,
      assistedId: randomUUID(),
      notes: "CONTATO_CONFIDENCIAL",
    },
  ],
  ministers: [{ id: ministerId, name: "Ministro Sintético" }],
  warnings: [],
};
data.schedules.push(schedule);
test("PDF e dados de visita exigem identidade verificada e designação", () => {
  assert.ok(canDownload(user, data, schedule));
  assert.ok(canVisit(user, data, eventId));
  assert.equal(
    canDownload({ ...user, verified: false }, data, schedule),
    false,
  );
  assert.equal(
    canVisit({ ...user, email: "other@example.invalid" }, data, eventId),
    false,
  );
  assert.equal(
    canDownload(user, data, { ...schedule, status: "DRAFT" }),
    false,
  );
  assert.equal(
    canDownload(user, data, { ...schedule, status: "APPROVED" }),
    false,
  );
  assert.equal(
    canDownload({ ...user, coordinator: true }, data, {
      ...schedule,
      status: "APPROVED",
    }),
    true,
  );
});
test("nova versão publicada remove acesso operacional antigo a visitas", () => {
  const d = {
    ...data,
    schedules: [
      schedule,
      { ...schedule, id: randomUUID(), revision: 2, assignments: [] },
    ],
  };
  assert.equal(canVisit(user, d, eventId), false);
});
test("PDF gera páginas legíveis e não inclui contatos nem observações privadas", async () => {
  const pdf = await schedulePdf({
    ...schedule,
    events: Array.from({ length: 80 }, (_, i) => ({
      ...schedule.events[0],
      id: randomUUID(),
      title: "Encontro " + i + " " + "nome muito longo ".repeat(10),
    })),
  });
  const doc = await PDFDocument.load(pdf);
  assert.ok(doc.getPageCount() > 1);
  const streams = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream)
    .map(([, obj]) =>
      Buffer.from(decodePDFRawStream(obj as PDFRawStream).decode()).toString(
        "utf8",
      ),
    )
    .join("");
  const encoded = Buffer.from("CONTATO_CONFIDENCIAL")
    .toString("hex")
    .toUpperCase();
  assert.ok(!streams.includes(encoded));
  assert.ok(
    streams.includes(Buffer.from("Encontro").toString("hex").toUpperCase()),
  );
});
