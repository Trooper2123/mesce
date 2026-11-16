import type { Assisted, Event } from "./domain";
export function visitAssistedIds(
  event: Pick<Event, "assistedId" | "assistedIds">,
): string[] {
  return [
    ...new Set(
      [event.assistedId, ...(event.assistedIds ?? [])].filter(Boolean),
    ),
  ];
}
export function isAltevitaGroupVisit(
  event: Event,
  assisted: Assisted[],
): boolean {
  if (event.kind !== "VISIT") return false;
  const ids = visitAssistedIds(event);
  const related = assisted.filter((person) => ids.includes(person.id));
  const normalized = (value: string) =>
    value
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  return (
    event.visitSite === "ALTEVITA" ||
    [
      event.title,
      ...related.flatMap((person) => [person.name, person.groupName ?? ""]),
    ].some(
      (value) =>
        normalized(value).includes("altevita") ||
        normalized(value).includes("alatevite"),
    )
  );
}
export function sameVisitAddress(
  a: Assisted | undefined,
  b: Assisted | undefined,
): boolean {
  const normalize = (value: string) =>
    value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  return (
    !!a &&
    !!b &&
    !!a.address.trim() &&
    !!b.address.trim() &&
    (["address", "neighborhood", "city", "state", "postalCode"] as const).every(
      (key) => normalize(a[key]) === normalize(b[key]),
    )
  );
}
