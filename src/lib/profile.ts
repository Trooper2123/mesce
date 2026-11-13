import { ministerSchema, Minister } from "./domain";
export const editableFields = [
  "name",
  "birthDate",
  "phone",
  "ministryStart",
  "address",
  "neighborhood",
  "city",
  "state",
  "postalCode",
  "notes",
  "servicePreference",
  "location",
  "locationPreference",
  "spouseId",
  "couplePreference",
] as const;
export function blankMinister(id: string, email: string): Minister {
  return {
    id,
    email,
    name: "",
    birthDate: "",
    phone: "",
    ministryStart: "",
    address: "",
    neighborhood: "",
    city: "",
    state: "",
    postalCode: "",
    active: true,
    monthlyLimit: null,
    spouseId: "",
    couplePreference: "NONE",
    location: "Matriz",
    locationPreference: "ACCEPT",
    notes: "",
  };
}
export function ownProfile(
  input: Record<string, unknown>,
  existing: Minister,
): Minister {
  const changed = Object.fromEntries(
    editableFields.filter((k) => k in input).map((k) => [k, input[k]]),
  );
  return ministerSchema.parse({ ...existing, ...changed });
}
export function missingMinisterFields(m: Minister): string[] {
  const fields = {
    name: "nome completo",
    birthDate: "data de nascimento",
    phone: "telefone",
    ministryStart: "início no ministério",
    address: "endereço",
    neighborhood: "bairro",
    city: "cidade",
    state: "UF",
  } as const;
  return Object.entries(fields)
    .filter(([key]) => !String(m[key as keyof typeof fields] ?? "").trim())
    .map(([, label]) => label);
}
export function requireCompleteMinister(m: Minister): Minister {
  const missing = missingMinisterFields(m);
  if (missing.length)
    throw new Error(
      "Complete os campos: " +
        missing.join(", ") +
        ". Para preencher depois, salve como pendente.",
    );
  return { ...m, registrationStatus: "COMPLETE" };
}
export function validateSpouse(m: Minister, all: Minister[]) {
  if (!m.spouseId) return;
  const spouse = all.find((s) => s.id === m.spouseId);
  if (!spouse || spouse.id === m.id) throw new Error("Cônjuge inválido.");
  if (spouse.spouseId && spouse.spouseId !== m.id)
    throw new Error("Cônjuge já vinculado a outro cadastro.");
}
