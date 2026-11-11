"use client";
import { useState } from "react";
import type { Minister } from "@/lib/domain";
export const locations = [
  "Matriz",
  "Carmelo Nossa Senhora do Carmo",
  "Capela Nossa Senhora Aparecida",
];
export function ServicePreferences({
  minister,
}: {
  minister?: Pick<
    Minister,
    "location" | "locationPreference" | "servicePreference"
  >;
}) {
  const [service, setService] = useState(minister?.servicePreference ?? "BOTH");
  const [location, setLocation] = useState(minister?.location ?? "Matriz");
  const [preference, setPreference] = useState(
    minister?.locationPreference ?? "ACCEPT",
  );
  return (
    <div className="wide">
      <h3>Onde deseja servir?</h3>
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
            <label className="field">
              Comunidade de preferência
              <select
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {!locations.includes(location) && (
                  <option value={location}>
                    {location} (preferência anterior — revise)
                  </option>
                )}
                {locations.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
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
                  Sim, mas prefiro a comunidade escolhida
                </option>
                <option value="EXCLUSIVE">
                  Não, somente a comunidade escolhida
                </option>
              </select>
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="location" value={location} />
            <input type="hidden" name="locationPreference" value={preference} />
          </>
        )}
      </div>
      <p role="status">
        {service === "VISITS"
          ? "Participa somente de visitas a assistidos."
          : `${preference === "EXCLUSIVE" ? "Serve somente em" : preference === "PREFER" ? "Prefere" : "Aceita todas as comunidades; referência:"} ${location}${preference === "PREFER" ? ", mas aceita outras comunidades" : ""}.`}
        {service === "BOTH" ? " Também participa de visitas a assistidos." : ""}
      </p>
      <p className="muted">
        A comunidade selecionada não limita o endereço das visitas. Impedimentos
        e conflitos de horário sempre são respeitados.
      </p>
    </div>
  );
}
