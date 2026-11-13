import { removePendingAccess } from "@/app/removal-actions";
import { ActionForm } from "@/components/action-form";
import { coordinator } from "@/lib/auth";
import { pool } from "@/lib/store";
import { listAccess } from "@/lib/registration";
import { allowlistAction } from "@/app/onboarding-actions";
import { Field, Notice } from "@/components/fields";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Allowlist({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  await coordinator();
  const query = await searchParams;
  const entries = await listAccess(pool());
  const labels = {
    PENDING: "Aguardando cadastro",
    ACTIVE: "Cadastro concluído",
    REVOKED: "Revogado",
  };
  return (
    <>
      <span className="eyebrow">Acesso ao ministério</span>
      <h1>Pré-cadastro de ministros</h1>
      <p className="subtitle">
        Autorize os e-mails. Cada ministro entra pelo Auth0 e conclui o próprio
        cadastro. Não são enviados convites por e-mail.
      </p>
      <Notice {...query} />
      {query.deleted && <p role="status">Pré-cadastro excluído com sucesso.</p>}
      <section className="panel">
        <form action={allowlistAction}>
          <input type="hidden" name="operation" value="add" />
          <Field
            name="emails"
            label="E-mails autorizados (linhas, vírgulas ou ponto e vírgula)"
            type="textarea"
            required
          />
          <div className="form-actions">
            <button>Autorizar pré-cadastros</button>
            <button type="reset" className="secondary">
              Cancelar
            </button>
            <Link className="button secondary" href="/pre-cadastros">
              Voltar
            </Link>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>E-mails autorizados</h2>
        {entries.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Situação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.email}</td>
                    <td>{labels[entry.status]}</td>
                    <td>
                      {entry.role === "MINISTER" && (
                        <form action={allowlistAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            className="secondary"
                            name="operation"
                            value={
                              entry.status === "REVOKED" ? "restore" : "revoke"
                            }
                          >
                            {entry.status === "REVOKED"
                              ? "Reautorizar"
                              : "Revogar acesso"}
                          </button>
                        </form>
                      )}
                      {entry.role === "MINISTER" &&
                        entry.status === "PENDING" &&
                        !entry.auth0_sub && (
                          <details>
                            <summary>Excluir pré-cadastro incorreto</summary>
                            <ActionForm action={removePendingAccess}>
                              <input type="hidden" name="id" value={entry.id} />
                              <Field
                                name="reason"
                                label="Motivo da exclusão"
                                required
                              />
                              <label className="field check">
                                <input
                                  type="checkbox"
                                  name="confirm"
                                  value="yes"
                                  required
                                />
                                Confirmo a exclusão de {entry.email}.
                              </label>
                              <button className="secondary">
                                Excluir definitivamente
                              </button>
                            </ActionForm>
                          </details>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Nenhum pré-cadastro registrado.</p>
        )}
      </section>
    </>
  );
}
