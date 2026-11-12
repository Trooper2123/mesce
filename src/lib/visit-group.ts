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
