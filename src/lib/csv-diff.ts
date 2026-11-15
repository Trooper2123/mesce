import type { Assisted, Minister } from "./domain";
import type { Location } from "./location-rules";

export type CsvRecordChange = {
  key: string;
  beforeName: string;
  afterName: string;
  identifier: string;
  fields: { label: string; before: string; after: string }[];
};

const ministerLabels: Partial<Record<keyof Minister, string>> = {
  name: "Nome",
  preferredName: "Nome de preferência",
  email: "E-mail de acesso",
  birthDate: "Nascimento",
  phone: "Telefone",
  ministryStart: "Início no ministério",
  address: "Endereço",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  postalCode: "CEP",
  active: "Ativo",
  former: "Ex-ministro",
  monthlyLimit: "Limite mensal",
  spouseId: "Cônjuge",
  couplePreference: "Preferência do casal",
  servicePreference: "Atividades",
  location: "Comunidades",
  locationIds: "Comunidades vinculadas",
  locationPreference: "Preferência de comunidade",
  registrationStatus: "Situação do cadastro",
  notes: "Observações",
};

// @ts-ignore
const assistedLabels: Partial<Record<keyof Assisted, string>> = {
  name: "Nome",
  address: "Endereço",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  postalCode: "CEP",
  landline: "Telefone fixo",
  mobile: "Telefone móvel",
  familyName: "Familiar de referência",
  familyPhone: "Telefone do familiar",
  ministersRequired: "Ministros por visita",
  active: "Ativo",
  notes: "Observações",
};

const enumLabels: Record<string, Record<string, string>> = {
  couplePreference: {
    NONE: "Sem preferência",
    TOGETHER: "Juntos",
    SEPARATE: "Separados",
  },
  servicePreference: {
    BOTH: "Ambas",
    CELEBRATIONS: "Celebrações",
    VISITS: "Visitas",
  },
  locationPreference: {
    ACCEPT: "Aceita",
    PREFER: "Preferencial",
    EXCLUSIVE: "Exclusiva",
  },
  registrationStatus: { DRAFT: "Pendente", COMPLETE: "Completo" },
};

function display(
  value: unknown,
  field: string,
  ministers: Minister[],
  locations: Location[],
) {
  if (field === "monthlyLimit" && value === null) return "Sem limite";
  if (value === undefined || value === null || value === "") return "—";
  if (field === "spouseId")
    return (
      ministers.find((minister) => minister.id === value)?.name ?? "Sem vínculo"
    );
  if (field === "locationIds" && Array.isArray(value))
    return (
      value
        .map((id) => locations.find((location) => location.id === id)?.name)
        .filter(Boolean)
        .join(", ") || "Nenhuma"
    );
  if (enumLabels[field]?.[String(value)])
    return enumLabels[field][String(value)];
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.join(", ") || "Nenhum";
  return String(value);
}

function changesFor<T extends { id: string; name: string }>(
  previous: T,
  next: T,
  labels: Partial<Record<keyof T, string>>,
  ministers: Minister[],
  locations: Location[],
) {
  return Object.entries(labels).flatMap(([field, label]) => {
    const before = previous[field as keyof T];
    const after = next[field as keyof T];
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    return [
      {
        label: label!,
        before: display(before, field, ministers, locations),
        after: display(after, field, ministers, locations),
      },
    ];
  });
}

export function ministerCsvChanges(
  previous: Minister[],
  next: Minister[],
  locations: Location[],
): CsvRecordChange[] {
  const beforeById = new Map(
    previous.map((minister) => [minister.id, minister]),
  );
  const allMinisters = new Map(
    previous.map((minister) => [minister.id, minister]),
  );
  for (const minister of next) allMinisters.set(minister.id, minister);
  const references = [...allMinisters.values()];
  return next.flatMap((minister) => {
    const before = beforeById.get(minister.id);
    if (!before) return [];
    const fields = changesFor(
      before,
      minister,
      ministerLabels,
      references,
      locations,
    );
    return fields.length
      ? [
          {
            key: minister.id,
            beforeName: before.name,
            afterName: minister.name,
            identifier: minister.email,
            fields,
          },
        ]
      : [];
  });
}

export function assistedCsvChanges(
  previous: Assisted[],
  next: Assisted[],
): CsvRecordChange[] {
  const beforeById = new Map(previous.map((person) => [person.id, person]));
  return next.flatMap((person) => {
    const before = beforeById.get(person.id);
    if (!before) return [];
    const fields = changesFor(before, person, assistedLabels, [], []);
    return fields.length
      ? [
          {
            key: person.id,
            beforeName: before.name,
            afterName: person.name,
            identifier: person.id,
            fields,
          },
        ]
      : [];
  });
}
