/** Full names remain in the registry; schedules snapshot the chosen display name. */
export function ministerDisplayName(minister: {
  name: string;
  preferredName?: string;
}) {
  return minister.preferredName?.trim() || minister.name;
}
