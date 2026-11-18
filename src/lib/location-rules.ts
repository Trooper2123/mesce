export type LocationAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  geocodedAt?: string;
  geocodePrecision?: "ROOFTOP" | "STREET" | "POSTAL_CODE" | "CITY";
};
export type Location = {
  id: string;
  name: string;
  active: boolean;
  address?: LocationAddress;
};
export const defaultLocations: Location[] = [
  { id: "46c10000-0000-4000-8000-000000000001", name: "Matriz", active: true },
  {
    id: "46c10000-0000-4000-8000-000000000002",
    name: "Carmelo Nossa Senhora do Carmo",
    active: true,
  },
  {
    id: "46c10000-0000-4000-8000-000000000003",
    name: "Capela Nossa Senhora Aparecida",
    active: true,
  },
];
export const locationKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export function matchesLocation(
  m: { location: string; locationIds?: string[] },
  e: { location: string; locationId?: string },
) {
  return m.locationIds?.length && e.locationId
    ? m.locationIds.includes(e.locationId)
    : m.location
        .split(";")
        .some((name) => locationKey(name) === locationKey(e.location));
}
