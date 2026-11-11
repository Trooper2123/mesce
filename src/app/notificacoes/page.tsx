import Link from "next/link";
import { notFound } from "next/navigation";
import { actor } from "@/lib/auth";
import { readData } from "@/lib/store";
import { notificationsFor } from "@/lib/notifications";
export const dynamic = "force-dynamic";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await actor();
  const [data, query] = await Promise.all([readData(), searchParams]);
  const notices = notificationsFor(data, user);
  const selected = query.id
    ? notices.find((n) => n.id === query.id)
    : undefined;
  if (query.id && !selected) notFound();
  return (
    <>
      <h1>Central de notificações</h1>
      <p className="subtitle">
        Publicações, revisões e lembretes dos próximos sete dias. Consultar um
        aviso não confirma disponibilidade nem aprova a escala.
      </p>
      {selected ? (
        <article className="panel">
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
          <p>
            {selected.month} · Revisão {selected.revision}
          </p>
          <div className="hero-actions">
            <Link className="button" href={selected.href}>
              Abrir escala relacionada
            </Link>
            <Link href="/notificacoes">Voltar às notificações</Link>
          </div>
        </article>
      ) : (
        <section className="panel" aria-label="Notificações atuais">
          {!notices.length ? (
            <p className="empty">
              Nenhuma notificação disponível. Novas publicações e compromissos
              aparecerão aqui.
            </p>
          ) : (
            notices.map((n) => (
              <article className="row" key={n.id}>
                <div>
                  <h2>
                    <Link href={`/notificacoes?id=${encodeURIComponent(n.id)}`}>
                      {n.title}
                    </Link>
                  </h2>
                  <p>{n.description}</p>
                  <small>
                    {n.month} · Revisão {n.revision}
                  </small>
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </>
  );
}
