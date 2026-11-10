import { actor } from "@/lib/auth";
import { readData } from "@/lib/store";
import { monthlyResponse } from "@/app/operations";
import { Notice, Field } from "@/components/fields";
export const dynamic = "force-dynamic";
export default async function Responses({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; saved?: string }>;
}) {
  const user = await actor();
  const data = await readData();
  const query = await searchParams;
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  )
    .toISOString()
    .slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : next;
  const ministers = data.ministers.filter(
    (m) => m.active && (user.coordinator || m.id === user.ministerId),
  );
  return (
    <>
      <h1>Respostas de disponibilidade</h1>
      <p className="subtitle">
        Registre seus impedimentos antes de concluir o envio. Também é possível
        informar que você não possui impedimentos.
      </p>
      <Notice {...query} />
      <form className="toolbar">
        <Field
          name="month"
          label="Mês de referência"
          type="month"
          value={month}
        />
        <button className="secondary">Consultar</button>
      </form>
      <section className="panel">
        <h2>
          {user.coordinator ? "Consolidação do mês" : "Minha resposta mensal"}
        </h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ministro</th>
                <th>Resposta</th>
                <th>Impedimentos informados</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {ministers.map((m) => {
                const submitted = data.responses?.find(
                  (r) => r.ministerId === m.id && r.month === month,
                );
                const count = data.absences.filter(
                  (a) =>
                    a.ministerId === m.id &&
                    (a.scope === "CELEBRATION"
                      ? data.events.some(
                          (e) => e.id === a.eventId && e.date.startsWith(month),
                        )
                      : a.start <= month + "-31" && a.end >= month + "-01"),
                ).length;
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{submitted ? "Concluída" : "Aguardando resposta"}</td>
                    <td>{count}</td>
                    <td>
                      <form action={monthlyResponse}>
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="ministerId" value={m.id} />
                        <button className="secondary">
                          {user.coordinator
                            ? "Consolidar resposta"
                            : count
                              ? "Concluir envio"
                              : "Concluir sem impedimentos"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
