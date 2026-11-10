import type { Event } from "@/lib/domain";
export function Calendar({
  month,
  events,
}: {
  month: string;
  events: Event[];
}) {
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
                        {events
                          .filter((e) => Number(e.date.slice(8)) === day)
                          .map((e) => (
                            <p key={e.id}>
                              <time>{e.time}</time> {e.title}
                              <small>
                                {e.kind === "VISIT"
                                  ? "Visita dominical"
                                  : e.location}{" "}
                                · {e.required} vagas
                              </small>
                            </p>
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
