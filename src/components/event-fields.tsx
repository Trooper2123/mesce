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
  assisted: { id: string; name: string }[];
  visit?: boolean;
}) {
  const [kind, setKind] = useState(event?.kind ?? (visit ? "VISIT" : "MASS"));
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
        <div className="wide">
          <p>
            Assistidos cadastra a pessoa; aqui você agenda sua visita de
            domingo. A distribuição de ministros acontece em Escalas.
          </p>
          {options.length ? (
            <Field
              name="assistedId"
              label="Assistido da visita"
              value={event?.assistedId}
              required
              options={[
                ["", "Selecione um assistido"],
                ...options.map((a) => [a.id, a.name] as const),
              ]}
            />
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
