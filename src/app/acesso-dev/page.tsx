import { cookies } from "next/headers";
import { PreviewProfileFields } from "@/components/preview-profile-fields";
import { notFound } from "next/navigation";
import { previewEnabled, readPreviewSession } from "@/lib/preview-session";
import { previewLogin, switchPreviewProfile } from "@/app/onboarding-actions";
import { Field } from "@/components/fields";
export const dynamic = "force-dynamic";
export default async function PreviewLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!previewEnabled()) notFound();
  const query = await searchParams;
  const session = readPreviewSession(
    (await cookies()).get("mesce_preview")?.value ?? "",
  );
  return (
    <section className="panel welcome">
      <span className="eyebrow">Homologação</span>
      <h1>Acesso de desenvolvimento</h1>
      <p>
        Escolha Coordenador ou um dos dois ministros fictícios. Os ministros
        usam suas próprias permissões e cadastros; para testar escalas, designe
        o perfil escolhido pela visão de coordenação. Ambiente Preview isolado.
        Esta sessão de teste não é aceita em produção.
      </p>
      {query.error && (
        <p role="alert" className="notice error">
          {query.error}
        </p>
      )}
      {session && (
        <form action={switchPreviewProfile}>
          <PreviewProfileFields selected={session.previewProfile} />
          <button>Trocar perfil da sessão atual</button>
        </form>
      )}
      <form action={previewLogin}>
        <PreviewProfileFields selected={session?.previewProfile} />
        <Field
          name="password"
          type="password"
          label="Senha de homologação"
          required
        />
        <button>Entrar no Preview</button>
      </form>
    </section>
  );
}
