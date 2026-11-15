import { RemoveRecord } from "@/components/remove-record";
import { coordinator } from "@/lib/auth";
import { readData } from "@/lib/store";
import { locationCatalog } from "@/lib/locations";
import { saveLocation } from "@/app/location-actions";
import { ActionForm } from "@/components/action-form";
import { Field, Check, Notice } from "@/components/fields";
export const dynamic = "force-dynamic";
export default async function Locations({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  await coordinator();
  const data = await readData();
  const query = await searchParams;
  return (
    <>
      <h1>Locais e comunidades</h1>
      <Notice {...query} />
      {query.deleted && <p role="status">Cadastro excluído com sucesso.</p>}
      <p>
        Use o catálogo nas celebrações e nas preferências dos ministros.
        Renomear mantém os vínculos; inativar impede novas escolhas sem apagar o
        histórico. Nomes antigos são recuperados sem unir apelidos
        automaticamente.
      </p>
      <section className="panel">
        <h2>Cadastrar local</h2>
        <ActionForm action={saveLocation}>
          <Field name="name" label="Nome do local" required maxLength={120} />
          <Check name="active" label="Local ativo" checked />
          <button>Adicionar local</button>
        </ActionForm>
      </section>
      <section className="panel">
        <h2>Locais cadastrados</h2>
        {locationCatalog(data).map((l) => (
          <details key={l.id} id={`local-${l.id}`}>
            <summary>
              {l.name} · {l.active ? "Ativo" : "Inativo"}
            </summary>
            <ActionForm action={saveLocation}>
              <input name="id" type="hidden" value={l.id} />
              <input name="expectedName" type="hidden" value={l.name} />
              <Field
                name="name"
                label="Nome do local"
                value={l.name}
                required
                maxLength={120}
              />
              <Check name="active" label="Local ativo" checked={l.active} />
              <button>Salvar local</button>
            </ActionForm>
            <RemoveRecord kind="location" record={l} label={l.name} />
          </details>
        ))}
      </section>
    </>
  );
}
