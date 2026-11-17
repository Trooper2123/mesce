import Link from "next/link";
import { coordinator } from "@/lib/auth";
import { readData, readEventAudit } from "@/lib/store";
import { Field } from "@/components/fields";

export const dynamic = "force-dynamic";
export default async function EventChanges({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; q?: string }>;
}) {
  await coordinator();
  const query = await searchParams;
  const page = /^\d+$/.test(query.page ?? "")
    ? Math.max(1, Number(query.page))
    : 1;
  const [entries, data] = await Promise.all([
    readEventAudit((page - 1) * 50, 51),
    readData(),
  ]);
  const filtered = entries
    .slice(0, 50)
    .filter(
      (entry) =>
        (!query.type || entry.action === query.type) &&
        (!query.q ||
          JSON.stringify(entry)
            .toLocaleLowerCase("pt-BR")
            .includes(query.q.toLocaleLowerCase("pt-BR"))),
    );
  return (
    <>
      <h1>Eventos com ajustes</h1>
      <p className="subtitle">
        Remarcações, cancelamentos e exclusões registradas pela auditoria.
      </p>
      <form className="toolbar" role="search">
        <Field
          name="type"
          label="Tipo de ajuste"
          value={query.type ?? ""}
          options={[
            ["", "Todos"],
            ["event:reschedule", "Remarcação"],
            ["event:cancel", "Cancelamento"],
            ["event:exclude", "Exceção de série"],
            ["event:delete", "Exclusão"],
          ]}
        />
        <Field name="q" label="Buscar" value={query.q ?? ""} />
        <button className="secondary">Filtrar</button>
      </form>
      <section className="panel">
        {filtered.map((entry) => {
          const details = entry.details as
            | {
                before?: { title?: string; date?: string };
                after?: { title?: string; date?: string };
              }
            | undefined;
          const current = data.events.find(
            (event) => event.id === entry.recordId,
          );
          return (
            <article className="row" key={entry.id}>
              <span>
                <strong>
                  {current?.title ??
                    details?.after?.title ??
                    details?.before?.title ??
                    "Evento excluído"}
                </strong>
                <small>
                  {entry.action.replace("event:", "")} ·{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(entry.createdAt))}{" "}
                  · autor {entry.actor}
                </small>
                <small>
                  {details?.before
                    ? `${details.before.date ?? "valor anterior"} → ${details.after?.date ?? "sem registro corrente"}`
                    : "Detalhes anteriores indisponíveis"}
                </small>
              </span>
              {current && (
                <Link href={`/agenda/celebracoes?edit=${current.id}`}>
                  Versão corrente
                </Link>
              )}
            </article>
          );
        })}
        {!filtered.length && (
          <p className="empty">Nenhum ajuste corresponde aos filtros.</p>
        )}
      </section>
      <nav className="toolbar" aria-label="Paginação">
        {page > 1 && (
          <Link href={`/agenda/ajustes?page=${page - 1}`}>Página anterior</Link>
        )}
        {entries.length > 50 && (
          <Link href={`/agenda/ajustes?page=${page + 1}`}>Próxima página</Link>
        )}
      </nav>
    </>
  );
}
