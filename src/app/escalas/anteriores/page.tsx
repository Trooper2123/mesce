import Link from "next/link";
import { coordinator } from "@/lib/auth";
import { readData } from "@/lib/store";
import { displayMonth } from "@/lib/display-date";

export const dynamic = "force-dynamic";
export default async function PreviousSchedules() {
  await coordinator();
  const schedules = (await readData()).schedules.sort(
    (a, b) => b.month.localeCompare(a.month) || b.revision - a.revision,
  );
  return (
    <>
      <h1>Escalas anteriores</h1>
      <p className="subtitle">Versões preservadas por mês e revisão.</p>
      <section className="panel">
        {schedules.map((schedule) => (
          <div className="row" key={schedule.id}>
            <span>
              <strong>
                {displayMonth(schedule.month)} · revisão {schedule.revision}
              </strong>
              <small>
                {schedule.status}{" "}
                {schedule.approvedBy
                  ? `· responsável ${schedule.approvedBy}`
                  : ""}
              </small>
            </span>
            <Link href={`/api/schedules/${schedule.id}/pdf`}>
              Consultar PDF
            </Link>
          </div>
        ))}
        {!schedules.length && (
          <p className="empty">Nenhuma versão de escala foi criada.</p>
        )}
      </section>
    </>
  );
}
