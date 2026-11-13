import { actor } from "@/lib/auth";
import { MinisterForm } from "@/components/minister-form";
import { Field, Notice } from "@/components/fields";
import {
  saveCoordinatorProfile,
  saveOwnProfile,
} from "@/app/onboarding-actions";
import { pool, readData } from "@/lib/store";
import { decrypt } from "@/lib/crypto";
import { ActionForm } from "@/components/action-form";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Own({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await actor();
  const data = await readData();
  const minister = data.ministers.find((m) => m.id === user.ministerId);
  const profileRow = user.coordinator
    ? await pool().query(
        "SELECT payload FROM mesce_coordinator_profiles WHERE auth0_sub=$1",
        [user.id],
      )
    : undefined;
  const coordinatorProfile = profileRow?.rows[0]
    ? (decrypt(profileRow.rows[0].payload) as { name: string; phone: string })
    : { name: "", phone: "" };
  const query = await searchParams;
  return (
    <>
      <h1>Meus dados</h1>
      <p className="subtitle">
        Mantenha seus dados de contato e preferências atualizados.
      </p>
      <Notice {...query} />
      <section className="panel">
        {user.coordinator && (
          <>
            <h2>Dados da coordenação</h2>
            <p className="muted">E-mail de acesso: {user.email}</p>
            <ActionForm action={saveCoordinatorProfile}>
              <div className="form-grid">
                <Field
                  name="name"
                  label="Nome completo"
                  value={coordinatorProfile.name}
                  required
                />
                <Field
                  name="phone"
                  label="Telefone de contato"
                  type="tel"
                  value={coordinatorProfile.phone}
                />
              </div>
              <div className="form-actions">
                <button>Salvar meus dados</button>
                <button type="reset" className="secondary">
                  Cancelar
                </button>
                <Link className="button secondary" href="/">
                  Voltar
                </Link>
              </div>
            </ActionForm>
          </>
        )}
        {minister ? (
          <>
            <h2>Dados do ministério</h2>
            <MinisterForm
              minister={{ ...minister, email: user.email }}
              spouses={data.ministers.map(({ id, name }) => ({ id, name }))}
              action={saveOwnProfile}
            />
          </>
        ) : (
          !user.coordinator && (
            <p>
              Seu perfil de coordenação não possui cadastro de ministro
              vinculado. A coordenação pode autorizar seu e-mail em
              Pré-cadastros, caso também exerça o ministério.
            </p>
          )
        )}
      </section>
    </>
  );
}
