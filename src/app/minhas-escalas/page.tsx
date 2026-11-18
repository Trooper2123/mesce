import { isAltevitaGroupVisit, visitAssistedIds } from "@/lib/visit-group";
import { eventTimeLabel } from "@/lib/domain";
import Link from "next/link";
import { linkedMinister } from "@/lib/access";
import { actor } from "@/lib/auth";
import { readData, transaction, audit } from "@/lib/store";
import { displayDate, displayMonth } from "@/lib/display-date";
export const dynamic = "force-dynamic";
export default async function Mine() {
  const user = await actor();
  const data = await readData();
  const minister = linkedMinister(user, data);
  const schedules = data.schedules
    .filter((s) => s.status === "PUBLISHED")
    .filter(
      (s) =>
        !data.schedules.some(
          (other) =>
            other.month === s.month &&
            ["PUBLISHED", "CANCELLED"].includes(other.status) &&
            other.revision > s.revision,
        ),
    );
  if (minister)
    await transaction(async (client) =>
      audit(client, user.id, "visits:read-assigned"),
    );
  return (
    <>
      <span className="eyebrow">A serviço da comunidade</span>
      <h1>Minhas escalas</h1>
      <p className="subtitle">
        Seus compromissos nas versões publicadas pela coordenação.
      </p>
      <div className="schedule-actions">
        <div className="schedule-primary-actions">
          <Link className="button" href="/impedimentos">
            Informar impedimento
          </Link>
        </div>
        {minister && (
          <div className="schedule-support-actions">
            <span className="schedule-actions-label">Configurações</span>
            <Link
              className="button secondary"
              href="/minhas-escalas/calendario"
            >
              Agenda pessoal
            </Link>
            <Link className="button secondary" href="/minhas-escalas/avisos">
              Lembretes e avisos
            </Link>
          </div>
        )}
      </div>
      {!minister ? (
        <p className="notice">
          Procure a coordenação para vincular seu e-mail verificado ao cadastro
          de ministro.
        </p>
      ) : !schedules.some((s) =>
          s.assignments.some((a) => a.ministerId === minister.id),
        ) ? (
        <p className="empty">
          Seus compromissos aparecerão aqui quando a coordenação publicar sua
          escala. Enquanto isso, você pode informar seus impedimentos.
        </p>
      ) : (
        schedules.map((s) => {
          const own = s.assignments.filter((a) => a.ministerId === minister.id);
          if (!own.length) return null;
          return (
            <section
              id={`escala-${s.id}`}
              className="panel"
              key={s.id}
              style={{ marginTop: 24 }}
            >
              <div className="panel-head">
                <h2>
                  {displayMonth(s.month)} · Revisão {s.revision}
                </h2>
                <Link href={`/api/schedules/${s.id}/pdf`}>PDF da escala</Link>
              </div>
              {s.assistedSnapshot &&
                own.some((a) =>
                  s.events.some(
                    (e) => e.id === a.eventId && e.kind === "VISIT",
                  ),
                ) && (
                  <Link
                    className="button secondary"
                    href={`/api/schedules/${s.id}/visitas`}
                  >
                    Meu guia restrito de visitas
                  </Link>
                )}
              {own.map((a) => {
                const e = s.events.find((e) => e.id === a.eventId)!;
                const assisted =
                  e.kind === "VISIT"
                    ? data.assisted.filter((p) =>
                        visitAssistedIds(e).includes(p.id),
                      )
                    : [];
                const altevitaGroup = isAltevitaGroupVisit(e, data.assisted);
                return (
                  <article className="schedule-event" key={e.id}>
                    <h3>
                      {altevitaGroup
                        ? "Atendimento ao grupo Altevita"
                        : e.title}
                    </h3>
                    <p>
                      {displayDate(e.date, true)} · {eventTimeLabel(e)} ·{" "}
                      {e.location}
                    </p>
                    {!altevitaGroup &&
                      assisted.map((assisted) => (
                        <div key={assisted.id}>
                          <strong>{assisted.name}</strong>
                          <p>
                            {assisted.address}, {assisted.neighborhood} ·{" "}
                            {assisted.city}/{assisted.state}
                          </p>
                          <p>
                            Contato: {assisted.mobile || assisted.landline} ·
                            Familiar: {assisted.familyName}{" "}
                            {assisted.familyPhone}
                          </p>
                        </div>
                      ))}
                    {e.notes && <p>{e.notes}</p>}
                  </article>
                );
              })}
            </section>
          );
        })
      )}
    </>
  );
}
