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
  "monthlyLimit",
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
    away: false,
    monthlyLimit: 6,
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
    editableFields
      .filter((k) => k in input)
      .map((k) => [k, k === "monthlyLimit" ? Number(input[k]) : input[k]]),
  );
  return ministerSchema.parse({ ...existing, ...changed });
}
export function validateSpouse(m: Minister, all: Minister[]) {
  if (!m.spouseId) return;
  const spouse = all.find((s) => s.id === m.spouseId);
  if (!spouse || spouse.id === m.id) throw new Error("Cônjuge inválido.");
  if (spouse.spouseId && spouse.spouseId !== m.id)
    throw new Error("Cônjuge já vinculado a outro cadastro.");
}
