"use client";
import { useState } from "react";
import type { Absence } from "@/lib/domain";
import { Field } from "./fields";
export function AbsenceFields({
  absence,
  prefix = "",
  events,
  initialEventId,
}: {
  absence?: Absence;
  prefix?: string;
  events: { id: string; label: string }[];
  initialEventId?: string;
}) {
  const [scope, setScope] = useState(
    absence?.scope ?? (initialEventId ? "CELEBRATION" : "DAY"),
  );
  const name = (s: string) => prefix + s;
  return (
    <>
      <label className="field">
        Quando você não poderá servir?
        <select
          name={name("scope")}
          value={scope}
          onChange={(e) => setScope(e.target.value as Absence["scope"])}
        >
          <option value="DAY">Dia inteiro</option>
          <option value="PERIOD">Período de datas</option>
          <option value="CELEBRATION">Celebração específica</option>
        </select>
      </label>
      {scope === "CELEBRATION" ? (
        <>
          <p className="muted">
            Selecione uma celebração do próximo mês, cuja escala será preparada.
          </p>
          {events.length === 0 && (
            <p role="status">
              Nenhuma celebração cadastrada para o próximo mês.
            </p>
          )}
          <Field
            name={name("eventId")}
            label="Celebração"
            value={absence?.eventId ?? initialEventId}
            required
            options={[
              ["", "Selecione"],
              ...events.map((e) => [e.id, e.label] as const),
            ]}
          />
          <input type="hidden" name={name("start")} value="" />
          <input type="hidden" name={name("end")} value="" />
        </>
      ) : (
        <>
          <Field
            name={name("start")}
            label={
              scope === "DAY" ? "Dia indisponível" : "Primeiro dia (inclusive)"
            }
            type="date"
            required
            value={absence?.start}
          />
          {scope === "PERIOD" && (
            <Field
              name={name("end")}
              label="Último dia (inclusive)"
              type="date"
              required
              value={absence?.end}
            />
          )}
          <input type="hidden" name={name("eventId")} value="" />
        </>
      )}
      <Field
        name={name("reason")}
        label="Motivo"
        type="textarea"
        value={absence?.reason}
      />
    </>
  );
}
export function AbsenceBatch({
  ministers,
  events,
  initialEventId,
}: {
  ministers: { id: string; name: string }[];
  events: { id: string; label: string }[];
  initialEventId?: string;
}) {
  const [rows, setRows] = useState([0]);
  const [next, setNext] = useState(1);
  return (
    <>
      <Field
        name="ministerId"
        label="Ministro"
        required
        options={ministers.map((m) => [m.id, m.name] as const)}
      />
      <p>
        Inclua dias não consecutivos, períodos ou celebrações. Se algum item
        precisar de correção, nenhum impedimento desta lista será salvo.
      </p>
      <p className="muted">
        Datas repetidas contam uma vez. Períodos sobrepostos continuam separados
        para preservar a informação informada.
      </p>
      {rows.map((id, index) => (
        <section className="panel" key={id}>
          <h3>Impedimento {index + 1}</h3>
          <input type="hidden" name="rows" value={id} />
          <div className="form-grid">
            <AbsenceFields
              prefix={`row.${id}.`}
              events={events}
              initialEventId={index === 0 ? initialEventId : undefined}
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setRows(rows.filter((x) => x !== id))}
            >
              Remover este item
            </button>
          )}
        </section>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={rows.length >= 100}
        onClick={() => {
          setRows([...rows, next]);
          setNext(next + 1);
        }}
      >
        Adicionar outro impedimento
      </button>
      <p role="status">{rows.length} impedimento(s) para validar e salvar.</p>
      <button>Salvar todos os impedimentos</button>
    </>
  );
}
