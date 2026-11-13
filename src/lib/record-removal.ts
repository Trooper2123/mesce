import { encrypt } from "./crypto";
import { audit } from "./store";
import { defaultSettings } from "./domain";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Data, Event } from "./domain";
import { locationCatalog } from "./locations";
import { locationKey } from "./location-rules";
import { RemediationError, type RemediationLink } from "./remediation";
export const removalKinds = [
  "minister",
  "assisted",
  "event",
  "absence",
  "schedule",
  "location",
] as const;
export type RemovalKind = (typeof removalKinds)[number];
export const removalPages: Record<RemovalKind, string> = {
  minister: "ministros",
  assisted: "assistidos",
  event: "celebracoes",
  absence: "impedimentos",
  schedule: "escalas",
  location: "locais",
};
export function recordVersion(record: unknown) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
const visitHas = (e: Event, id: string) =>
  e.assistedId === id ||
  (e as Event & { assistedIds?: string[] }).assistedIds?.includes(id);
const eventEditLink = (event: Event, label: string): RemediationLink => ({
  href: `/celebracoes?${new URLSearchParams({
    edit: event.id,
    month: event.date.slice(0, 7),
  })}#cadastro`,
  label,
});
const scheduleLink = (month: string): RemediationLink => ({
  href: `/escalas?${new URLSearchParams({ month })}`,
  label: `Revisar escala de ${month}`,
});
const ministerEditLink = (id: string): RemediationLink => ({
  href: `/ministros?${new URLSearchParams({ edit: id })}#cadastro`,
  label: "Ajustar preferência do ministro",
});
const absenceEditLink = (id: string): RemediationLink => ({
  href: `/impedimentos?${new URLSearchParams({ edit: id })}#cadastro`,
  label: "Revisar impedimento",
});
const uniqueLinks = (links: RemediationLink[]) => [
  ...new Map(
    links.map((link) => [`${link.href}:${link.label}`, link]),
  ).values(),
];
const scheduleEvents = (schedule: Data["schedules"][number]) => [
  ...schedule.events,
  ...(schedule.agendaEvents ?? []),
];
export function planRecordRemoval(form: FormData, data: Data) {
  const kind = z.enum(removalKinds).parse(form.get("kind"));
  const id = z.string().uuid().parse(form.get("id"));
  if (form.get("confirm") !== "yes")
    throw new Error("Confirme a exclusão do cadastro incorreto.");
  const reason = z
    .string()
    .trim()
    .min(3, "Informe o motivo da exclusão.")
    .max(2000)
    .parse(form.get("reason"));
  const collections = {
    minister: data.ministers,
    assisted: data.assisted,
    event: data.events,
    absence: data.absences,
    schedule: data.schedules,
    location: locationCatalog(data),
  };
  const before = collections[kind].find((r) => r.id === id);
  if (!before)
    throw new RemediationError(
      "Este cadastro não está mais disponível. Volte à lista, atualize a página e abra novamente o registro.",
      [
        {
          href: `/${removalPages[kind]}`,
          label: "Voltar à lista de cadastros",
        },
      ],
    );
  if (form.get("expectedVersion") !== recordVersion(before))
    throw new RemediationError(
      "Este cadastro mudou desde que a página foi aberta. Reabra o registro para conferir os dados antes de tentar excluir novamente.",
      [
        {
          href: `/${removalPages[kind]}?${new URLSearchParams({ edit: id })}`,
          label: "Reabrir cadastro",
        },
      ],
    );
  const schedulesForEvent = data.schedules.filter((s) =>
    scheduleEvents(s).some((e) => e.id === id),
  );
  if (kind === "event") {
    const absences = data.absences.filter((a) => a.eventId === id);
    if (schedulesForEvent.length || absences.length) {
      const event = before as Event;
      const remediation = uniqueLinks([
        ...schedulesForEvent.map((s) => scheduleLink(s.month)),
        ...absences.map((a) => absenceEditLink(a.id)),
        ...(schedulesForEvent.some(
          (s) => !["DRAFT", "IN_REVIEW"].includes(s.status),
        )
          ? [eventEditLink(event, "Abrir evento para cancelar")]
          : []),
      ]);
      const reasons = [
        schedulesForEvent.length &&
          `${schedulesForEvent.length} escala(s) ou histórico(s)`,
        absences.length && `${absences.length} impedimento(s) vinculado(s)`,
      ].filter(Boolean);
      throw new RemediationError(
        `Não é possível excluir este evento: ele está vinculado a ${reasons.join(" e ")}. Revise a escala em preparação ou cancele o evento se ele não for acontecer.`,
        remediation,
      );
    }
  }
  if (kind === "assisted") {
    const currentVisits = data.events.filter((e) => visitHas(e, id));
    const historicalVisits = data.schedules.filter((s) =>
      scheduleEvents(s).some((e) => visitHas(e, id)),
    );
    const snapshots = data.schedules.filter((s) =>
      s.assistedSnapshot?.some((a) => a.id === id),
    );
    if (currentVisits.length || historicalVisits.length || snapshots.length) {
      throw new RemediationError(
        `Não é possível excluir este assistido: há ${currentVisits.length} visita(s) cadastrada(s) e ${uniqueLinks([...historicalVisits, ...snapshots].map((s) => scheduleLink(s.month))).length} escala(s) com histórico relacionado. Corrija ou cancele as visitas futuras; mantenha o cadastro para preservar as escalas anteriores.`,
        uniqueLinks([
          ...currentVisits.map((e) =>
            eventEditLink(e, `Revisar visita: ${e.title} (${e.date})`),
          ),
          ...historicalVisits.map((s) => scheduleLink(s.month)),
          ...snapshots.map((s) => scheduleLink(s.month)),
        ]),
      );
    }
  }
  if (kind === "minister") {
    const absences = data.absences.filter((a) => a.ministerId === id);
    const responses = data.responses?.filter((r) => r.ministerId === id) ?? [];
    const spouseLinks = data.ministers.filter((m) => m.spouseId === id);
    const schedules = data.schedules.filter(
      (s) =>
        s.ministers.some((m) => m.id === id) ||
        s.assignments.some((a) => a.ministerId === id),
    );
    if (
      absences.length ||
      responses.length ||
      spouseLinks.length ||
      schedules.length
    ) {
      const remediation = uniqueLinks([
        ...absences.map((a) => absenceEditLink(a.id)),
        ...spouseLinks.map((m) => ministerEditLink(m.id)),
        ...schedules.map((s) => scheduleLink(s.month)),
        {
          href: `/ministros?${new URLSearchParams({ edit: id })}#cadastro`,
          label: "Abrir cadastro para inativar o ministro",
        },
      ]);
      const reasons = [
        absences.length && `${absences.length} impedimento(s)`,
        responses.length && `${responses.length} resposta(s) mensal(is)`,
        spouseLinks.length && "vínculo conjugal",
        schedules.length && `${schedules.length} escala(s) ou histórico(s)`,
      ].filter(Boolean);
      throw new RemediationError(
        `Não é possível excluir este ministro: o cadastro possui ${reasons.join(", ")}. Corrija os vínculos quando forem dados incorretos ou inative o ministro para preservar o histórico.`,
        remediation,
      );
    }
  }
  if (kind === "absence") {
    const a = data.absences.find((a) => a.id === id)!;
    const schedules = data.schedules.filter(
      (s) =>
        s.assignments.some((m) => m.ministerId === a.ministerId) &&
        scheduleEvents(s).some((e) =>
          a.scope === "CELEBRATION"
            ? e.id === a.eventId
            : e.date >= a.start && e.date <= a.end,
        ),
    );
    if (schedules.length)
      throw new RemediationError(
        `Este impedimento já está refletido em ${schedules.length} escala(s). Retire-o ou ajuste-o pelo cadastro de impedimentos e revise as escalas relacionadas.`,
        uniqueLinks([
          absenceEditLink(id),
          ...schedules.map((s) => scheduleLink(s.month)),
        ]),
      );
  }
  if (kind === "schedule") {
    const schedule = data.schedules.find((s) => s.id === id)!;
    if (!["DRAFT", "IN_REVIEW"].includes(schedule.status))
      throw new RemediationError(
        "Esta escala já foi aprovada ou publicada e precisa ter seu cancelamento registrado. Abra a escala do mês para cancelar; ela não pode ser removida como rascunho.",
        [scheduleLink(schedule.month)],
      );
  }
  if (kind === "location") {
    const l = locationCatalog(data).find((l) => l.id === id)!;
    const usesLocation = (e: Event) =>
      e.kind !== "VISIT" &&
      (e.locationId === id || locationKey(e.location) === locationKey(l.name));
    const registryEvents = data.events.filter(usesLocation);
    const historicalUses = data.schedules.flatMap((s) =>
      scheduleEvents(s)
        .filter(usesLocation)
        .map((event) => ({ schedule: s, event })),
    );
    const ministers = data.ministers.filter(
      (m) =>
        m.locationIds?.includes(id) ||
        (!m.locationIds?.length &&
          locationKey(m.location) === locationKey(l.name)),
    );
    if (registryEvents.length || historicalUses.length || ministers.length) {
      const reasons = [
        (registryEvents.length || historicalUses.length) &&
          `${registryEvents.length + historicalUses.length} referência(s) em celebrações/escala(s)`,
        ministers.length && `${ministers.length} preferência(s) de ministro`,
      ].filter(Boolean);
      const remediation = uniqueLinks([
        ...registryEvents.map((e) =>
          eventEditLink(e, `Ajustar local: ${e.title} (${e.date})`),
        ),
        ...historicalUses.map(({ schedule }) => scheduleLink(schedule.month)),
        ...ministers.map((m) => ministerEditLink(m.id)),
        {
          href: `/locais#local-${id}`,
          label: "Inativar o local e preservar o histórico",
        },
      ]);
      throw new RemediationError(
        `Não é possível excluir “${l.name}”: o local ainda possui ${reasons.join(" e ")}. Abra os registros listados e troque o local ou remova a preferência; depois tente novamente. Se o local não deve ser usado em novos cadastros, inative-o para preservar o histórico.`,
        remediation,
      );
    }
  }
  return { kind, id, reason, before };
}

