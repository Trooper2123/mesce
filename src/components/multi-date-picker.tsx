"use client";
import { useState } from "react";
export function MultiDatePicker({
  value,
  onChange,
  initialMonth,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const selected = new Set(value);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, number - 1, 1)));
  const dateLabel = (date: string) => date.split("-").reverse().join("/");
  function move(delta: number) {
    setMonth(
      new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7),
    );
  }
  function toggle(date: string) {
    const next = new Set(value);
    if (next.has(date)) next.delete(date);
    else if (next.size < 53) next.add(date);
    onChange([...next].sort());
  }
  return (
    <div className="multi-date-picker wide">
      <p>
        Selecione as datas no calendário. Você pode mudar o mês e manter as
        datas já selecionadas.
      </p>
      <div className="date-picker-toolbar">
        <button
          type="button"
          className="secondary"
          aria-label="Mês anterior"
          onClick={() => move(-1)}
        >
          Anterior
        </button>
        <label className="field">
          Mês para selecionar datas
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(e.target.value))
                setMonth(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="secondary"
          aria-label="Próximo mês"
          onClick={() => move(1)}
        >
          Próximo
        </button>
      </div>
      <div
        role="group"
        aria-label={`Datas de ${label}`}
        className="multi-date-grid"
      >
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`empty-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              key={date}
              type="button"
              aria-label={dateLabel(date)}
              aria-pressed={selected.has(date)}
              disabled={!selected.has(date) && value.length >= 53}
              onClick={() => toggle(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p role="status">
        {value.length} data(s) selecionada(s). Máximo de 53 por cadastro.
      </p>
      {!value.length && <p>Escolha ao menos uma data antes de salvar.</p>}
      <ul className="selected-event-dates">
        {value.map((date) => (
          <li key={date}>
            <input type="hidden" name="dates" value={date} />
            <span>{dateLabel(date)}</span>
            <button
              type="button"
              className="secondary"
              aria-label={`Remover ${dateLabel(date)}`}
              onClick={() => toggle(date)}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
