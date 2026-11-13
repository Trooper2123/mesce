import Link from "next/link";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, audit } from "@/lib/store";
import { operationalReport } from "@/lib/reports";
import { Field } from "@/components/fields";
export const dynamic = "force-dynamic";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; months?: string; minister?: string }>;
}) {
  const user = await coordinator();
  const query = await searchParams;
  const month = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
      }).format(new Date());
  const months = query.months === "12" ? 12 : 1;
  const report = await transaction(async (client, data) => {
    await assertCurrentActor(client, user, true);
    const result = operationalReport(data, month, months);
    await audit(client, user.id, "reports:read", undefined, {
      start: result.period.start,
      end: month,
      months,
      schedules: result.schedules.map((s) => s.id),
    });
    return result;
  });
  const entries = report.entries.filter(
    (e) => !query.minister || e.ministerId === query.minister,
  );
  return (
    <>
      <h1>Relatórios e histórico</h1>
      <p className="subtitle">
        Designações publicadas, separadas por celebrações e visitas. As
        contagens representam designações, sem confirmar presença ou atendimento
        realizado.
      </p>
      <form className="toolbar">
        <Field
          name="month"
          label="Mês final"
          type="month"
          value={month}
          required
        />
        <Field
          name="months"
          label="Período"
          value={String(months)}
          options={[
            ["1", "Somente o mês"],
            ["12", "12 meses até o mês final"],
          ]}
        />
        <Field
          name="minister"
          label="Detalhes do ministro"
          value={query.minister}
          options={[
            ["", "Todos"],
            ...report.participation.map((m) => [m.id, m.name] as const),
          ]}
        />
        <button>Consultar</button>
      </form>
      <p>
        {report.period.start} a {month} · {report.schedules.length}{" "}
        competência(s) publicada(s). Rascunhos e versões substituídas ou
        canceladas não entram nas contagens.
      </p>
      <p className="muted">
        Mínimo, máximo e média consideram todos os ministros cadastrados,
        inclusive sem designações, e registros presentes somente no histórico.
        Não medem disponibilidade ou cumprimento. O filtro de ministro afeta
        apenas o histórico detalhado.
      </p>
      <div className="cards">
        {(
          [
            ["Celebrações", report.celebrations],
            ["Visitas", report.visits],
          ] as const
        ).map(([label, stats]) => (
          <section className="card" key={label}>
            <h2>{label}</h2>
            <strong className="stat">{stats.total}</strong>
            <p>
              Mínimo {stats.min} · Máximo {stats.max} · Média{" "}
              {stats.average.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              · Diferença {stats.difference}
            </p>
          </section>
        ))}
      </div>
      {!report.schedules.length && (
        <p className="notice">
          Nenhuma escala publicada vigente nesse período. Cadastros e agendas
          ainda não publicados não representam participação.
        </p>
      )}
      <section className="panel">
        <h2>Participação por ministro</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ministro</th>
                <th>Situação atual</th>
                <th>Celebrações</th>
                <th>Visitas</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.participation.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.status}</td>
                  <td>{m.celebrations}</td>
                  <td>{m.visits}</td>
                  <td>{m.celebrations + m.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report.participation.length && (
          <p>Nenhum ministro no período ou cadastro.</p>
        )}
      </section>
      <section className="panel">
        <h2>Escalas publicadas</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Atividade</th>
                <th>Ministros designados</th>
                <th>Vagas</th>
                <th>Versão</th>
              </tr>
            </thead>
            <tbody>
              {report.events.map((row) => (
                <tr key={row.scheduleId + row.event.id}>
                  <td>
                    {row.event.date} · {row.event.time}
                  </td>
                  <td>
                    {row.event.title} · {row.event.location}
                  </td>
                  <td>
                    {row.ministers.join(", ") || "Sem designação"} ({row.filled}
                    /{row.event.required})
                  </td>
                  <td>{row.vacancies}</td>
                  <td>
                    <Link href={"/escalas?month=" + row.event.date.slice(0, 7)}>
                      Revisão {row.revision}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Assistidos e responsáveis pelas visitas</h2>
        <p className="muted">
          Informações restritas à coordenação, preservadas no snapshot da
          publicação. Contatos atuais devem ser conferidos no cadastro de
          Assistidos.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Visita</th>
                <th>Assistido</th>
                <th>Responsáveis</th>
                <th>Contato e endereço publicados</th>
              </tr>
            </thead>
            <tbody>
              {report.events
                .filter((row) => row.event.kind === "VISIT")
                .map((row) => (
                  <tr key={row.scheduleId + row.event.id}>
                    <td>
                      {row.event.date} · {row.event.time}
                    </td>
                    <td>
                      {row.assistedPeople.map((p) => p.name).join(", ") ||
                        "Snapshot indisponível"}
                    </td>
                    <td>{row.ministers.join(", ") || "Sem responsável"}</td>
                    <td>
                      {row.assistedPeople.length
                        ? row.assistedPeople.map((person) => (
                            <div key={person.id}>
                              {person.mobile || person.landline}
                              <br />
                              {person.address} · {person.neighborhood} ·{" "}
                              {person.city}/{person.state}
                              <br />
                              Familiar: {person.familyName} {person.familyPhone}
                            </div>
                          ))
                        : "Sem dados históricos; consulte o cadastro."}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Histórico detalhado de designações</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ministro na publicação</th>
                <th>Data e hora</th>
                <th>Modalidade</th>
                <th>Competência / versão</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.scheduleId + e.eventId + e.ministerId}>
                  <td>{e.minister}</td>
                  <td>
                    {e.date} · {e.time}
                  </td>
                  <td>{e.kind === "VISIT" ? "Visita" : "Celebração"}</td>
                  <td>
                    {e.month} · {e.revision}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && <p>Nenhuma designação para este filtro.</p>}
      </section>
    </>
  );
}
