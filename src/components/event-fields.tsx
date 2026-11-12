"use client";
import Link from "next/link";
import { useState } from "react";
import { eventClassOf } from "@/lib/event-agenda";
import type { Event } from "@/lib/domain";
import { MultiDatePicker } from "./multi-date-picker";
import { Field } from "./fields";
export function EventFields({
  event,
  assisted,
  visit = false,
  initialMonth,
}: {
  event?: Event;
  assisted: { id: string; name: string; ministersRequired: number }[];
  visit?: boolean;
  initialMonth?: string;
}) {
  const [dateMode, setDateMode] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [dates, setDates] = useState<string[]>([]);
  const pickerMonth =
    initialMonth ??
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
  const [kind, setKind] = useState(event?.kind ?? (visit ? "VISIT" : "MASS"));
  const [category, setCategory] = useState<"FIXED" | "EXTRAORDINARY">(
    event ? eventClassOf(event) : visit ? "EXTRAORDINARY" : "FIXED",
  );
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
          onChange={(e) => {
            const value = e.target.value as Event["kind"];
            setKind(value);
            setCategory(
              ["MASS", "ADORATION"].includes(value) ? "FIXED" : "EXTRAORDINARY",
            );
          }}
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
          <input type="hidden" name="eventClass" value="EXTRAORDINARY" />
          <p className="notice">
            Cada visita é um evento extraordinário na data selecionada.
          </p>
        </>
      ) : (
        <label className="field">
          Organização do evento
          <select
            name="eventClass"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="FIXED">Fixo recorrente</option>
            <option value="EXTRAORDINARY">Extraordinário</option>
          </select>
        </label>
      )}
      {!event ? (
        <label className="field">
          Escolher datas
          <select
            name="dateMode"
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value as typeof dateMode)}
          >
            <option value="SINGLE">Uma data / repetição semanal</option>
            <option value="MULTIPLE">
              Selecionar várias datas no calendário
            </option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="dateMode" value="SINGLE" />
      )}
      {dateMode === "MULTIPLE" && !event ? (
        <>
          <input type="hidden" name="date" value={dates[0] ?? ""} />
          <MultiDatePicker
            value={dates}
            onChange={setDates}
            initialMonth={pickerMonth}
          />
          <p className="muted">
            O horário, local e demais dados serão aplicados a todas as datas
            selecionadas.
          </p>
        </>
      ) : (
        <Field
          name="date"
          label="Data (visitas somente aos domingos)"
          type="date"
          value={event?.date}
          required
        />
      )}
      {!event &&
      dateMode === "SINGLE" &&
      kind !== "VISIT" &&
      category === "FIXED" ? (
        <>
          <Field
            key="weekly"
            name="occurrences"
            label="Repetir semanalmente (número de ocorrências)"
            type="number"
            value={12}
            required
          />
          <p className="muted">
            Cadastre de 1 a 53 semanas. Cada encontro mantém sua data e horário;
            o nome pode ser repetido.
          </p>
        </>
      ) : (
        <input type="hidden" name="occurrences" value="1" />
      )}
      {event && (
        <p className="muted">
          A alteração vale apenas para esta ocorrência. As outras datas da série
          são preservadas.
        </p>
      )}
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
