"use client";
import Link from "next/link";
import { useState } from "react";
import { eventClassOf } from "@/lib/event-agenda";
import {
  defaultLocations,
  locationKey,
  type Location,
} from "@/lib/location-rules";
import { sameVisitAddress, visitAssistedIds } from "@/lib/visit-group";
import type { Assisted, Event } from "@/lib/domain";
import { MultiDatePicker } from "./multi-date-picker";
import { Field } from "./fields";
export function EventFields({
  event,
  assisted,
  visit = false,
  initialMonth,
  catalog = defaultLocations,
}: {
  event?: Event;
  assisted: Assisted[];
  visit?: boolean;
  initialMonth?: string;
  catalog?: Location[];
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
  const [members, setMembers] = useState(
    event
      ? visitAssistedIds(event).filter((id) => id !== event.assistedId)
      : ([] as string[]),
  );
  const [groupRequired, setGroupRequired] = useState(
    event?.groupMinistersRequired ?? event?.required ?? 1,
  );
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
      setOptions([
        ...value,
        ...options.filter(
          (a) =>
            (a.id === assistedId || members.includes(a.id)) &&
            !value.some((p) => p.id === a.id),
        ),
      ]);
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
              readOnly={members.length === 0}
              min={1}
              max={100}
              onChange={(e) => setGroupRequired(Number(e.target.value))}
              value={
                members.length
                  ? groupRequired
                  : (options.find((a) => a.id === assistedId)
                      ?.ministersRequired ?? 1)
              }
            />
          </label>
          <p className="muted">
            Para visitas individuais, vale a quantidade do cadastro. Para
            grupos, defina uma única equipe; as quantidades não são somadas.
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
      {kind === "VISIT" ? (
        <Field
          name="location"
          label="Local da visita (restrito)"
          value={event?.kind === "VISIT" ? event.location : ""}
          required
        />
      ) : (
        <Field
          name="locationId"
          label="Local da celebração"
          value={
            event?.locationId ??
            catalog.find(
              (l) =>
                locationKey(l.name) ===
                locationKey(event?.location ?? "Matriz"),
            )?.id
          }
          options={catalog
            .filter((l) => l.active || l.id === event?.locationId)
            .map((l) => [
              l.id,
              l.name + (!l.active ? " (inativo; registro existente)" : ""),
            ])}
          required
        />
      )}
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
                onChange={(e) => {
                  setAssistedId(e.target.value);
                  setMembers([]);
                  setGroupRequired(
                    options.find((a) => a.id === e.target.value)
                      ?.ministersRequired ?? 1,
                  );
                }}
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
          {assistedId && (
            <fieldset>
              <legend>Agrupar assistidos do mesmo endereço nesta visita</legend>
              <p>Marque as pessoas que serão atendidas pela mesma equipe.</p>
              {options
                .filter(
                  (a) =>
                    a.id !== assistedId &&
                    (members.includes(a.id) ||
                      sameVisitAddress(
                        options.find((p) => p.id === assistedId)!,
                        a,
                      )),
                )
                .map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      name="assistedIds"
                      value={a.id}
                      checked={members.includes(a.id)}
                      onChange={(e) =>
                        setMembers((current) =>
                          e.target.checked
                            ? [...current, a.id]
                            : current.filter((id) => id !== a.id),
                        )
                      }
                    />{" "}
                    {a.name}
                  </label>
                ))}
              {members.length > 0 && (
                <input
                  type="hidden"
                  name="groupMinistersRequired"
                  value={groupRequired}
                />
              )}
            </fieldset>
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
