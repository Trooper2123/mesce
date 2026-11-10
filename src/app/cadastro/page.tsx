import { redirect } from "next/navigation";
import { identity, resolveActor } from "@/lib/auth";
import { pool, readData } from "@/lib/store";
import { findAccess } from "@/lib/registration";
import { blankMinister } from "@/lib/profile";
import { MinisterForm } from "@/components/minister-form";
import { Notice } from "@/components/fields";
import { finishRegistration } from "@/app/onboarding-actions";
export const dynamic = "force-dynamic";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await identity();
  const access = await findAccess(pool(), user);
  const current = await resolveActor(pool(), user);
  if (current) redirect("/");
  const query = await searchParams;
  if (
    !user.verified ||
    !access ||
    ["REVOKED", "ACTIVE"].includes(access.status)
  )
    return (
      <section className="panel">
        <h1>Cadastro não autorizado</h1>
        <p>
          Seu e-mail deve estar verificado no Auth0 e autorizado pela
          coordenação. Entre em contato com a coordenação para confirmar seu
          pré-cadastro.
        </p>
        <p>Estar autenticado não libera o cadastro automaticamente.</p>
      </section>
    );
  const data = await readData();
  const prior = data.ministers.find((m) => m.id === access.minister_id) ?? {
    ...blankMinister(access.minister_id, user.email),
    monthlyLimit: data.settings?.monthlyLimit ?? 6,
  };
  return (
    <>
      <h1>Concluir meu cadastro</h1>
      <p className="subtitle">
        Seu e-mail foi autorizado pela coordenação. Complete seus dados para
        participar do ministério.
      </p>
      <Notice error={query.error} />
      <section className="panel">
        <MinisterForm
          minister={{ ...prior, email: user.email }}
          action={finishRegistration}
          complete
        />
      </section>
    </>
  );
}
