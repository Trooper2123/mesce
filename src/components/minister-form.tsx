import type { Minister } from "@/lib/domain";
import { Field } from "./fields";
import { ServicePreferences } from "./service-preferences";
import { ActionForm, type SaveResult } from "./action-form";
export function MinisterForm({
  minister,
  spouses = [],
  action,
  complete = false,
}: {
  minister: Minister;
  spouses?: Pick<Minister, "id" | "name">[];
  action: (form: FormData) => Promise<SaveResult>;
  complete?: boolean;
}) {
  return (
    <ActionForm action={action}>
      <p>
        E-mail de acesso: <strong>{minister.email}</strong>
      </p>
      <div className="form-grid">
        <Field
          name="name"
          label="Nome completo"
          value={minister.name}
          required
        />
        <Field
          name="preferredName"
          maxLength={80}
          label="Nome de preferência nas escalas"
          value={minister.preferredName}
        />
        <p className="muted">
          Use o nome pelo qual deseja aparecer nas escalas e PDFs. Se não
          preencher, será usado o nome completo.
        </p>
        <Field
          name="birthDate"
          label="Data de nascimento"
          type="date"
          value={minister.birthDate}
        />
        <Field
          name="phone"
          label="Telefone de contato"
          type="tel"
          value={minister.phone}
        />
        <Field
          name="ministryStart"
          label="Início no ministério"
          type="date"
          value={minister.ministryStart}
        />
        <Field
          name="address"
          label="Endereço (logradouro, número e complemento)"
          value={minister.address}
        />
        <Field
          name="neighborhood"
          label="Bairro"
          value={minister.neighborhood}
        />
        <Field name="city" label="Cidade" value={minister.city} />
        <Field name="state" label="UF" value={minister.state} />
        <Field name="postalCode" label="CEP" value={minister.postalCode} />
        <ServicePreferences minister={minister} />
        {!complete && (
          <>
            <Field
              name="spouseId"
              label="Cônjuge ministro"
              value={minister.spouseId}
              options={[
                ["", "Sem vínculo"],
                ...spouses
                  .filter((s) => s.id !== minister.id)
                  .map((s) => [s.id, s.name] as const),
              ]}
            />
            <Field
              name="couplePreference"
              label="Preferência do casal"
              value={minister.couplePreference}
              options={[
                ["NONE", "Sem preferência"],
                ["TOGETHER", "Servir juntos"],
                ["SEPARATE", "Servir separados"],
              ]}
            />
          </>
        )}
        <Field
          name="notes"
          label="Observações"
          type="textarea"
          value={minister.notes}
        />
      </div>
      <div className="form-actions">
        <button>
          {complete ? "Concluir meu cadastro" : "Salvar meus dados"}
        </button>
      </div>
    </ActionForm>
  );
}
