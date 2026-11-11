import { latestPublished, type Data } from "./domain";

export function reportPeriod(month: string, months: number) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) || ![1, 12].includes(months))
    throw new Error("Informe um mês válido e período de 1 ou 12 meses.");
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - months, 1))
    .toISOString()
    .slice(0, 7);
  return { start, end: month, months };
}

export function operationalReport(data: Data, month: string, months: number) {
  const period = reportPeriod(month, months);
  const schedules = latestPublished(data)
    .filter((s) => s.month >= period.start && s.month <= period.end)
    .sort((a, b) => a.month.localeCompare(b.month));
  const roster = new Map(
    data.ministers.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name,
        current: true,
        celebrations: 0,
        visits: 0,
        status: m.former
          ? "Ex-ministro"
          : !m.active
            ? "Inativo"
            : m.away
              ? "Afastado"
              : m.registrationStatus === "DRAFT"
                ? "Cadastro pendente"
                : "Ativo",
      },
    ]),
  );
  const entries: {
    scheduleId: string;
    revision: number;
    month: string;
    eventId: string;
    date: string;
    time: string;
    kind: string;
    ministerId: string;
    minister: string;
  }[] = [];
  const events = schedules
    .flatMap((s) =>
      s.events
        .filter((e) => !e.cancelled)
        .map((e) => {
          const assignments = [
            ...new Set(
              s.assignments
                .filter((a) => a.eventId === e.id)
                .map((a) => a.ministerId),
            ),
          ];
          const names = assignments.map((id) => {
            const historicalName = s.ministers.find((m) => m.id === id)?.name;
            if (!roster.has(id))
              roster.set(id, {
                id,
                name: historicalName ?? "Cadastro histórico indisponível",
                current: false,
                celebrations: 0,
                visits: 0,
                status: "Somente no histórico",
              });
            const row = roster.get(id)!;
            if (e.kind === "VISIT") row.visits++;
            else row.celebrations++;
            entries.push({
              scheduleId: s.id,
              revision: s.revision,
              month: s.month,
              eventId: e.id,
              date: e.date,
              time: e.time,
              kind: e.kind,
              ministerId: id,
              minister: historicalName ?? row.name,
            });
            return historicalName ?? row.name;
          });
          const assisted =
            e.kind === "VISIT"
              ? s.assistedSnapshot?.find((a) => a.id === e.assistedId)
              : undefined;
          return {
            scheduleId: s.id,
            revision: s.revision,
            event: e,
            ministers: names,
            filled: assignments.length,
            vacancies: Math.max(0, e.required - assignments.length),
            assisted,
          };
        }),
    )
    .sort((a, b) =>
      (a.event.date + a.event.time + a.event.id).localeCompare(
        b.event.date + b.event.time + b.event.id,
      ),
    );
  const participation = [...roster.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const statistics = (mode: "celebrations" | "visits") => {
    const counts = participation.map((m) => m[mode]);
    const total = counts.reduce((a, b) => a + b, 0);
    const min = counts.length ? Math.min(...counts) : 0;
    const max = counts.length ? Math.max(...counts) : 0;
    return {
      total,
      min,
      max,
      average: counts.length ? total / counts.length : 0,
      difference: max - min,
    };
  };
  return {
    period,
    schedules,
    participation,
    entries,
    events,
    celebrations: statistics("celebrations"),
    visits: statistics("visits"),
  };
}
