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
  view = "FULL",
  eventClass = "ALL",
}: {
  month: string;
  events: Event[];
  impediments?: Record<string, string[]>;
  agendaEvents?: Event[];
  view?: "FULL" | "SUMMARY" | "SPLIT" | "MASSES" | "VISITS";
  eventClass?: string;
}) {
  if (view === "SPLIT")
    return (
      <>
        <Calendar
          {...{ month, events, impediments, agendaEvents, eventClass }}
          view="MASSES"
        />
        <Calendar
          {...{ month, events, impediments, agendaEvents, eventClass }}
          view="VISITS"
        />
      </>
    );
  const compact = view === "SUMMARY";
  const visitsOnly = view === "VISITS";
  const ordered = sortCalendarEvents(
    events.filter((e) =>
      view === "MASSES"
        ? e.kind !== "VISIT"
        : visitsOnly
          ? e.kind === "VISIT"
          : true,
    ),
  );
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
  const sundays = Array.from({ length: days }, (_, i) => i + 1).filter(
    (day) => new Date(Date.UTC(year, number - 1, day)).getUTCDay() === 0,
  );
  const weeks = visitsOnly
    ? [sundays]
    : Array.from({ length: cells.length / 7 }, (_, week) =>
        cells.slice(week * 7, week * 7 + 7),
      );
  const heading = visitsOnly
    ? "Visitas aos assistidos · Domingos"
    : view === "MASSES"
      ? "Missas e celebrações"
      : compact
        ? "Calendário resumido"
        : "Calendário";
  const headers = visitsOnly
    ? sundays.map(
        (day) =>
          `Domingo ${String(day).padStart(2, "0")}/${String(number).padStart(2, "0")}`,
      )
    : ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return (
    <section className="panel">
      <h2>
        {heading} · {month}
      </h2>
      <p className="calendar-legend">
        {!visitsOnly && (
          <>
            <span className="event-key-fixed">Fixo recorrente</span>{" "}
            <span className="event-key-extraordinary">Extraordinário</span>{" "}
          </>
        )}
        {view !== "MASSES" && (
          <span className="event-key-visit">Visita extraordinária</span>
        )}
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label={`${heading} · ${month}`}
        tabIndex={0}
      >
        <table
          style={
            visitsOnly ? { minWidth: `${sundays.length * 210}px` } : undefined
          }
          className={`calendar${visitsOnly ? " calendar-sundays" : ""}${compact ? " calendar-compact" : ""}`}
        >
          <thead>
            <tr>
              {headers.map((day) => (
                <th key={day} scope="col">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((day, index) => (
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
                              href={`/celebracoes?edit=${encodeURIComponent(e.id)}&month=${month}&calendarView=${view === "MASSES" || view === "VISITS" ? "SPLIT" : view}&eventClass=${encodeURIComponent(eventClass)}#cadastro`}
                              title={
                                compact
                                  ? [
                                      e.cancelled ? "Cancelado" : "",
                                      warnings.get(e.id),
                                    ]
                                      .filter(Boolean)
                                      .join(" · ") || undefined
                                  : undefined
                              }
                              prefetch={false}
                              aria-label={`Editar ${e.title}, ${e.date.split("-").reverse().join("/")} às ${e.time}, ${e.location}${compact && warnings.get(e.id) ? `. ${warnings.get(e.id)}` : ""}`}
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
                              {!compact && (
                                <>
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
                                </>
                              )}
                              {compact && e.cancelled && (
                                <span
                                  className="calendar-cancelled"
                                  aria-label="Cancelado"
                                >
                                  {" "}
                                  · Cancelado
                                </span>
                              )}
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
