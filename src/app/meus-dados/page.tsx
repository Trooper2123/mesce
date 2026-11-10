import { actor } from "@/lib/auth";
import { readData } from "@/lib/store";
import { MinisterForm } from "@/components/minister-form";
import { Notice } from "@/components/fields";
import { saveOwnProfile } from "@/app/onboarding-actions";
export const dynamic = "force-dynamic";
export default async function Own({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await actor();
  const data = await readData();
  const minister = data.ministers.find((m) => m.id === user.ministerId);
  const query = await searchParams;
  return (
    <>
      <h1>Meus dados</h1>
      <p className="subtitle">
        Mantenha seus dados de contato e preferências atualizados.
      </p>
      <Notice {...query} />
      <section className="panel">
        {minister ? (
          <MinisterForm
            minister={{ ...minister, email: user.email }}
            spouses={data.ministers.map(({ id, name }) => ({ id, name }))}
            action={saveOwnProfile}
          />
        ) : (
          <p>
            Seu perfil de coordenação não possui cadastro de ministro vinculado.
            A coordenação pode autorizar seu e-mail em Pré-cadastros, caso
            também exerça o ministério.
          </p>
        )}
      </section>
    </>
  );
}
