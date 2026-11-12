import Link from "next/link";
import {
  eventClassOf,
  sortCalendarEvents,
  eventOverlapNotice,
} from "@/lib/event-agenda";
import type { Event } from "@/lib/domain";
export function Calendar({
  month,
  events,
  impediments = {},
  agendaEvents = events,
}: {
  month: string;
  events: Event[];
  impediments?: Record<string, string[]>;
  agendaEvents?: Event[];
}) {
  const ordered = sortCalendarEvents(events);
  const warnings = new Map(
    ordered.map((event) => [event.id, eventOverlapNotice(event, agendaEvents)]),
  );
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((days + first) / 7) * 7 },
    (_, i) => i - first + 1,
  );
  return (
    <section className="panel">
      <h2>Calendário · {month}</h2>
      <p className="calendar-legend">
        <span className="event-key-fixed">Fixo recorrente</span>{" "}
        <span className="event-key-extraordinary">Extraordinário</span>{" "}
        <span className="event-key-visit">Visita extraordinária</span>
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Calendário mensal"
        tabIndex={0}
      >
        <table className="calendar">
          <thead>
            <tr>
              {[
                "Domingo",
                "Segunda",
                "Terça",
                "Quarta",
                "Quinta",
                "Sexta",
                "Sábado",
              ].map((day) => (
                <th key={day} scope="col">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, week) => (
              <tr key={week}>
                {cells.slice(week * 7, week * 7 + 7).map((day, index) => (
                  <td key={index}>
                    {day > 0 && day <= days && (
                      <>
                        <strong>{day}</strong>
                        {ordered
                          .filter(
                            (e) =>
                              e.date ===
                              `${month}-${String(day).padStart(2, "0")}`,
                          )
                          .map((e) => (
                            <Link
                              href={`/celebracoes?edit=${encodeURIComponent(e.id)}&month=${month}#cadastro`}
                              prefetch={false}
                              aria-label={`Editar ${e.title}, ${e.date.split("-").reverse().join("/")} às ${e.time}, ${e.location}`}
                              key={e.id}
                              className={
                                "calendar-event " +
                                (e.kind === "VISIT"
                                  ? "calendar-event-visit"
                                  : eventClassOf(e) === "FIXED"
                                    ? "calendar-event-fixed"
                                    : "calendar-event-extraordinary")
                              }
                            >
                              <time>{e.time}</time> {e.title}
                              <small>
                                {eventClassOf(e) === "FIXED"
                                  ? "Fixo recorrente"
                                  : "Extraordinário"}
                                {e.cancelled ? " · Cancelado" : ""}
                              </small>
                              <small>
                                {e.kind === "VISIT"
                                  ? "Visita dominical"
                                  : e.location}{" "}
                                · {e.required} vagas
                              </small>
                              {warnings.get(e.id) && (
                                <small className="event-overlap">
                                  {warnings.get(e.id)}
                                </small>
                              )}
                              {(impediments[e.id] ?? []).map((name) => (
                                <small key={name}>Impedido: {name}</small>
                              ))}
                            </Link>
                          ))}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
