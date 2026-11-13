"use client";
import { useState } from "react";
export function EventScopeFields({
  series,
  candidates,
}: {
  series: boolean;
  candidates: { id: string; date: string; time: string; title: string }[];
}) {
  const [scope, setScope] = useState("ONE");
  return (
    <>
      <label className="field">
        Aplicar a
        <select
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="ONE">Somente esta ocorrência</option>
          {series && (
            <option value="FOLLOWING">Esta e as próximas da série</option>
          )}
        </select>
      </label>
      {series && (
        <fieldset
          disabled={scope !== "FOLLOWING"}
          hidden={scope !== "FOLLOWING"}
        >
          <legend>Manter estas ocorrências sem alteração</legend>
          {candidates.map((e) => (
            <label className="check" key={e.id}>
              <input type="checkbox" name="exclude" value={e.id} />
              {e.date} · {e.time} · {e.title}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}
