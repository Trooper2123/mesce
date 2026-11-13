import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assistedSchema, type Assisted } from "./domain";
import { parseCsv, type CsvPlan } from "./minister-csv";
export const assistedCsvTemplate =
  "id;nome;endereco;bairro;cidade;uf;cep;telefone_fixo;telefone_movel;familiar;telefone_familiar;quantidade_ministros;visita_grupal;ativo;observacoes\n;Assistido Exemplo;Rua Exemplo 10;Centro;Brasilia;DF;70000000;6133333333;61999999999;Familiar Exemplo;61988888888;1;NAO;SIM;Dados ficticios - substitua antes de importar\n;Instituicao Exemplo;Rua Exemplo 20;Centro;Brasilia;DF;70000000;;61977777777;Responsavel Exemplo;61966666666;3;SIM;SIM;Exemplo de visita grupal com tres ministros\n";
const fields = {
  nome: "name",
  endereco: "address",
  bairro: "neighborhood",
  cidade: "city",
  uf: "state",
  cep: "postalCode",
  telefone_fixo: "landline",
  telefone_movel: "mobile",
  familiar: "familyName",
  telefone_familiar: "familyPhone",
  observacoes: "notes",
} as const;
const fingerprint = (a: Assisted) =>
  [a.name, a.address]
    .map((v) => v.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " "))
    .join("|");
export function planAssistedCsv(
  source: string,
  current: Assisted[],
  update: boolean,
) {
  const rows = parseCsv(source, assistedCsvTemplate.split("\n")[0].split(";"), [
    "nome",
  ]);
  const assisted: Assisted[] = [];
  const summary: CsvPlan["summary"] = [];
  const ids = new Set<string>(),
    seen = new Set<string>();
  let skipped = 0;
  rows.forEach((row, i) => {
    try {
      if (row.id && !z.string().uuid().safeParse(row.id).success)
        throw new Error("ID inválido.");
      if (row.id && ids.has(row.id)) throw new Error("ID repetido no arquivo.");
      if (row.id) ids.add(row.id);
      const existing = row.id
        ? current.find((a) => a.id === row.id)
        : undefined;
      if (row.id && !existing)
        throw new Error("ID não encontrado. Deixe id vazio para criar.");
      const candidate: Record<string, unknown> = {
        ...(existing ?? {
          id: randomUUID(),
          name: "",
          address: "",
          neighborhood: "",
          city: "",
          state: "",
          postalCode: "",
          landline: "",
          mobile: "",
          familyName: "",
          familyPhone: "",
          notes: "",
          active: true,
          ministersRequired: 1,
          groupVisit: false,
        }),
      };
      for (const [column, key] of Object.entries(fields))
        if (column in row) candidate[key] = row[column];
      if ("quantidade_ministros" in row)
        candidate.ministersRequired = Number(row.quantidade_ministros);
      if ("visita_grupal" in row) {
        if (!["SIM", "NAO", "NÃO"].includes(row.visita_grupal.toUpperCase()))
          throw new Error("Visita grupal deve ser SIM ou NAO.");
        candidate.groupVisit = row.visita_grupal.toUpperCase() === "SIM";
      }
      if ("ativo" in row) {
        if (!["SIM", "NAO", "NÃO"].includes(row.ativo.toUpperCase()))
          throw new Error("Ativo deve ser SIM ou NAO.");
        candidate.active = row.ativo.toUpperCase() === "SIM";
      }
      const value = assistedSchema.parse(candidate);
      const key = fingerprint(value);
      if (seen.has(key))
        throw new Error(
          "Nome e endereço repetidos no arquivo; revise os registros.",
        );
      seen.add(key);
      const similar = current.filter(
        (a) => a.id !== existing?.id && fingerprint(a) === key,
      );
      if (similar.length > 0) {
        if (row.id || update)
          throw new Error(
            "Cadastro semelhante existente. Informe o ID correto; não atualizamos apenas por nome e endereço.",
          );
        skipped++;
        summary.push({
          line: i + 2,
          name: value.name,
          email: "Sem ID; cadastro semelhante",
          operation: "Ignorar semelhante",
          ministersRequired: value.ministersRequired ?? 1,
          missing: [],
        });
        return;
      }
      if (existing && !update) {
        skipped++;
        summary.push({
          line: i + 2,
          name: existing.name,
          email: existing.id,
          operation: "Ignorar existente",
          ministersRequired: existing.ministersRequired ?? 1,
          missing: [],
        });
        return;
      }
      assisted.push(value);
      summary.push({
        line: i + 2,
        name: value.name,
        email: existing?.id ?? "Novo",
        operation: existing ? "Atualizar" : "Criar",
        ministersRequired: value.ministersRequired ?? 1,
        missing: [],
      });
    } catch (e) {
      throw new Error(
        `Linha ${i + 2}: ${e instanceof Error && !("issues" in e) ? e.message : "campos inválidos; confira nome e quantidade de ministros (inteiro de 1 a 100)."}`,
      );
    }
  });
  return { assisted, summary, skipped };
}
