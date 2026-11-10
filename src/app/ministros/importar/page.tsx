import Link from "next/link";
import { coordinator } from "@/lib/auth";
import { CsvImport } from "@/components/csv-import";
export const dynamic = "force-dynamic";
export default async function ImportMinisters() {
  await coordinator();
  return (
    <>
      <h1>Importar ministros</h1>
      <p>
        Use UTF-8, separador vírgula ou ponto e vírgula e datas AAAA-MM-DD. Nome
        e e-mail são obrigatórios para identificar os cadastros; demais dados
        podem ser completados depois.
      </p>
      <p>
        <a href="/api/ministers/template">
          Baixar modelo CSV com dados fictícios
        </a>{" "}
        · <Link href="/ministros">Voltar aos ministros</Link>
      </p>
      <details>
        <summary>Valores aceitos no modelo</summary>
        <p>
          Situação: ATIVO, AFASTADO, INATIVO, EX_MINISTRO. Atividades: AMBAS,
          CELEBRACOES, VISITAS. Preferência da comunidade: ACEITA, PREFERENCIAL,
          EXCLUSIVA. Casal: SEM_PREFERENCIA, JUNTOS, SEPARADOS; informe o e-mail
          do cônjuge já cadastrado ou presente no mesmo arquivo. Limite vazio
          significa sem teto mensal. Remova colunas opcionais para preservar
          seus valores em atualizações; uma célula vazia substitui o valor
          anterior, quando aplicável.
        </p>
      </details>
      <CsvImport />
    </>
  );
}
