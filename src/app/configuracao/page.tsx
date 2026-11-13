import { pool, readData } from "@/lib/store";
import { settingsAction } from "@/app/operations";
import { Field } from "@/components/fields";
import { coordinator } from "@/lib/auth";
import { legacyImportAction } from "@/app/operations";
import { Notice } from "@/components/fields";
import Link from "next/link";
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
      <span className="eyebrow">Coordenação</span>
      <h1>Configurações</h1>
      <p className="subtitle">
        Defina como as escalas são preparadas. As alterações valem para as
        próximas gerações de escala.
      </p>
      <Notice {...query} />
      <section className="panel">
        <h2>Planejamento das escalas</h2>
        <p>
          Escolha como tratar respostas ausentes e como equilibrar as
          designações entre os ministros.
        </p>
        <form action={settingsAction}>
          <div className="form-grid">
            <Field
              name="unansweredPolicy"
              label="Quando o ministro não responder aos impedimentos"
              value={settings.unansweredPolicy}
              options={[
                ["REVIEW", "Deixar pendente para a coordenação revisar"],
                [
                  "ELIGIBLE",
                  "Considerar apto se não houver impedimento registrado",
                ],
              ]}
            />
            <Field
              name="monthlyLimit"
              label="Limite mensal padrão para novos ministros (vazio = sem limite)"
              type="number"
              value={settings.monthlyLimit ?? ""}
              max={100}
            />
            <Field
              name="historyMonths"
              label="Período usado para equilibrar a distribuição"
              type="number"
              value={settings.historyMonths}
              max={36}
            />
          </div>
          <p className="muted">
            O limite padrão soma missas e visitas e não altera os limites de
            ministros já cadastrados. O período de equilíbrio pode ser definido
            de 1 a 36 meses. Deixar o limite vazio não desativa o equilíbrio.
          </p>
          <div className="form-actions">
            <button>Salvar configurações</button>
            <button type="reset" className="secondary">
              Cancelar
            </button>
            <Link className="button secondary" href="/configuracao">
              Voltar
            </Link>
          </div>
        </form>
      </section>
      <details className="panel">
        <summary>Importação técnica do sistema anterior</summary>
        <h2>Importar cadastros legados</h2>
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
      </details>
    </>
  );
}