export function removalSeries(anchor: Event, events: Event[]) {
  return anchor.seriesId
    ? events
        .filter(
          (e) =>
            e.seriesId === anchor.seriesId &&
            e.date + e.time >= anchor.date + anchor.time,
        )
        .sort((a, b) => a.id.localeCompare(b.id))
    : [anchor];
}
export async function executeRecordRemoval(
  client: import("pg").PoolClient,
  data: Data,
  user: import("./access").Identity,
  form: FormData,
) {
  if (!user.coordinator) throw new Error("Acesso exclusivo da coordenação.");
  const plan = planRecordRemoval(form, data);
  if (plan.kind === "event" && form.get("removalScope") === "FOLLOWING") {
    const targets = removalSeries(
      data.events.find((e) => e.id === plan.id)!,
      data.events,
    );
    if (form.get("expectedSeries") !== recordVersion(targets))
      throw new RemediationError(
        "A série foi alterada desde que a página foi aberta. Reabra o evento, confira as ocorrências e tente novamente.",
        [
          eventEditLink(
            data.events.find((e) => e.id === plan.id)!,
            "Reabrir série",
          ),
        ],
      );
    const forms = targets.map((event) => {
      const f = new FormData();
      for (const [key, value] of form.entries()) f.append(key, value);
      f.set("id", event.id);
      f.set("expectedVersion", recordVersion(event));
      f.set("removalScope", "ONE");
      return f;
    });
    // Validate the whole batch before deleting the first record.
    for (const f of forms) planRecordRemoval(f, data);
    for (const f of forms) await executeRecordRemoval(client, data, user, f);
    return plan;
  }

  if (plan.kind === "minister") {
    const access = await client.query(
      "SELECT id FROM mesce_access WHERE minister_id=$1",
      [plan.id],
    );
    if (access.rows.length)
      throw new RemediationError(
        "Este ministro possui um pré-cadastro ou acesso ativo. Revogue o acesso e inative o cadastro para preservar as escalas e o histórico.",
        [
          {
            href: "/pre-cadastros",
            label: "Abrir pré-cadastros e revisar o acesso",
          },
          {
            href: `/ministros?${new URLSearchParams({ edit: plan.id })}#cadastro`,
            label: "Abrir cadastro para inativar o ministro",
          },
        ],
      );
  }
  if (plan.kind === "location") {
    await client.query(
      "INSERT INTO mesce_settings(id,payload) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
      [
        encrypt({
          ...defaultSettings,
          ...data.settings,
          locations: locationCatalog(data).filter((l) => l.id !== plan.id),
        }),
      ],
    );
  } else {
    await client.query("DELETE FROM mesce_records WHERE id=$1 AND kind=$2", [
      plan.id,
      plan.kind,
    ]);
  }
  await audit(client, user.id, `${plan.kind}:delete`, plan.id, {
    before: plan.before,
    reason: plan.reason,
  });

  return plan;
}
