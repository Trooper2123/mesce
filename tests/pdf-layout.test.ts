import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { schedulePdf, visitGuidePdf } from "../src/lib/pdf";
import type { Schedule, Assisted, Event } from "../src/lib/domain";
const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id,
  date: "2026-11-01",
  time: "08:00",
  duration: 60,
  title: "Missa",
  location: "Matriz",
  kind: "MASS",
  required: 5,
  assistedId: "",
  notes: "",
  ...extra,
});
const fixture = (): Schedule => ({
  id: "schedule",
  month: "2026-11",
  revision: 3,
  status: "PUBLISHED",
  approvedAt: "2026-10-29T15:00:00Z",
  ministers: Array.from({ length: 5 }, (_, i) => ({
    id: `minister-${i}`,
    name: `MINISTRO_${i + 1}`,
  })),
  events: [
    event("mass"),
    event("visit", {
      kind: "VISIT",
      required: 1,
      assistedId: "person",
      title: "TITULO_PRIVADO",
      location: "LOCAL_PRIVADO",
      notes: "NOTA_PRIVADA",
    }),
  ],
  assignments: [
    ...Array.from({ length: 5 }, (_, i) => ({
      eventId: "mass",
      ministerId: `minister-${i}`,
    })),
    { eventId: "visit", ministerId: "minister-0" },
  ],
  warnings: [],
  assistedSnapshot: [
    {
      id: "person",
      name: "PESSOA_X",
      address: "ENDERECO_PRIVADO",
      landline: "FONE_PRIVADO",
      notes: "NOTA_PRIVADA",
    } as Assisted,
  ],
});
async function inspect(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const streams = pdf.context
    .enumerateIndirectObjects()
    .filter(
      ([, obj]) =>
        obj instanceof PDFRawStream &&
        !obj.dict.has(pdf.context.obj("Subtype")),
    )
    .map(([, obj]) => {
      try {
        return Buffer.from(
          decodePDFRawStream(obj as PDFRawStream).decode(),
        ).toString();
      } catch {
        return "";
      }
    })
    .join("\n");
  return {
    pdf,
    has: (text: string) =>
      streams.includes(Buffer.from(text).toString("hex").toUpperCase()),
  };
}
test("PDF A4 possui tabelas, cinco ministros e versão sem transportar dados privados ao geral", async () => {
  const { pdf, has } = await inspect(await schedulePdf(fixture()));
  assert.equal(Math.round(pdf.getPage(0).getWidth()), 595);
  assert.equal(Math.round(pdf.getPage(0).getHeight()), 842);
  for (const header of ["Hora", "Ministro(s)", "Assistido(s)"])
    assert.ok(has(header));
  for (let i = 1; i <= 5; i++) assert.ok(has(`MINISTRO_${i}`));
  for (const privateText of [
    "PESSOA_X",
    "ENDERECO_PRIVADO",
    "FONE_PRIVADO",
    "TITULO_PRIVADO",
    "LOCAL_PRIVADO",
    "NOTA_PRIVADA",
  ])
    assert.equal(has(privateText), false);
});
test("guia completo usa snapshot de contatos e não publica observações privadas", async () => {
  const { has } = await inspect(await visitGuidePdf(fixture()));
  for (const text of ["PESSOA_X", "ENDERECO_PRIVADO", "FONE_PRIVADO"])
    assert.ok(has(text));
  assert.equal(has("NOTA_PRIVADA"), false);
});
test("mês extenso pagina e repete cabeçalhos sem omitir o último encontro", async () => {
  const s = fixture();
  s.events = Array.from({ length: 100 }, (_, i) =>
    event(`mass-${i}`, {
      title: `ENCONTRO_${i}`,
      notes:
        "Instruções operacionais extensas para validar quebra de linhas. ".repeat(
          8,
        ),
    }),
  );
  s.assignments = s.events.map((e) => ({
    eventId: e.id,
    ministerId: "minister-0",
  }));
  const { pdf, has } = await inspect(await schedulePdf(s));
  assert.ok(pdf.getPageCount() > 1);
  assert.ok(has("ENCONTRO_99"));
  for (const p of pdf.getPages()) assert.equal(Math.round(p.getHeight()), 842);
});

test("guia de visita agrupada inclui todos os contatos apenas para a equipe designada", async () => {
  const s = fixture();
  const visit = s.events.find((e) => e.kind === "VISIT")!;
  visit.assistedIds = ["person", "person-2"];
  s.assistedSnapshot!.push({
    ...s.assistedSnapshot![0],
    id: "person-2",
    name: "PESSOA_GRUPO",
    address: "ENDERECO_GRUPO",
  });
  const own = await inspect(await visitGuidePdf(s, "minister-0"));
  assert.equal(own.has("PESSOA_GRUPO"), true);
  assert.equal(own.has("ENDERECO_GRUPO"), true);
  const other = await inspect(await visitGuidePdf(s, "minister-1"));
  assert.equal(other.has("PESSOA_GRUPO"), false);
  const general = await inspect(await schedulePdf(s));
  assert.equal(general.has("PESSOA_GRUPO"), false);
  assert.equal(general.has("ENDERECO_GRUPO"), false);
});
