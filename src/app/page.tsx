import Link from "next/link";
import {
  UsersRound,
  HeartHandshake,
  CalendarDays,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import { actor } from "@/lib/auth";
import { readData } from "@/lib/store";
import {
  currentMonth,
  eventTimeLabel,
  latestPublished,
  nextMonth,
} from "@/lib/domain";
import { linkedMinister } from "@/lib/access";
import { missingMinisterFields } from "@/lib/profile";
import { isAltevitaGroupVisit } from "@/lib/visit-group";
import { nextScheduleMonth } from "@/lib/celebration-options";
import { displayMonth } from "@/lib/display-date";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await actor();
  const data = await readData();
  if (!user.coordinator) {
    const minister = linkedMinister(user, data);
    const thisMonth = currentMonth();
    const publishedSchedules = minister
      ? latestPublished(data)
          .filter(
            (schedule) =>
              schedule.month >= thisMonth &&
              schedule.assignments.some(
                (assignment) => assignment.ministerId === minister.id,
              ),
          )
          .sort((a, b) => a.month.localeCompare(b.month))
      : [];
    const schedule =
      publishedSchedules.find((item) => item.month === thisMonth) ??
      publishedSchedules[0];
    const assignments =
      schedule?.assignments.filter(
        (assignment) => assignment.ministerId === minister?.id,
      ) ?? [];
    const events = assignments
      .map((assignment) =>
        schedule?.events.find((event) => event.id === assignment.eventId),
      )
      .filter((event): event is NonNullable<typeof event> => !!event)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const agendaHref = schedule
      ? `/minhas-escalas#escala-${schedule.id}`
      : "/minhas-escalas";
    const agendaMonth = schedule?.month ?? thisMonth;
    const preparation = nextScheduleMonth();
    const [preparationYear, preparationNumber] = preparation
      .split("-")
      .map(Number);
    const deadlineMonth = new Date(
      Date.UTC(preparationYear, preparationNumber - 2, 1),
    )
      .toISOString()
      .slice(0, 7);
    const agendaMonthLabel = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${agendaMonth}-01T12:00:00Z`));
    return (
      <>
        <div className="hero minister-home-heading">
          <div>
            <span className="eyebrow">A serviço da comunidade</span>
            <h1>Visão geral do ministro</h1>
            <p className="subtitle">
              Consulte sua agenda e acesse os recursos do ministério.
            </p>
          </div>
          <Link className="button secondary" href="/notificacoes">
            Central de notificações
          </Link>
        </div>
        <section
          className="intro minister-reminder"
          aria-labelledby="availability-title"
        >
          <div>
            <span className="eyebrow">SUA DISPONIBILIDADE</span>
            <h2 id="availability-title">
              Uma escala justa começa com sua disponibilidade.
            </h2>
            <p>
              Para a escala de {displayMonth(preparation)}, informe os dias em
              que não poderá servir até 25 de {displayMonth(deadlineMonth)}.
            </p>
          </div>
          <Link className="button secondary" href="/impedimentos">
            Informar impedimentos
          </Link>
        </section>
        <div className="grid minister-home-grid">
          <section className="panel" aria-labelledby="minister-agenda">
            <div className="panel-head">
              <div>
                <h2 id="minister-agenda">Agenda do mês</h2>
                <small className="muted">{agendaMonthLabel}</small>
              </div>
              <Link className="action" href={agendaHref}>
                Ver minha escala →
              </Link>
            </div>
            {events.length ? (
              events.map((event) => (
                <div className="row" key={event.id}>
                  <div className="datebox">
                    {event.date.slice(8)}
                    <small>{eventTimeLabel(event)}</small>
                  </div>
                  <div className="minister-agenda-details">
                    <strong>
                      {isAltevitaGroupVisit(event, data.assisted)
                        ? "Atendimento ao grupo Altevita"
                        : event.title}
                    </strong>
                    <div className="muted">
                      {event.kind === "VISIT" ? "Visita" : "Celebração"} ·{" "}
                      {event.location}
                    </div>
                  </div>
                  <span className="tag">
                    {event.kind === "VISIT" ? "Visita" : "Escala"}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">
                <CalendarDays size={30} />
                <p>
                  {minister
                    ? "Não há designações publicadas para você neste mês."
                    : "Seu e-mail ainda não está vinculado a um cadastro de ministro."}
                </p>
                <Link href="/minhas-escalas">Consultar minhas escalas</Link>
              </div>
            )}
          </section>
          <section className="panel" aria-labelledby="minister-features">
            <div className="panel-head">
              <h2 id="minister-features">Funcionalidades disponíveis</h2>
            </div>
            <ol className="steps minister-feature-list">
              <li>
                <Link href="/meus-dados">Meu cadastro e preferências</Link>
                <small>
                  Atualize seus contatos, comunidades e atividades preferidas.
                  {minister &&
                    missingMinisterFields(minister).length > 0 &&
                    ` Pendências: ${missingMinisterFields(minister).join(", ")}.`}
                </small>
              </li>
              <li>
                <Link href="/impedimentos">Impedimentos</Link>
                <small>
                  Informe datas, períodos ou celebrações em que não poderá
                  servir.
                </small>
              </li>
              <li>
                <Link href="/minhas-escalas">Minhas escalas</Link>
                <small>
                  Consulte compromissos publicados e os detalhes das visitas
                  designadas a você.
                </small>
              </li>
              <li>
                <Link href="/minhas-escalas/calendario">Agenda pessoal</Link>
                <small>
                  Sincronize seus compromissos com o calendário do celular.
                </small>
              </li>
              <li>
                <Link href="/minhas-escalas/avisos">Lembretes e avisos</Link>
                <small>
                  Configure avisos por push e e-mail sobre publicações e
                  mudanças.
                </small>
              </li>
            </ol>
          </section>
        </div>
      </>
    );
  }
  const month = nextMonth();
  const events = data.events
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const schedule = data.schedules
    .filter((s) => s.month === month)
    .sort((a, b) => b.revision - a.revision)[0];
  const stats = [
    [
      "Ministros ativos",
      data.ministers.filter(
        (m) => m.active && !m.former && m.registrationStatus !== "DRAFT",
      ).length,
      "Pessoas a serviço",
      UsersRound,
    ],
    [
      "Assistidos",
      data.assisted.filter((a) => a.active).length,
      "Cuidado e acompanhamento",
      HeartHandshake,
    ],
    [
      "Compromissos do mês",
      events.length,
      "Celebrações e visitas",
      CalendarDays,
    ],
    [
      "Designações",
      schedule?.assignments.length ?? 0,
      "Na revisão mais recente",
      ClipboardList,
    ],
  ] as const;
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">Cuidar · Organizar · Servir</span>
          <h1>Visão geral do ministério</h1>
          <p className="subtitle">
            Gerencie os cadastros, impedimentos e escalas de todo o ministério.
          </p>
        </div>
        <Link className="button" href="/escalas">
          Preparar escala <ArrowUpRight size={18} />
        </Link>
      </div>
      <section className="panel" aria-labelledby="coordinator-actions">
        <h2 id="coordinator-actions">Gestão da coordenação</h2>
        <p>
          Cadastre e atualize as informações diretamente, sem depender do
          primeiro acesso do ministro. Você também pode registrar e corrigir
          impedimentos de qualquer ministro fora do prazo mensal.
        </p>
        <div className="hero-actions">
          <Link className="button secondary" href="/notificacoes">
            Central de notificações
          </Link>
          <Link className="button secondary" href="/ministros?new=1">
            Cadastrar ministro
          </Link>
          <Link className="button secondary" href="/assistidos?new=1">
            Cadastrar assistido
          </Link>
          <Link className="button secondary" href="/impedimentos?new=1">
            Registrar impedimento
          </Link>
          <Link className="button secondary" href="/pre-cadastros">
            Autorizar acesso de ministros
          </Link>
        </div>
      </section>
      <div className="cards">
        {stats.map(([label, total, note, Icon]) => (
          <article className="card" key={label}>
            <div className="card-title">
              {label}
              <Icon size={22} />
            </div>
            <span className="stat">{total}</span>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <section className="intro">
        <div>
          <span className="eyebrow">Planejamento mensal</span>
          <h2>Uma escala justa começa com a disponibilidade.</h2>
          <p>
            Reúna os impedimentos até o dia 25 e revise a agenda antes de gerar
            a proposta.
          </p>
        </div>
        <Link className="button secondary" href="/impedimentos">
          Ver impedimentos
        </Link>
      </section>
      <div className="grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Agenda do mês</h2>
            <Link className="action" href="/celebracoes">
              Ver agenda →
            </Link>
          </div>
          {events.length ? (
            events.slice(0, 5).map((e) => (
              <div className="row" key={e.id}>
                <div className="datebox">
                  {e.date.slice(8)}
                  <small>{eventTimeLabel(e)}</small>
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{e.title}</strong>
                  <div className="muted">{e.location}</div>
                </div>
                <span className="tag">{e.required} vagas</span>
              </div>
            ))
          ) : (
            <div className="empty">
              <CalendarDays size={30} />
              <p>A agenda está esperando o primeiro encontro.</p>
              <Link href="/celebracoes">Cadastrar celebração ou visita</Link>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Próximos passos</h2>
            <span className="tag">Coordenação</span>
          </div>
          <ol className="steps">
            <li>
              <Link href="/ministros">Complete os cadastros dos ministros</Link>
            </li>
            <li>
              <Link href="/assistidos">Confira os assistidos e contatos</Link>
            </li>
            <li>
              <Link href="/celebracoes">Organize celebrações e visitas</Link>
            </li>
            <li>
              <Link href="/escalas">Gere, revise e aprove a escala</Link>
            </li>
          </ol>
          <p className="muted">
            A publicação só acontece depois da aprovação da coordenação.
          </p>
        </section>
      </div>
    </>
  );
}
