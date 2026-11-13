import { test } from "node:test";
import assert from "node:assert/strict";
import { assistedCsvTemplate, planAssistedCsv } from "../src/lib/assisted-csv";
import {
  csvState,
  csvTemplate,
  planMinisterCsv,
} from "../src/lib/minister-csv";
test("modelos de exemplo são válidos nos dois importadores e contêm só dados fictícios", () => {
  const a = planAssistedCsv("\uFEFF" + assistedCsvTemplate, [], false);
  assert.equal(a.assisted.length, 2);
  assert.deepEqual(
    a.assisted.map((a) => a.ministersRequired),
    [1, 3],
  );
  assert.equal(
    planMinisterCsv("\uFEFF" + csvTemplate, [], false).ministers.length,
    1,
  );
});
test("assistidos aceitam acentos, vírgulas, campos entre aspas, contatos e zeros", () => {
  const p = planAssistedCsv(
    'nome,endereco,telefone_fixo,telefone_movel,familiar,telefone_familiar,cep,quantidade_ministros,ativo\n"José, Exemplo","Rua 1\nBloco A",06133333333,06199999999,Familiar,06188888888,00000001,4,NAO',
    [],
    false,
  );
  const a = p.assisted[0];
  assert.equal(a.name, "José, Exemplo");
  assert.equal(a.address, "Rua 1\nBloco A");
  assert.equal(a.landline, "06133333333");
  assert.equal(a.mobile, "06199999999");
  assert.equal(a.familyPhone, "06188888888");
  assert.equal(a.postalCode, "00000001");
  assert.equal(a.ministersRequired, 4);
  assert.equal(a.active, false);
});
test("ID é obrigatório para atualizar e campos omitidos são preservados", () => {
  const current = planAssistedCsv(
    "nome;endereco;quantidade_ministros\nPessoa Sintética;Rua A;3",
    [],
    false,
  ).assisted;
  const id = current[0].id;
  const updated = planAssistedCsv(
    "id;nome\n" + id + ";Nome corrigido",
    current,
    true,
  ).assisted[0];
  assert.equal(updated.id, id);
  assert.equal(updated.address, "Rua A");
  assert.equal(updated.ministersRequired, 3);
  assert.equal(
    planAssistedCsv("id;nome\n" + id + ";Nome corrigido", current, false)
      .skipped,
    1,
  );
  assert.throws(
    () =>
      planAssistedCsv("nome;endereco\nPessoa Sintética;Rua A", current, true),
    /ID correto/,
  );
  assert.equal(
    planAssistedCsv("nome;endereco\nPessoa Sintética;Rua A", current, false)
      .skipped,
    1,
  );
});
test("duplicidades, IDs inválidos e desconhecidos são rejeitados", () => {
  const current = planAssistedCsv("nome\nPessoa Sintética", [], false).assisted;
  assert.throws(
    () =>
      planAssistedCsv("nome\nPessoa Sintética\nPessoa Sintética", [], false),
    /repetidos/,
  );
  assert.throws(
    () => planAssistedCsv("id;nome\nabc;Pessoa Sintética", [], true),
    /ID inválido/,
  );
  assert.throws(
    () =>
      planAssistedCsv(
        "id;nome\n" + current[0].id + ";Pessoa Sintética",
        [],
        true,
      ),
    /não encontrado/,
  );
  assert.throws(
    () =>
      planAssistedCsv(
        "id;nome\n" +
          current[0].id +
          ";Pessoa A\n" +
          current[0].id +
          ";Pessoa B",
        current,
        true,
      ),
    /ID repetido/,
  );
});
test("validação rejeita lote inteiro sem mutar cadastros quando há quantidade inválida", () => {
  const current = planAssistedCsv("nome\nPessoa Sintética", [], false).assisted;
  const before = JSON.stringify(current);
  for (const n of ["0", "-1", "1.5", "101", "", "abc"])
    assert.throws(
      () =>
        planAssistedCsv(
          "nome;quantidade_ministros\nPessoa válida;2\nPessoa inválida;" + n,
          current,
          true,
        ),
      /Linha 3/,
    );
  assert.equal(JSON.stringify(current), before);
  assert.throws(
    () => planAssistedCsv("nome;ativo\nPessoa Sintética;TALVEZ", [], false),
    /SIM ou NAO/,
  );
});
test("limites, cabeçalhos e aspas são verificados; estado muda com alteração do cadastro", () => {
  assert.throws(
    () => planAssistedCsv("nome;nome\nPessoa;Pessoa", [], false),
    /Cabeçalhos/,
  );
  assert.throws(() => planAssistedCsv('nome\n"Pessoa', [], false), /aspas/);
  assert.throws(
    () => planAssistedCsv("nome\n" + "a".repeat(500000), [], false),
    /500 KB/,
  );
  assert.throws(
    () =>
      planAssistedCsv(
        "nome\n" +
          Array.from({ length: 501 }, (_, i) => "Pessoa " + i).join("\n"),
        [],
        false,
      ),
    /500 registros/,
  );
  const a = planAssistedCsv("nome\nPessoa Sintética", [], false).assisted;
  assert.notEqual(csvState(a), csvState([{ ...a[0], ministersRequired: 3 }]));
});
