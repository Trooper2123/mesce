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
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await actor();
  if (!user.coordinator)
    return (
      <section className="panel">
        <h1>Bem-vindo ao ministério</h1>
        <p>
          Consulte suas designações e informe seus impedimentos para o próximo
          mês.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/minhas-escalas">
            Minhas escalas
          </Link>
          <Link className="button secondary" href="/impedimentos">
            Informar impedimentos
          </Link>
        </div>
      </section>
    );
  const data = await readData();
  const month = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date())
    .slice(0, 7);
  const events = data.events
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const schedule = data.schedules
    .filter((s) => s.month === month)
    .sort((a, b) => b.revision - a.revision)[0];
  const stats = [
    [
      "Ministros ativos",
      data.ministers.filter((m) => m.active && !m.away).length,
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
            Tudo pronto para organizar os próximos encontros.
          </p>
        </div>
        <Link className="button" href="/escalas">
          Preparar escala <ArrowUpRight size={18} />
        </Link>
      </div>
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
                  <small>{e.time}</small>
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
