import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  blankMinister,
  requireCompleteMinister,
  missingMinisterFields,
  ownProfile,
} from "../src/lib/profile";
import {
  blocked,
  defaultSettings,
  emptyData,
  type Event,
} from "../src/lib/domain";
import { parseEventForm } from "../src/lib/event-input";
import {
  parseAbsenceBatch,
  validateAbsenceSubmission,
} from "../src/lib/absence-input";
import {
  parseMinisterCsv,
  planMinisterCsv,
  csvState,
  csvTemplate,
} from "../src/lib/minister-csv";
const minister = () => ({
  ...blankMinister(randomUUID(), "pessoa@example.invalid"),
  name: "Pessoa Sintética",
  phone: "61999999999",
  birthDate: "1980-01-01",
  ministryStart: "2020-01-01",
  address: "Rua Sintética 10",
  neighborhood: "Centro",
  city: "Brasília",
  state: "DF",
});
const event = (extra: Partial<Event> = {}): Event => ({
  id: randomUUID(),
  title: "Celebração sintética",
  date: "2030-11-03",
  time: "08:00",
  duration: 60,
  kind: "MASS",
  location: "Matriz",
  required: 1,
  assistedId: "",
  notes: "",
  ...extra,
});
test("formulário distingue entidade e tipo; missa não precisa de assistido", () => {
  const e = event();
  const form = new FormData();
  for (const [k, v] of Object.entries(e)) form.set(k, String(v));
  form.set("kind", "event");
  form.set("eventKind", "MASS");
  form.set("assistedId", "valor indevido");
  assert.equal(parseEventForm(form, e.id).assistedId, "");
  form.append("kind", "VISIT");
  assert.throws(() => parseEventForm(form, e.id), /Tipo de atividade/);
});
test("visita exige assistido e domingo também no servidor", () => {
  const e = event();
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, String(v));
  f.set("kind", "event");
  f.set("eventKind", "VISIT");
  assert.throws(() => parseEventForm(f, e.id));
  f.set("assistedId", randomUUID());
  assert.equal(parseEventForm(f, e.id).kind, "VISIT");
  f.set("date", "2030-11-04");
  assert.throws(() => parseEventForm(f, e.id));
});
test("completude distingue pendente e concluído sem exigir observações ou cônjuge", () => {
  const m = minister();
  assert.deepEqual(missingMinisterFields(m), []);
  assert.equal(requireCompleteMinister(m).registrationStatus, "COMPLETE");
  assert.throws(
    () => requireCompleteMinister({ ...m, phone: "   ", address: "" }),
    /telefone, endereço/,
  );
});
test("cadastro pendente e ex-ministro bloqueiam atribuição automática e manual", () => {
  const m = minister(),
    e = event(),
    data = { ...emptyData(), ministers: [m], events: [e] };
  assert.equal(
    blocked({ ...m, former: true }, e, data, [], [e]),
    "Ex-ministro",
  );
  assert.equal(
    blocked({ ...m, registrationStatus: "DRAFT" }, e, data, [], [e]),
    "Cadastro pendente",
  );
});
test("sem limite não impõe teto e limite explícito continua respeitado", () => {
  const m = minister(),
    e = event(),
    other = event({ time: "12:00" }),
    data = emptyData();
  const assignments = [{ ministerId: m.id, eventId: e.id }];
  assert.equal(defaultSettings.monthlyLimit, null);
  assert.equal(
    blocked({ ...m, monthlyLimit: null }, other, data, assignments, [e, other]),
    "",
  );
  assert.equal(
    blocked({ ...m, monthlyLimit: 1 }, other, data, assignments, [e, other]),
    "Limite mensal atingido",
  );
});
test("modalidade de visitas não compara comunidade com endereço do assistido", () => {
  const m = {
      ...minister(),
      locationPreference: "EXCLUSIVE" as const,
      servicePreference: "VISITS" as const,
    },
    visit = event({
      kind: "VISIT",
      location: "Outro bairro",
      assistedId: randomUUID(),
    });
  assert.equal(blocked(m, visit, emptyData(), [], [visit]), "");
  assert.match(blocked(m, event(), emptyData(), [], []), /Atividade/);
  assert.match(
    blocked(
      { ...m, servicePreference: "CELEBRATIONS" },
      visit,
      emptyData(),
      [],
      [],
    ),
    /Atividade/,
  );
});
test("ministro não altera limite, situação administrativa ou completude por envio direto", () => {
  const m = { ...minister(), monthlyLimit: 2, former: false };
  const changed = ownProfile(
    {
      monthlyLimit: null,
      former: true,
      registrationStatus: "COMPLETE",
      active: false,
    },
    m,
  );
  assert.equal(changed.monthlyLimit, 2);
  assert.equal(changed.former, false);
  assert.equal(changed.registrationStatus, undefined);
  assert.equal(changed.active, true);
});
function batch() {
  const f = new FormData();
  f.set("ministerId", minister().id);
  for (const n of [0, 1]) {
    f.append("rows", String(n));
    f.set(`row.${n}.scope`, "DAY");
    f.set(`row.${n}.start`, `2030-11-0${n + 3}`);
  }
  return f;
}
test("lote suporta dias avulsos, período inclusivo e deduplica equivalentes", () => {
  const f = batch();
  let rows = parseAbsenceBatch(f);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].end, rows[0].start);
  f.set("row.1.scope", "PERIOD");
  f.set("row.1.end", "2030-11-08");
  rows = parseAbsenceBatch(f);
  assert.equal(rows[1].end, "2030-11-08");
  f.set("row.1.scope", "DAY");
  f.set("row.1.start", "2030-11-03");
  assert.equal(parseAbsenceBatch(f).length, 1);
});
test("linha inválida rejeita o lote e ministro não consegue trocar destinatário nem prazo", () => {
  const f = batch();
  f.set("row.1.start", "inválida");
  assert.throws(() => parseAbsenceBatch(f));
  const m = minister();
  const valid = batch();
  valid.set("ministerId", m.id);
  const a = parseAbsenceBatch(valid)[0];
  const data = { ...emptyData(), ministers: [m] };
  const user = {
    id: "sub",
    email: m.email,
    verified: true,
    coordinator: false,
    ministerId: m.id,
  };
  assert.doesNotThrow(() =>
    validateAbsenceSubmission(a, user, data, new Date("2030-10-25T12:00:00Z")),
  );
  assert.throws(
    () =>
      validateAbsenceSubmission(
        a,
        user,
        data,
        new Date("2030-10-26T12:00:00Z"),
      ),
    /dia 25/,
  );
  assert.throws(
    () =>
      validateAbsenceSubmission(a, { ...user, ministerId: randomUUID() }, data),
    /seus impedimentos/,
  );
  assert.doesNotThrow(() =>
    validateAbsenceSubmission(
      a,
      { ...user, coordinator: true, ministerId: undefined },
      data,
      new Date("2030-10-30T12:00:00Z"),
    ),
  );
});
test("CSV aceita BOM, aspas, acentos, vírgula e quebra de linha em campo", () => {
  const rows = parseMinisterCsv(
    '\uFEFFnome,email,observacoes\r\n"José, Exemplo",a@example.invalid,"linha 1\nlinha 2"\r\n',
  );
  assert.equal(rows[0].nome, "José, Exemplo");
  assert.match(rows[0].observacoes, /\n/);
  assert.equal(parseMinisterCsv(csvTemplate).length, 1);
});
test("CSV rejeita cabeçalhos repetidos, colunas extras, arquivo grande, aspas e e-mails duplicados", () => {
  assert.throws(() => parseMinisterCsv("nome;nome;email\na;b;c"));
  assert.throws(() => parseMinisterCsv("nome;email\na;b;c"));
  assert.throws(() => parseMinisterCsv('nome;email\n"abc;x'));
  assert.throws(() => parseMinisterCsv("a".repeat(500001)));
  assert.throws(
    () =>
      planMinisterCsv(
        "nome;email\nPessoa A;a@example.invalid\nPessoa B;A@example.invalid",
        [],
        false,
      ),
    /repetido/,
  );
});
test("CSV ignora existentes por padrão, atualização preserva UUID e preferências ausentes", () => {
  const m = minister();
  const source = `nome;email\nOutro Nome;${m.email}`;
  assert.equal(planMinisterCsv(source, [m], false).ministers.length, 0);
  const plan = planMinisterCsv(source, [m], true);
  assert.equal(plan.ministers[0].id, m.id);
  assert.equal(plan.ministers[0].phone, m.phone);
  assert.equal(plan.ministers[0].registrationStatus, "COMPLETE");
  assert.notEqual(csvState([m]), csvState(plan.ministers));
});
test("CSV incompleto vira pendente; datas impossíveis não são importadas", () => {
  const plan = planMinisterCsv(
    "nome;email\nPessoa Exemplo;a@example.invalid",
    [],
    false,
  );
  assert.equal(plan.ministers[0].registrationStatus, "DRAFT");
  assert.ok(plan.summary[0].missing.includes("telefone"));
  assert.throws(
    () =>
      planMinisterCsv(
        "nome;email;nascimento\nPessoa Exemplo;a@example.invalid;2030-02-30",
        [],
        false,
      ),
    /Linha 2/,
  );
});
test("CSV resolve casal no mesmo arquivo e rejeita referência inexistente ou troca ambígua", () => {
  const source =
    "nome;email;conjuge_email;preferencia_casal\nPessoa A;a@example.invalid;b@example.invalid;JUNTOS\nPessoa B;b@example.invalid;a@example.invalid;JUNTOS";
  const plan = planMinisterCsv(source, [], false);
  assert.equal(plan.ministers[0].spouseId, plan.ministers[1].id);
  assert.equal(plan.ministers[1].spouseId, plan.ministers[0].id);
  assert.throws(
    () =>
      planMinisterCsv(
        "nome;email;conjuge_email\nPessoa A;a@example.invalid;naoexiste@example.invalid",
        [],
        false,
      ),
    /Cônjuge/,
  );
});

test("visitas comuns exigem um ministro; Altevita permite três ou mais", () => {
  const e = event({ kind: "VISIT", assistedId: randomUUID() });
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, String(v));
  f.set("kind", "event");
  f.set("eventKind", "VISIT");
  assert.equal(parseEventForm(f, e.id).required, 1);
  f.set("required", "2");
  assert.throws(() => parseEventForm(f, e.id), /1 ministro/);
  f.set("visitSite", "ALTEVITA");
  assert.throws(() => parseEventForm(f, e.id), /pelo menos 3/);
  for (const n of [3, 4, 10]) {
    f.set("required", String(n));
    assert.equal(parseEventForm(f, e.id).required, n);
  }
  f.set("visitSite", "OUTRO");
  assert.throws(() => parseEventForm(f, e.id));
});
