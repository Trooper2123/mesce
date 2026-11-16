import { isAltevitaGroupVisit, visitAssistedIds } from "@/lib/visit-group";
import Link from "next/link";
import { sortEvents } from "@/lib/event-agenda";
import { coordinator } from "@/lib/auth";
import { readData } from "@/lib/store";
import { Field } from "@/components/fields";
import { eventTimeLabel, nextMonth } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Visits({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await coordinator();
  const query = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : nextMonth();
  const data = await readData();
  const visits = sortEvents(
    data.events.filter(
      (event) =>
        event.kind === "VISIT" &&
        !event.cancelled &&
        event.date.startsWith(month),
    ),
  );
  const byDate = new Map<string, typeof visits>();
  for (const event of visits) {
    const day = byDate.get(event.date) ?? [];
    day.push(event);
    byDate.set(event.date, day);
  }
  return (
    <>
      <h1>Visitas aos assistidos</h1>
      <p className="subtitle">
        As visitas podem ser agendadas em qualquer dia. O horário é combinado
        conforme a disponibilidade do assistido; consulte as observações.
      </p>
      <form className="toolbar">
        <Field name="month" label="Mês" type="month" value={month} />
        <button className="secondary">Consultar</button>
        <Link className="button" href="/celebracoes?new=1&type=VISIT">
          Agendar visita
        </Link>
      </form>
      {[...byDate.entries()].map(([date, events]) => (
        <section className="panel" key={date}>
          <h2>Data · {date}</h2>
          {events.map((event) => {
            const altevita = isAltevitaGroupVisit(event, data.assisted);
            const people = data.assisted.filter((person) =>
              visitAssistedIds(event).includes(person.id),
            );
            return (
              <div className="row" key={event.id}>
                <span>
                  {eventTimeLabel(event)} ·{" "}
                  {altevita
                    ? "Atendimento ao grupo Altevita"
                    : people.map((person) => person.name).join(", ") ||
                      "Assistido"}
                  · {event.required} ministros
                  {event.notes && <small>{event.notes}</small>}
                </span>
                <Link href={`/celebracoes?edit=${event.id}`}>Editar</Link>
              </div>
            );
          })}
        </section>
      ))}
      {!visits.length && (
        <p className="empty">Nenhuma visita agendada neste mês.</p>
      )}
    </>
  );
}
