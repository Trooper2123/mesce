import { z } from "zod";
import {
  eventSchema,
  eventInstant,
  requireFuture,
  latestPublished,
  type Data,
  type Event,
} from "./domain";
import { validateAbsenceSubmission } from "./absence-input";
import type { Identity } from "./access";
export function planAbsenceWithdrawal(
  id: string,
  reason: string,
  user: Identity,
  data: Data,
  now = new Date(),
) {
  const absence = data.absences.find((a) => a.id === id);
  if (!absence) throw new Error("Impedimento inexistente.");
  validateAbsenceSubmission(absence, user, data, now);
  if (absence.revokedAt) throw new Error("Impedimento já retirado.");
  z.string()
    .trim()
    .min(3, "Informe a justificativa da retirada.")
    .max(2000)
    .parse(reason);
  return {
    ...absence,
    revokedAt: now.toISOString(),
    revokedBy: user.id,
    withdrawalReason: reason.trim(),
  };
}
export function eventChangeNotice(
  before: Event,
  after: Event,
  data: Data,
  now = Date.now(),
): Event {
  const schedules = latestPublished(data).filter((s) =>
    s.assignments.some((a) => a.eventId === before.id),
  );
  const recipients = [
    ...new Set(
      schedules.flatMap((s) =>
        s.assignments
          .filter((a) => a.eventId === before.id)
          .map((a) => a.ministerId),
      ),
    ),
  ];
  return {
    ...after,
    changeNotice: {
      id: crypto.randomUUID(),
      at: new Date(now).toISOString(),
      kind: after.cancelled ? "CANCEL" : "RESCHEDULE",
      previousDate: before.date,
      previousTime: before.time,
      ministerIds: recipients,
    },
  };
}
export function planEventChange(form: FormData, data: Data, now = Date.now()) {
  const id = z.string().uuid().parse(form.get("id"));
  const anchor = data.events.find((e) => e.id === id);
  if (!anchor || anchor.cancelled)
    throw new Error("Selecione um evento ativo.");
  requireFuture(anchor, now);
  if (
    form.get("expectedDate") !== anchor.date ||
    form.get("expectedTime") !== anchor.time
  )
    throw new Error(
      "O evento mudou desde a abertura. Reabra o cadastro antes de confirmar.",
    );
  const operation = z
    .enum(["CANCEL", "RESCHEDULE"])
    .parse(form.get("operation"));
  const scope = z.enum(["ONE", "FOLLOWING"]).parse(form.get("scope") ?? "ONE");
  const reason = z.string().trim().min(3).max(2000).parse(form.get("reason"));
  if (scope === "FOLLOWING" && !anchor.seriesId)
    throw new Error("Evento sem série.");
  const excluded = new Set(form.getAll("exclude").map(String));
  const candidates =
    scope === "ONE"
      ? [anchor]
      : data.events.filter(
          (e) =>
            e.seriesId === anchor.seriesId &&
            !e.cancelled &&
            eventInstant(e) >= eventInstant(anchor) &&
            eventInstant(e) > now &&
            (e.id === anchor.id || !e.seriesException),
        );
  if ([...excluded].some((id) => !candidates.some((e) => e.id === id)))
    throw new Error("Exceção inválida para esta série.");
  if (excluded.has(anchor.id))
    throw new Error("A ocorrência selecionada não pode ser excluída.");
  const targets = candidates.filter((e) => !excluded.has(e.id));
  const replacement =
    operation === "RESCHEDULE"
      ? eventSchema.parse({
          ...anchor,
          date: String(form.get("date") ?? ""),
          time: String(form.get("time") ?? ""),
        })
      : anchor;
  if (
    operation === "RESCHEDULE" &&
    replacement.date === anchor.date &&
    replacement.time === anchor.time
  )
    throw new Error("Informe uma nova data ou horário para remarcar.");
  const days =
    (Date.parse(replacement.date + "T12:00:00Z") -
      Date.parse(anchor.date + "T12:00:00Z")) /
    86400000;
  const events = targets.map((before) => {
    const after = eventSchema.parse({
      ...before,
      ...(operation === "CANCEL"
        ? { cancelled: true }
        : {
            date: new Date(
              Date.parse(before.date + "T12:00:00Z") + days * 86400000,
            )
              .toISOString()
              .slice(0, 10),
            time: replacement.time,
          }),
      seriesException:
        scope === "ONE" && !!before.seriesId ? true : before.seriesException,
    });
    requireFuture(after, now);
    return eventChangeNotice(before, after, data, now);
  });
  return { events, reason, scope, operation, excluded: [...excluded] };
}
