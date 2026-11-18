import Link from "next/link";
import { coordinator } from "@/lib/auth";
import { nextMonth, eventTimeLabel } from "@/lib/domain";
import { displayDate, displayMonth } from "@/lib/display-date";
import { sortEvents } from "@/lib/event-agenda";
import { readData } from "@/lib/store";
import { Field } from "@/components/fields";

export const dynamic = "force-dynamic";
export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await coordinator();
  const query = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : nextMonth();
  const events = sortEvents(
    (await readData()).events.filter((event) => event.date.startsWith(month)),
  );
  const previous = new Date(`${month}-01T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const next = new Date(`${month}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return (
    <>
      <h1>Agenda · {displayMonth(month)}</h1>
      <p className="subtitle">
        Resumo mensal de celebrações e visitas. A edição acontece nas áreas de
        gestão.
      </p>
      <form className="toolbar">
        <Field name="month" label="Mês" type="month" value={month} />
        <button className="secondary">Consultar</button>
      </form>
      <nav className="toolbar" aria-label="Navegação entre meses">
        <Link href={`/agenda?month=${previous.toISOString().slice(0, 7)}`}>
          Mês anterior
        </Link>
        <Link href={`/agenda?month=${next.toISOString().slice(0, 7)}`}>
          Próximo mês
        </Link>
      </nav>
      <div className="cards">
        <article className="card">
          <strong>Celebrações</strong>
          <span className="stat">
            {events.filter((e) => e.kind !== "VISIT").length}
          </span>
        </article>
        <article className="card">
          <strong>Visitas</strong>
          <span className="stat">
            {events.filter((e) => e.kind === "VISIT").length}
          </span>
        </article>
        <article className="card">
          <strong>Cancelamentos</strong>
          <span className="stat">
            {events.filter((e) => e.cancelled).length}
          </span>
        </article>
        <article className="card">
          <strong>Eventos ajustados</strong>
          <span className="stat">
            {events.filter((e) => e.changeNotice).length}
          </span>
        </article>
      </div>
      <section className="panel">
        <h2>Agenda em lista</h2>
        {events.map((event) => (
          <article className="row" key={event.id}>
            <span>
              <strong>
                {displayDate(event.date, true)} · {eventTimeLabel(event)}
              </strong>
              <small>
                {event.title} · {event.location} ·{" "}
                {event.cancelled
                  ? "Cancelado"
                  : event.changeNotice
                    ? "Ajustado"
                    : "Confirmado"}
              </small>
            </span>
            <Link
              href={
                event.kind === "VISIT"
                  ? `/visitas/agendar?edit=${event.id}&month=${month}`
                  : `/agenda/celebracoes?edit=${event.id}&month=${month}`
              }
            >
              Gerenciar
            </Link>
          </article>
        ))}
        {!events.length && (
          <p className="empty">
            Nenhum evento neste mês. Cadastre uma celebração ou agende uma
            visita.
          </p>
        )}
      </section>
    </>
  );
}
