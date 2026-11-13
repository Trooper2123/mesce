import Link from "next/link";
import { advisories } from "@/lib/domain";
import { coordinator } from "@/lib/auth";
import { readData } from "@/lib/store";
import { scheduleAction } from "@/app/actions";
import { Field, Notice } from "@/components/fields";
import { nextMonth } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Schedules({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; saved?: string }>;
}) {
  await coordinator();
  const query = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : nextMonth();
  const data = await readData();
  const history = data.schedules
    .filter((s) => s.month === month)
    .sort((a, b) => b.revision - a.revision);
  const schedule = history[0];
  const labels = {
    DRAFT: "Rascunho",
    IN_REVIEW: "Em revisão",
    CANCELLED: "Cancelada",
    APPROVED: "Aprovada",
    PUBLISHED: "Publicada",
  };
  const common = (
    <>
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="scheduleId" value={schedule?.id ?? ""} />
      <input
        type="hidden"
        name="editVersion"
        value={schedule?.editVersion ?? 1}
      />
    </>
  );
  return (
    <>
      <span className="eyebrow">Planejamento do ministério</span>
      <h1>Escalas mensais</h1>
      <p className="subtitle">
        Gere a proposta, revise os encontros e publique após a aprovação.
      </p>
      <Notice error={query.error} saved={query.saved} />
      <div className="panel">
        <form className="toolbar">
          <Field
            name="month"
            label="Mês de referência"
            type="month"
            value={month}
          />
          <button className="secondary">Consultar</button>
        </form>
        <div className="hero-actions">
          <form action={scheduleAction}>
            {common}
            <button name="operation" value="generate">
              {schedule && ["APPROVED", "PUBLISHED"].includes(schedule.status)
                ? "Abrir nova revisão"
                : "Gerar proposta"}
            </button>
          </form>
          {schedule && ["DRAFT", "IN_REVIEW"].includes(schedule.status) && (
            <form action={scheduleAction}>
              {common}
              <button name="operation" value="approve" className="secondary">
                Validar e aprovar
              </button>
            </form>
          )}
          {schedule?.status === "APPROVED" && (
            <form action={scheduleAction}>
              {common}
              <button name="operation" value="publish">
                Publicar escala
              </button>
            </form>
          )}
          {schedule && ["APPROVED", "PUBLISHED"].includes(schedule.status) && (
            <Link
              className="button secondary"
              href={`/api/schedules/${schedule.id}/pdf`}
            >
              Baixar PDF aprovado
            </Link>
          )}
          {schedule && ["DRAFT", "IN_REVIEW"].includes(schedule.status) && (
            <form action={scheduleAction}>
              {common}
              <button className="secondary" name="operation" value="sync">
                Sincronizar agenda e validar
              </button>
            </form>
          )}
        </div>
        <p className="muted">
          Limite mensal considera celebrações e visitas em conjunto. O
          equilíbrio considera separadamente cada modalidade e o histórico
          configurado. A política de não resposta é definida em Configuração;
          ausência de impedimento não confirma disponibilidade. Uma nova revisão
          preserva as versões aprovadas.
        </p>
      </div>
      {!schedule ? (
        <p className="empty">
          Cadastre os encontros e gere a primeira proposta deste mês.
        </p>
      ) : (
        <>
          <div className="panel-head">
            <h2>
              Revisão {schedule.revision}{" "}
              <span className="tag">{labels[schedule.status]}</span>
            </h2>
            <span>
              {schedule.assignments.length} designações ·{" "}
              {schedule.events.length} encontros
            </span>
          </div>
          {schedule.warnings.length > 0 && (
            <section className="notice error">
              <strong>Pendências para aprovação</strong>
              <ul>
                {schedule.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          )}
          {advisories(schedule).length > 0 && (
            <div className="notice">
              <strong>Avisos de distribuição (não bloqueiam aprovação)</strong>
              <ul>
                {advisories(schedule).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {schedule.events.map((event) => {
            const assigned = schedule.assignments.filter(
              (a) => a.eventId === event.id,
            );
            return (
              <article key={event.id} className="schedule-event panel">
                <div className="panel-head">
                  <div>
                    <h3>{event.title}</h3>
                    <span>
                      {event.date} · {event.time} · {event.location}
                    </span>
                  </div>
                  <span className="tag">
                    {assigned.length} / {event.required} ministros
                  </span>
                </div>
                <ul>
                  {assigned.map((a) => (
                    <li key={a.ministerId}>
                      {schedule.ministers.find((m) => m.id === a.ministerId)
                        ?.name ?? "Ministro"}
                    </li>
                  ))}
                </ul>
                {!assigned.length && <p>Vagas aguardando designação.</p>}
                {event.notes && <p className="muted">{event.notes}</p>}
                {["DRAFT", "IN_REVIEW"].includes(schedule.status) && (
                  <details>
                    <summary>Ajustar ministros ou quantidade de vagas</summary>
                    <form action={scheduleAction} className="inline-form">
                      {common}
                      <input type="hidden" name="eventId" value={event.id} />
                      <Field
                        name="ministerId"
                        label="Ministro"
                        options={data.ministers.map((m) => [m.id, m.name])}
                      />
                      <Field
                        name="mode"
                        label="Ação"
                        options={[
                          ["add", "Adicionar"],
                          ["remove", "Retirar"],
                        ]}
                      />
                      <Field name="reason" label="Justificativa" required />
                      <button name="operation" value="assign">
                        Salvar designação
                      </button>
                      <button type="reset" className="secondary">
                        Cancelar
                      </button>
                      <Link
                        className="button secondary"
                        href={`/escalas?month=${month}`}
                      >
                        Voltar
                      </Link>
                    </form>
                    <hr />
                    <form action={scheduleAction} className="inline-form">
                      {common}
                      <input type="hidden" name="eventId" value={event.id} />
                      <Field
                        name="required"
                        label="Vagas necessárias"
                        type="number"
                        value={event.required}
                      />
                      <Field name="reason" label="Justificativa" required />
                      <button
                        name="operation"
                        value="capacity"
                        className="secondary"
                      >
                        Alterar vagas
                      </button>
                      <button type="reset" className="secondary">
                        Cancelar
                      </button>
                      <Link
                        className="button secondary"
                        href={`/escalas?month=${month}`}
                      >
                        Voltar
                      </Link>
                    </form>
                    <p className="muted">
                      Reduzir vagas mantém as designações excedentes visíveis
                      para retirada explícita.
                    </p>
                  </details>
                )}
              </article>
            );
          })}
          <section className="panel">
            <h2>Distribuição de participações</h2>
            {[false, true].map((visit) => {
              const counts = schedule.ministers.map(
                (m) =>
                  schedule.assignments.filter(
                    (a) =>
                      a.ministerId === m.id &&
                      (schedule.events.find((e) => e.id === a.eventId)?.kind ===
                        "VISIT") ===
                        visit,
                  ).length,
              );
              const minimum = counts.length ? Math.min(...counts) : 0,
                maximum = counts.length ? Math.max(...counts) : 0;
              return (
                <p className="muted" key={String(visit)}>
                  {visit ? "Visitas" : "Celebrações"}: mínimo {minimum}, máximo{" "}
                  {maximum}, média{" "}
                  {counts.length
                    ? (
                        counts.reduce((a, b) => a + b, 0) / counts.length
                      ).toFixed(1)
                    : 0}
                  , diferença {maximum - minimum}.
                </p>
              );
            })}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ministro</th>
                    <th>Celebrações</th>
                    <th>Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.ministers.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      {[false, true].map((visit) => (
                        <td key={String(visit)}>
                          {
                            schedule.assignments.filter(
                              (a) =>
                                a.ministerId === m.id &&
                                (schedule.events.find((e) => e.id === a.eventId)
                                  ?.kind ===
                                  "VISIT") ===
                                  visit,
                            ).length
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>Histórico de versões</h2>
            {history.map((s) => (
              <div className="row" key={s.id}>
                <span>
                  Revisão {s.revision} · {labels[s.status]}
                </span>
                {["APPROVED", "PUBLISHED"].includes(s.status) && (
                  <Link href={`/api/schedules/${s.id}/pdf`}>
                    PDF desta versão
                  </Link>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
