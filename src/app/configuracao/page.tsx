import { pool, readData } from "@/lib/store";
import { settingsAction } from "@/app/operations";
import { Field } from "@/components/fields";
import { coordinator } from "@/lib/auth";
import { legacyImportAction } from "@/app/operations";
import { Notice } from "@/components/fields";
export const dynamic = "force-dynamic";
export default async function Configuration({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await coordinator();
  const query = await searchParams;
  const settings = (await readData()).settings!;
  return (
    <>
      <h1>Configuração operacional</h1>
      <Notice {...query} />
      <section className="panel">
        <h2>Regras de planejamento</h2>
        <form action={settingsAction}>
          <div className="form-grid">
            <Field
              name="unansweredPolicy"
              label="Ministro sem resposta mensal"
              value={settings.unansweredPolicy}
              options={[
                ["REVIEW", "Exigir resposta ou consolidação pela coordenação"],
                [
                  "ELIGIBLE",
                  "Considerar elegível quando não houver impedimento",
                ],
              ]}
            />
            <Field
              name="monthlyLimit"
              label="Limite padrão para novos cadastros"
              type="number"
              value={settings.monthlyLimit}
            />
            <Field
              name="historyMonths"
              label="Meses considerados no histórico"
              type="number"
              value={settings.historyMonths}
            />
          </div>
          <div className="form-actions">
            <button>Salvar regras</button>
          </div>
        </form>
        <p>
          A política é explícita. Nenhuma ausência de resposta confirma
          disponibilidade.
        </p>
      </section>
      <section className="panel">
        <h2>Preservar dados do sistema anterior</h2>
        <p>
          A importação copia os cadastros legados mantendo identificadores e
          vínculos. O banco original não é apagado. Execute primeiro em
          homologação, usando a chave original dos dados.
        </p>
        <p>
          Quando houver visitas, impedimentos ou designações legadas ainda não
          mapeadas, a importação será interrompida sem alterações.
        </p>
        <form action={legacyImportAction}>
          <button>Importar cadastros legados neste ambiente</button>
        </form>
      </section>
      <section className="panel">
        <h2>Regras desta versão</h2>
        <ul>
          <li>Novos agendamentos somente futuros, no horário de Brasília.</li>
          <li>Pré-cadastro por allowlist, sem envio de convites.</li>
          <li>Ministro edita apenas o próprio cadastro.</li>
          <li>
            Impedimentos do próximo mês até o dia 25; exceções pela coordenação.
          </li>
          <li>Publicação exige nova validação das restrições.</li>
        </ul>
      </section>
    </>
  );
}
