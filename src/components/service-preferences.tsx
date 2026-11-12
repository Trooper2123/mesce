"use client";
import { useState } from "react";
import type { Minister } from "@/lib/domain";
import {
  defaultLocations,
  locationKey,
  type Location,
} from "@/lib/location-rules";
export const locations = defaultLocations.map((l) => l.name);
export function ServicePreferences({
  minister,
  catalog = defaultLocations,
}: {
  minister?: Pick<
    Minister,
    "location" | "locationIds" | "locationPreference" | "servicePreference"
  >;
  catalog?: Location[];
}) {
  const [service, setService] = useState(minister?.servicePreference ?? "BOTH");
  const [ids, setIds] = useState(
    minister?.locationIds ??
      catalog
        .filter(
          (l) =>
            locationKey(l.name) === locationKey(minister?.location ?? "Matriz"),
        )
        .map((l) => l.id),
  );
  const [preference, setPreference] = useState(
    minister?.locationPreference ?? "ACCEPT",
  );
  const selected = ids.map(
    (id) => catalog.find((l) => l.id === id)?.name ?? "Local anterior",
  );
  return (
    <div className="wide">
      <h3>Onde deseja servir?</h3>
      <input type="hidden" name="locationsSubmitted" value="1" />
      <input type="hidden" name="location" value={selected.join("; ")} />
      <div className="form-grid">
        <label className="field">
          Atividades de preferência
          <select
            name="servicePreference"
            value={service}
            onChange={(e) => setService(e.target.value as typeof service)}
          >
            <option value="BOTH">Celebrações e visita a assistidos</option>
            <option value="CELEBRATIONS">Somente celebrações</option>
            <option value="VISITS">Visita a assistidos</option>
          </select>
        </label>
        {service !== "VISITS" ? (
          <>
            <fieldset className="wide">
              <legend>Comunidades de preferência — escolha uma ou mais</legend>
              {catalog
                .filter((l) => l.active || ids.includes(l.id))
                .map((l) => (
                  <label className="check" key={l.id}>
                    <input
                      type="checkbox"
                      name="locationIds"
                      value={l.id}
                      checked={ids.includes(l.id)}
                      onChange={(e) =>
                        setIds((old) =>
                          e.target.checked
                            ? [...old, l.id]
                            : old.filter((id) => id !== l.id),
                        )
                      }
                    />
                    {l.name}
                    {!l.active ? " (inativo; mantido do cadastro)" : ""}
                  </label>
                ))}
            </fieldset>
            <label className="field">
              Pode servir em outras comunidades?
              <select
                name="locationPreference"
                value={preference}
                onChange={(e) =>
                  setPreference(e.target.value as typeof preference)
                }
              >
                <option value="ACCEPT">
                  Sim, sem preferência de comunidade
                </option>
                <option value="PREFER">
                  Sim, mas prefiro as comunidades escolhidas
                </option>
                <option value="EXCLUSIVE">
                  Não, somente as comunidades escolhidas
                </option>
              </select>
            </label>
          </>
        ) : (
          <>
            {ids.map((id) => (
              <input key={id} type="hidden" name="locationIds" value={id} />
            ))}
            <input type="hidden" name="locationPreference" value={preference} />
          </>
        )}
      </div>
      <p role="status">
        {service === "VISITS"
          ? "Participa somente de visitas a assistidos."
          : preference === "ACCEPT"
            ? "Aceita todas as comunidades."
            : `${preference === "EXCLUSIVE" ? "Serve somente em" : "Prefere"} ${selected.join(", ") || "nenhuma comunidade selecionada"}${preference === "PREFER" ? ", mas aceita outras comunidades" : ""}.`}
        {service === "BOTH" ? " Também participa de visitas a assistidos." : ""}
      </p>
      <p className="muted">
        A comunidade selecionada não limita o endereço das visitas. Impedimentos
        e conflitos de horário sempre são respeitados.
      </p>
    </div>
  );
}
