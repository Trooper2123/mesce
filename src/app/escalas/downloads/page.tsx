import Link from "next/link";
import { coordinator } from "@/lib/auth";
import { readData } from "@/lib/store";
import { displayMonth } from "@/lib/display-date";

export const dynamic = "force-dynamic";
export default async function ScheduleDownloads() {
  await coordinator();
  const schedules = (await readData()).schedules
    .filter((s) => ["APPROVED", "PUBLISHED"].includes(s.status))
    .sort((a, b) => b.month.localeCompare(a.month) || b.revision - a.revision);
  return (
    <>
      <h1>Baixar escalas</h1>
      <p className="subtitle">
        Arquivos aprovados e publicados, identificados por mês e revisão.
      </p>
      <section className="panel">
        {schedules.map((schedule) => (
          <div className="row" key={schedule.id}>
            <span>
              {displayMonth(schedule.month)} · revisão {schedule.revision} ·{" "}
              {schedule.status}
            </span>
            <span>
              <Link href={`/api/schedules/${schedule.id}/pdf`}>PDF geral</Link>
              {schedule.assistedSnapshot && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/api/schedules/${schedule.id}/visitas`}>
                    Com contatos (restrito)
                  </Link>
                </>
              )}
            </span>
          </div>
        ))}
        {!schedules.length && (
          <p className="empty">Nenhum arquivo aprovado ou publicado.</p>
        )}
      </section>
    </>
  );
}
