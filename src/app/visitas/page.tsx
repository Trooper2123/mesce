import { visitAssistedIds } from "@/lib/visit-group";
import Link from "next/link";
import { sortEvents } from "@/lib/event-agenda";
import { coordinator } from "@/lib/auth";
import { readData } from "@/lib/store";
import { Field } from "@/components/fields";
import { nextMonth } from "@/lib/domain";
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
  const [year, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const sundays = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  ).filter((date) => new Date(date + "T12:00:00Z").getUTCDay() === 0);
  return (
    <>
      <h1>Visitas dominicais</h1>
      <p className="subtitle">Assistidos previstos nos domingos do mês.</p>
      <form className="toolbar">
        <Field name="month" label="Mês" type="month" value={month} />
        <button className="secondary">Consultar</button>
        <Link className="button" href="/celebracoes?new=1&type=VISIT">
          Agendar visita
        </Link>
      </form>
      {sundays.map((date) => (
        <section className="panel" key={date}>
          <h2>Domingo · {date}</h2>
          {sortEvents(data.events)
            .filter(
              (e) => e.kind === "VISIT" && !e.cancelled && e.date === date,
            )
            .map((e) => (
              <div className="row" key={e.id}>
                <span>
                  {e.time} ·{" "}
                  {data.assisted
                    .filter((a) => visitAssistedIds(e).includes(a.id))
                    .map((a) => a.name)
                    .join(", ") ?? "Assistido"}{" "}
                  · {e.required} ministros
                </span>
                <Link href={`/celebracoes?edit=${e.id}`}>Editar</Link>
              </div>
            ))}
          {!data.events.some(
            (e) => e.kind === "VISIT" && !e.cancelled && e.date === date,
          ) && <p className="muted">Nenhuma visita agendada.</p>}
        </section>
      ))}
    </>
  );
}
