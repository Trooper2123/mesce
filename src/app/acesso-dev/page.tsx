import { notFound } from "next/navigation";
import { previewEnabled } from "@/lib/preview-session";
import { previewLogin } from "@/app/onboarding-actions";
import { Field } from "@/components/fields";
export const dynamic = "force-dynamic";
export default async function PreviewLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!previewEnabled()) notFound();
  const query = await searchParams;
  return (
    <section className="panel welcome">
      <span className="eyebrow">Homologação</span>
      <h1>Acesso de desenvolvimento</h1>
      <p>
        Ambiente Preview isolado. Esta sessão de teste não é aceita em produção.
      </p>
      {query.error && (
        <p role="alert" className="notice error">
          {query.error}
        </p>
      )}
      <form action={previewLogin}>
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
