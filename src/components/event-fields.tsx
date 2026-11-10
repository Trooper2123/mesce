"use client";
import Link from "next/link";
import { useState } from "react";
import type { Event } from "@/lib/domain";
import { Field } from "./fields";
export function EventFields({
  event,
  assisted,
  visit = false,
}: {
  event?: Event;
  assisted: { id: string; name: string; ministersRequired: number }[];
  visit?: boolean;
}) {
  const [kind, setKind] = useState(event?.kind ?? (visit ? "VISIT" : "MASS"));
  const [assistedId, setAssistedId] = useState(event?.assistedId ?? "");
  const [options, setOptions] = useState(assisted);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/assisted-options", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const value = await response.json();
      if (!Array.isArray(value)) throw new Error();
      setOptions(value);
    } catch {
      setMessage("Não foi possível atualizar a lista. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <label className="field">
        Tipo de atividade
        <select
          name="eventKind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Event["kind"])}
        >
          <option value="MASS">Missa</option>
          <option value="ADORATION">Adoração</option>
          <option value="WEDDING">Casamento</option>
          <option value="SPECIAL">Evento especial</option>
          <option value="VISIT">Visita dominical</option>
        </select>
      </label>
      {kind === "VISIT" ? (
        <>
          <label className="field">
            Quantidade de ministros indicada
            <input
              name="required"
              type="number"
              readOnly
              value={
                options.find((a) => a.id === assistedId)?.ministersRequired ?? 1
              }
            />
          </label>
          <p className="muted">
            Quantidade definida no cadastro do assistido. Para mudar a equipe,
            edite o assistido e atualize a lista antes de salvar.
          </p>
        </>
      ) : (
        <Field
          key={"required-" + kind}
          name="required"
          label="Quantidade de ministros"
          type="number"
          value={event?.kind !== "VISIT" ? (event?.required ?? 2) : 2}
          required
        />
      )}
      <Field
        name="location"
        label="Local"
        value={event?.location ?? (kind === "VISIT" ? "" : "Matriz")}
        required
      />
      {kind === "VISIT" ? (
        <div className="wide">
          <p>
            Assistidos cadastra a pessoa; aqui você agenda sua visita de
            domingo. A distribuição de ministros acontece em Escalas.
          </p>
          {options.length ? (
            <label className="field">
              Assistido da visita
              <select
                name="assistedId"
                required
                value={assistedId}
                onChange={(e) => setAssistedId(e.target.value)}
              >
                <option value="">Selecione um assistido</option>
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <p role="status" className="notice">
                Nenhum assistido ativo disponível. Cadastre ou ative um
                assistido antes de agendar a visita.
              </p>
              <Link
                href="/assistidos?new=1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cadastrar assistido em outra aba
              </Link>
              <p className="muted">
                Após cadastrar na outra aba, use Atualizar assistidos; os dados
                deste formulário serão mantidos.
              </p>
              <input type="hidden" name="assistedId" value="" />
            </>
          )}
          <button
            type="button"
            className="secondary"
            disabled={loading}
            onClick={refresh}
          >
            {loading ? "Atualizando…" : "Atualizar assistidos"}
          </button>
          {message && <p role="alert">{message}</p>}
        </div>
      ) : (
        <>
          <input type="hidden" name="assistedId" value="" />
          <p className="muted">
            Celebrações não exigem assistido. Use Visita dominical para agendar
            atendimento.
          </p>
        </>
      )}
    </>
  );
}
