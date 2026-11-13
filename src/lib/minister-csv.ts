import { createHash } from "node:crypto";
import { ministerSchema, type Minister } from "./domain";
import { blankMinister, missingMinisterFields } from "./profile";
import { normalizeEmail } from "./registration";
export const csvTemplate =
  "nome;email;nascimento;telefone;inicio_ministerio;endereco;bairro;cidade;uf;cep;situacao;conjuge_email;preferencia_casal;atividades;comunidade;preferencia_comunidade;limite_mensal;observacoes\nMinistro Exemplo;exemplo@example.invalid;1980-01-15;61999999999;2020-01-01;Rua Exemplo 10;Centro;Brasilia;DF;70000000;ATIVO;;SEM_PREFERENCIA;AMBAS;Matriz;ACEITA;;Dados ficticios\n";
const columns = csvTemplate.split("\n")[0].split(";");
export function csvState(ministers: Minister[]) {
  return createHash("sha256")
    .update(
      JSON.stringify([...ministers].sort((a, b) => a.id.localeCompare(b.id))),
    )
    .digest("hex");
}
export function parseMinisterCsv(source: string): Record<string, string>[] {
  if (Buffer.byteLength(source, "utf8") > 500_000)
    throw new Error("Arquivo excede 500 KB.");
  source = source.replace(/^\uFEFF/, "");
  let inQuote = false,
    comma = 0,
    semi = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (c === "\n" || c === "\r") break;
      if (c === ",") comma++;
      if (c === ";") semi++;
    }
  }
  const delimiter = semi >= comma ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  function endField() {
    row.push(field);
    field = "";
    closed = false;
  }
  function endRow() {
    endField();
    if (row.some((x) => x.trim())) rows.push(row);
    row = [];
    if (rows.length > 501)
      throw new Error("Máximo de 500 ministros por arquivo.");
  }
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new Error("Aspas em posição inválida no CSV.");
      quoted = true;
    } else if (c === delimiter) endField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      endRow();
    } else {
      if (closed && !/\s/.test(c))
        throw new Error("Conteúdo inválido após aspas.");
      if (!closed) field += c;
    }
  }
  if (quoted) throw new Error("Campo com aspas não foi fechado.");
  if (field || row.length || closed) endRow();
  if (rows.length < 2)
    throw new Error("Inclua o cabeçalho e pelo menos um ministro.");
  const header = rows.shift()!.map((h) => h.trim().toLowerCase());
  if (
    new Set(header).size !== header.length ||
    header.some((h) => !columns.includes(h)) ||
    !["nome", "email"].every((h) => header.includes(h))
  )
    throw new Error(
      "Cabeçalhos inválidos. Use o modelo: nome e email são obrigatórios, demais colunas são opcionais.",
    );
  return rows.map((r, index) => {
    if (r.length !== header.length)
      throw new Error(
        `Linha ${index + 2}: quantidade de colunas diferente do cabeçalho.`,
      );
    return Object.fromEntries(header.map((h, i) => [h, r[i].trim()]));
  });
}
export type CsvPlan = {
  ministers: Minister[];
  skipped: number;
  summary: {
    line: number;
    name: string;
    email: string;
    operation: string;
    missing: string[];
  }[];
};
export function planMinisterCsv(
  source: string,
  current: Minister[],
  update: boolean,
): CsvPlan {
  const rows = parseMinisterCsv(source),
    seen = new Set<string>();
  const result: Minister[] = [];
  let skipped = 0;
  const summary: CsvPlan["summary"] = [];
  const spouses = new Map<string, string>();
  const fields: Record<string, string> = {
    nome: "name",
    email: "email",
    nascimento: "birthDate",
    telefone: "phone",
    inicio_ministerio: "ministryStart",
    endereco: "address",
    bairro: "neighborhood",
    cidade: "city",
    uf: "state",
    cep: "postalCode",
    comunidade: "location",
    observacoes: "notes",
  };
  rows.forEach((row, index) => {
    try {
      const email = normalizeEmail(row.email ?? "");
      if (seen.has(email)) throw new Error("E-mail repetido no arquivo.");
      seen.add(email);
      const matches = current.filter(
        (m) => m.email.trim().toLowerCase() === email,
      );
      if (matches.length > 1)
        throw new Error("E-mail ambíguo no banco; corrija antes de importar.");
      const existing = matches[0];
      if (existing && !update) {
        skipped++;
        summary.push({
          line: index + 2,
          name: existing.name,
          email,
          operation: "Ignorar existente",
          missing: missingMinisterFields(existing),
        });
        return;
      }
      const value: Record<string, unknown> = {
        ...(existing ?? blankMinister(crypto.randomUUID(), email)),
      };
      for (const [column, key] of Object.entries(fields))
        if (column in row) value[key] = row[column];
      value.email = email;
      if ("situacao" in row) {
        const status = row.situacao.toUpperCase();
        if (!["ATIVO", "EX_MINISTRO"].includes(status))
          throw new Error("Situação inválida.");
        value.active = status === "ATIVO";
        value.former = status === "EX_MINISTRO";
      }
      if ("limite_mensal" in row)
        value.monthlyLimit = row.limite_mensal
          ? Number(row.limite_mensal)
          : null;
      const enums: Record<
        string,
        { key: string; map: Record<string, string> }
      > = {
        preferencia_casal: {
          key: "couplePreference",
          map: {
            SEM_PREFERENCIA: "NONE",
            JUNTOS: "TOGETHER",
            SEPARADOS: "SEPARATE",
          },
        },
        atividades: {
          key: "servicePreference",
          map: {
            AMBAS: "BOTH",
            CELEBRACOES: "CELEBRATIONS",
            VISITAS: "VISITS",
          },
        },
        preferencia_comunidade: {
          key: "locationPreference",
          map: {
            ACEITA: "ACCEPT",
            PREFERENCIAL: "PREFER",
            EXCLUSIVA: "EXCLUSIVE",
          },
        },
      };
      for (const [column, { key, map }] of Object.entries(enums))
        if (column in row && row[column]) {
          if (!map[row[column].toUpperCase()])
            throw new Error(`Valor inválido em ${column}.`);
          value[key] = map[row[column].toUpperCase()];
        }
      const m = ministerSchema.parse(value);
      m.registrationStatus = missingMinisterFields(m).length
        ? "DRAFT"
        : "COMPLETE";
      if ("conjuge_email" in row)
        spouses.set(
          m.id,
          row.conjuge_email ? normalizeEmail(row.conjuge_email) : "",
        );
      result.push(m);
      summary.push({
        line: index + 2,
        name: m.name,
        email,
        operation: existing ? "Atualizar" : "Criar",
        missing: missingMinisterFields(m),
      });
    } catch (e) {
      throw new Error(
        `Linha ${index + 2}: ${e instanceof Error && !("issues" in e) ? e.message : "campos inválidos; confira datas, nome e limite no modelo."}`,
      );
    }
  });
  const merged = new Map(current.map((m) => [m.id, { ...m }]));
  for (const m of result) merged.set(m.id, m);
  // Resolve spouse emails only after all rows exist; never identify someone by name.
  for (const [id, email] of spouses) {
    const m = merged.get(id)!;
    if (!email) {
      if (m.spouseId) {
        const old = merged.get(m.spouseId);
        if (old?.spouseId === id) {
          old.spouseId = "";
          old.couplePreference = "NONE";
          if (!result.some((x) => x.id === old.id)) result.push(old);
        }
      }
      m.spouseId = "";
      m.couplePreference = "NONE";
      continue;
    }
    const matches = [...merged.values()].filter(
      (x) => x.email.toLowerCase() === email,
    );
    if (matches.length !== 1 || matches[0].id === id)
      throw new Error("Cônjuge ausente, ambíguo ou igual ao próprio ministro.");
    const spouse = matches[0];
    if (
      spouses.has(spouse.id) &&
      spouses.get(spouse.id) !== m.email.toLowerCase()
    )
      throw new Error("O casal tem referências divergentes no arquivo.");
    if (
      spouses.has(spouse.id) &&
      spouse.couplePreference !== m.couplePreference
    )
      throw new Error("O casal tem preferências divergentes no arquivo.");
    if (
      (m.spouseId && m.spouseId !== spouse.id) ||
      (spouse.spouseId && spouse.spouseId !== id)
    )
      throw new Error(
        "Vínculo conjugal existente conflita com o CSV; revise no cadastro.",
      );
    m.spouseId = spouse.id;
    spouse.spouseId = id;
    spouse.couplePreference = m.couplePreference;
    if (!result.some((x) => x.id === spouse.id)) result.push(spouse);
  }
  return { ministers: result, summary, skipped };
}
