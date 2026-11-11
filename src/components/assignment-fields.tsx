"use client";
import { useState } from "react";
import { Field } from "./fields";
export function AssignmentFields({
  ministers,
  assignedIds,
}: {
  ministers: { id: string; name: string }[];
  assignedIds: string[];
}) {
  const [mode, setMode] = useState("add");
  const options = ministers.filter(
    (m) => assignedIds.includes(m.id) === (mode === "remove"),
  );
  return (
    <>
      <label className="field">
        Ação
        <select
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="add">Adicionar</option>
          <option value="remove">Retirar</option>
        </select>
      </label>
      <Field
        key={mode}
        name="ministerId"
        label="Ministro"
        required
        options={[
          ["", "Selecione um ministro"],
          ...options.map((m) => [m.id, m.name] as const),
        ]}
      />
      {!options.length && (
        <p role="status">
          {mode === "remove"
            ? "Não há ministros designados para retirar."
            : "Todos os ministros disponíveis nesta lista já estão designados. Revise os cadastros e a equipe."}
        </p>
      )}
    </>
  );
}
