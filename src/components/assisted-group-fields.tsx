"use client";

import { useMemo, useState } from "react";

const CREATE_GROUP = "__create_group__";

export function AssistedGroupFields({
  checked,
  currentGroup,
  groups,
}: {
  checked: boolean;
  currentGroup?: string;
  groups: string[];
}) {
  const availableGroups = useMemo(() => {
    const values = new Set(groups.map((group) => group.trim()).filter(Boolean));
    if (currentGroup?.trim()) values.add(currentGroup.trim());
    return [...values].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }, [currentGroup, groups]);
  const [enabled, setEnabled] = useState(checked);
  const [selection, setSelection] = useState(
    currentGroup?.trim() ? `group:${currentGroup}` : "",
  );

  return (
    <div className="assisted-group-fields wide">
      <label className="field check">
        <input
          type="checkbox"
          name="groupVisit"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.currentTarget.checked);
            if (event.currentTarget.checked && !selection)
              setSelection(availableGroups.length ? "" : CREATE_GROUP);
          }}
        />
        Este assistido pertence a um grupo de visita
      </label>
      {enabled && (
        <div className="assisted-group-options">
          <label className="field">
            Grupo de visita
            <select
              value={selection}
              onChange={(event) => setSelection(event.currentTarget.value)}
              required
            >
              <option value="">Selecione um grupo</option>
              {availableGroups.map((group) => (
                <option key={group} value={`group:${group}`}>
                  Vincular ao grupo {group}
                </option>
              ))}
              <option value={CREATE_GROUP}>Criar um novo grupo</option>
            </select>
          </label>
          {selection === CREATE_GROUP ? (
            <label className="field">
              Nome do novo grupo
              <input
                type="text"
                name="groupName"
                minLength={2}
                maxLength={120}
                required
                autoComplete="off"
                placeholder="Ex.: Visita Altevita"
              />
            </label>
          ) : selection.startsWith("group:") ? (
            <input
              type="hidden"
              name="groupName"
              value={selection.slice("group:".length)}
            />
          ) : null}
          <p className="muted">
            Os assistidos com o mesmo grupo ficarão identificados juntos na
            organização das visitas.
          </p>
        </div>
      )}
    </div>
  );
}
