import { Data, Schedule } from "./domain";
export type Identity = {
  id: string;
  email: string;
  verified: boolean;
  coordinator: boolean;
};
export function linkedMinister(user: Identity, data: Data) {
  return data.ministers.find(
    (m) =>
      m.active &&
      user.verified &&
      m.email.toLowerCase() === user.email.toLowerCase(),
  );
}
export function canDownload(user: Identity, data: Data, schedule: Schedule) {
  if (schedule.status === "DRAFT") return false;
  if (user.coordinator) return true;
  const own = linkedMinister(user, data);
  return (
    schedule.status === "PUBLISHED" &&
    !!own &&
    schedule.assignments.some((a) => a.ministerId === own.id)
  );
}
export function canVisit(user: Identity, data: Data, eventId: string) {
  if (user.coordinator) return true;
  const own = linkedMinister(user, data);
  return (
    !!own &&
    data.schedules.some(
      (s) =>
        s.status === "PUBLISHED" &&
        !data.schedules.some(
          (other) =>
            other.month === s.month &&
            other.status === "PUBLISHED" &&
            other.revision > s.revision,
        ) &&
        s.events.some((e) => e.id === eventId && e.kind === "VISIT") &&
        s.assignments.some(
          (a) => a.eventId === eventId && a.ministerId === own.id,
        ),
    )
  );
}
