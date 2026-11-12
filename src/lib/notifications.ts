import { eventInstant, latestPublished, type Data } from "./domain";
import type { Identity } from "./access";
export type Notification = {
  id: string;
  type:
    "PUBLICATION" | "REVISION" | "REMINDER" | "CANCELLATION" | "EVENT_CHANGE";
  title: string;
  description: string;
  href: string;
  month: string;
  revision: number;
  scheduleId: string;
};
// A projection of persisted schedule versions: stable keys make refresh/retries
// idempotent without inventing delivery events or keeping process-local state.
export function notificationsFor(
  data: Data,
  user: Identity,
  now = Date.now(),
): Notification[] {
  if (!user.verified) return [];
  const member = data.ministers.find(
    (m) => m.id === user.ministerId && m.active && !m.former,
  );
  if (!user.coordinator && !member) return [];
  const notices = new Map<string, Notification>();
  const add = (notice: Notification) => notices.set(notice.id, notice);
  for (const event of data.events) {
    const change = event.changeNotice;
    if (
      !change ||
      (!user.coordinator && !change.ministerIds.includes(member!.id))
    )
      continue;
    add({
      id: `event-change:${change.id}`,
      type: "EVENT_CHANGE",
      title:
        change.kind === "CANCEL"
          ? "Compromisso cancelado"
          : "Compromisso remarcado",
      description:
        change.kind === "CANCEL"
          ? `O compromisso de ${change.previousDate}, às ${change.previousTime}, foi cancelado. Consulte a coordenação.`
          : `O compromisso de ${change.previousDate}, às ${change.previousTime}, foi remarcado para ${event.date}, às ${event.time}. Aguarde a escala revisada pela coordenação.`,
      href: user.coordinator
        ? `/celebracoes?edit=${event.id}`
        : "/minhas-escalas",
      month: event.date.slice(0, 7),
      revision: 0,
      scheduleId: "",
    });
  }
  for (const schedule of latestPublished(data)) {
    const own = schedule.assignments.filter(
      (a) => user.coordinator || a.ministerId === member?.id,
    );
    if (!user.coordinator && !own.length) continue;
    const base = {
      month: schedule.month,
      revision: schedule.revision,
      scheduleId: schedule.id,
      href: user.coordinator
        ? `/escalas?month=${schedule.month}`
        : `/minhas-escalas#escala-${schedule.id}`,
    };
    add({
      ...base,
      id: `publication:${schedule.id}`,
      type: "PUBLICATION",
      title: "Escala publicada",
      description: `Escala de ${schedule.month}, revisão ${schedule.revision}, disponível para consulta.`,
    });
    if (schedule.revision > 1)
      add({
        ...base,
        id: `revision:${schedule.id}`,
        type: "REVISION",
        title: "Escala atualizada",
        description: `A revisão ${schedule.revision} de ${schedule.month} substitui a publicação anterior. Consulte a versão vigente.`,
      });
    for (const event of schedule.events) {
      const current = data.events.find((e) => e.id === event.id);
      if (
        event.cancelled ||
        current?.cancelled ||
        (current?.changeNotice &&
          (current.date !== event.date || current.time !== event.time)) ||
        !own.some((a) => a.eventId === event.id)
      )
        continue;
      const until = eventInstant(event) - now;
      if (until < 0 || until > 7 * 86400000) continue;
      add({
        ...base,
        id: `reminder:${schedule.id}:${event.id}`,
        type: "REMINDER",
        title: "Lembrete de compromisso",
        description: `Você tem um compromisso em ${event.date}, às ${event.time}. Consulte a escala autenticada.`,
      });
    }
  }
  if (user.coordinator) {
    const latest = new Map<string, Data["schedules"][number]>();
    for (const s of data.schedules)
      if (!latest.has(s.month) || latest.get(s.month)!.revision < s.revision)
        latest.set(s.month, s);
    for (const s of latest.values())
      if (
        s.revision > 1 &&
        ["DRAFT", "IN_REVIEW", "APPROVED"].includes(s.status)
      ) {
        add({
          id: `review:${s.id}`,
          type: "REVISION",
          title: "Revisão em preparação",
          description: `A revisão ${s.revision} de ${s.month} aguarda conclusão e publicação. A versão anterior permanece no histórico.`,
          month: s.month,
          revision: s.revision,
          scheduleId: s.id,
          href: `/escalas?month=${s.month}`,
        });
      }
  }
  for (const s of data.schedules.filter((s) => s.status === "CANCELLED")) {
    if (
      data.schedules.some(
        (other) => other.month === s.month && other.revision > s.revision,
      )
    )
      continue;
    const related = data.schedules.filter(
      (other) => other.month === s.month && other.revision <= s.revision,
    );
    if (
      !user.coordinator &&
      !related.some((other) =>
        other.assignments.some((a) => a.ministerId === member?.id),
      )
    )
      continue;
    add({
      id: `cancel:${s.id}`,
      type: "CANCELLATION",
      title: "Escala cancelada",
      description: `A escala de ${s.month}, revisão ${s.revision}, foi cancelada. Procure a coordenação.`,
      month: s.month,
      revision: s.revision,
      scheduleId: s.id,
      href: user.coordinator ? `/escalas?month=${s.month}` : "/minhas-escalas",
    });
  }
  return [...notices.values()].sort(
    (a, b) =>
      b.month.localeCompare(a.month) ||
      b.revision - a.revision ||
      a.id.localeCompare(b.id),
  );
}
