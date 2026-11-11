"use client";
import { useState } from "react";
import type { Absence } from "@/lib/domain";
import { Field } from "./fields";
export function AbsenceFields({
  absence,
  prefix = "",
  events,
}: {
  absence?: Absence;
  prefix?: string;
  events: { id: string; label: string }[];
}) {
  const [scope, setScope] = useState(absence?.scope ?? "DAY");
  const name = (s: string) => prefix + s;
  return (
    <>
      <label className="field">
        Abrangência
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
          <Field
            name={name("eventId")}
            label="Celebração"
            value={absence?.eventId}
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
      <div className="wide">
        <Field
          name={name("reason")}
          label="Motivo opcional"
          type="textarea"
          value={absence?.reason}
        />
      </div>
    </>
  );
}
export function AbsenceBatch({
  ministers,
  events,
}: {
  ministers: { id: string; name: string }[];
  events: { id: string; label: string }[];
}) {
  const [rows, setRows] = useState([0]);
  const [next, setNext] = useState(1);
  return (
    <div className="absence-batch wide">
      <Field
        name="ministerId"
        label="Ministro"
        required
        options={ministers.map((m) => [m.id, m.name] as const)}
      />
      <p>
        Inclua dias não consecutivos, períodos ou celebrações. O lote inteiro
        será validado antes de salvar; uma falha não grava parte dos
        impedimentos.
      </p>
      <p className="muted">
        Dias repetidos são deduplicados; períodos sobrepostos permanecem
        separados para preservar a informação.
      </p>
      {rows.map((id, index) => (
        <section className="panel absence-item" key={id}>
          <h3>Impedimento {index + 1}</h3>
          <input type="hidden" name="rows" value={id} />
          <div className="form-grid">
            <AbsenceFields prefix={`row.${id}.`} events={events} />
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
      <div className="absence-actions">
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
      </div>
    </div>
  );
}
