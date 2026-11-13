import Link from "next/link";
import { coordinator } from "@/lib/auth";
import { CsvImport } from "@/components/csv-import";
export const dynamic = "force-dynamic";
export default async function ImportAssisted() {
  await coordinator();
  return (
    <>
      <h1>Importar assistidos</h1>
      <p>
        Baixe o exemplo, substitua os dados fictícios e envie o CSV em UTF-8,
        separado por vírgula ou ponto e vírgula. Até 500 registros por arquivo.
      </p>
      <p>
        <a href="/api/assisted/template">Baixar CSV de exemplo de assistidos</a>{" "}
        · <Link href="/assistidos">Voltar aos assistidos</Link>
      </p>
      <details>
        <summary>Como preencher</summary>
        <p>
          Nome é obrigatório. Quantidade de ministros: inteiro de 1 a 100
          (padrão 1 quando a coluna é omitida); para Altevita, indique 3 ou
          mais. Ativo: SIM ou NAO. Telefones e CEP devem permanecer como texto
          na planilha, preservando zeros.
        </p>
        <p>
          Para novos cadastros, deixe id vazio. Para atualizar, copie o ID
          exibido na listagem de Assistidos e marque Atualizar. Não vinculamos
          pessoas apenas por nome ou endereço. Cadastros semelhantes sem ID são
          ignorados na criação; na atualização, exigem identificação explícita.
          Remova colunas opcionais para preservar seus valores; células vazias
          substituem os dados anteriores e quantidade/ativo vazios são
          inválidos. Alterações não reescrevem visitas ou escalas já publicadas.
        </p>
      </details>
      <CsvImport entity="assisted" />
    </>
  );
}
