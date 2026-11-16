import Link from "next/link";
import {
  eventClassOf,
  sortCalendarEvents,
  eventOverlapNotice,
} from "@/lib/event-agenda";
import { eventTimeLabel, type Assisted, type Event } from "@/lib/domain";
import { isAltevitaGroupVisit } from "@/lib/visit-group";
export function Calendar({
  month,
  events,
  assisteds = [],
  impediments = {},
  agendaEvents = events,
  view = "FULL",
  eventClass = "ALL",
  eventName = "",
}: {
  month: string;
  events: Event[];
  assisteds?: Assisted[];
  impediments?: Record<string, string[]>;
  agendaEvents?: Event[];
  view?: "FULL" | "SUMMARY" | "SPLIT" | "MASSES" | "VISITS";
  eventClass?: string;
  eventName?: string;
}) {
  if (view === "SPLIT")
    return (
      <>
        <Calendar
          {...{
            month,
            events,
            assisteds,
            impediments,
            agendaEvents,
            eventClass,
            eventName,
          }}
          view="MASSES"
        />
        <Calendar
          {...{
            month,
            events,
            assisteds,
            impediments,
            agendaEvents,
            eventClass,
            eventName,
          }}
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
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );
  const heading = visitsOnly
    ? "Visitas aos assistidos"
    : view === "MASSES"
      ? "Missas e celebrações"
      : compact
        ? "Calendário resumido"
        : "Calendário";
  const headers = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  return (
    <section className="panel">
      <h2>
        {heading} · {month}
      </h2>
      <p className="calendar-legend">
        {!visitsOnly && (
          <>
            <span className="event-key-fixed">Missa fixa</span>{" "}
            <span className="event-key-extraordinary">
              Celebração extraordinária
            </span>{" "}
            <span className="event-key-wedding">Casamento</span>{" "}
            <span className="event-key-adoration">Adoração</span>{" "}
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
          style={visitsOnly ? { minWidth: "850px" } : undefined}
          className={`calendar${compact ? " calendar-compact" : ""}`}
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
                              href={`/celebracoes?edit=${encodeURIComponent(e.id)}&month=${month}&calendarView=${view === "MASSES" || view === "VISITS" ? "SPLIT" : view}&eventClass=${encodeURIComponent(eventClass)}${eventName ? `&eventName=${encodeURIComponent(eventName)}` : ""}#cadastro`}
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
                              aria-label={`Editar ${isAltevitaGroupVisit(e, assisteds) ? "Atendimento ao grupo Altevita" : e.title}, ${e.date.split("-").reverse().join("/")}, ${eventTimeLabel(e)}, ${e.location}${compact && warnings.get(e.id) ? `. ${warnings.get(e.id)}` : ""}`}
                              key={e.id}
                              className={
                                "calendar-event " +
                                (e.kind === "VISIT"
                                  ? "calendar-event-visit"
                                  : e.kind === "WEDDING"
                                    ? "calendar-event-wedding"
                                    : e.kind === "ADORATION"
                                      ? "calendar-event-adoration"
                                      : eventClassOf(e) === "FIXED"
                                        ? "calendar-event-fixed"
                                        : "calendar-event-extraordinary")
                              }
                            >
                              <time>{eventTimeLabel(e)}</time>{" "}
                              {isAltevitaGroupVisit(e, assisteds)
                                ? "Atendimento ao grupo Altevita"
                                : e.title}
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
