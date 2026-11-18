"use client";
import { useState } from "react";
import type { LocationAddress } from "@/lib/location-rules";

export function LocationAddressFields({
  address,
}: {
  address?: LocationAddress;
}) {
  const [value, setValue] = useState(
    address ?? {
      postalCode: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
    },
  );
  const [message, setMessage] = useState("");
  async function lookup() {
    setMessage("Consultando CEP…");
    const response = await fetch(
      `/api/cep?cep=${encodeURIComponent(value.postalCode)}`,
    );
    const result = await response.json();
    if (!response.ok)
      return setMessage(
        result.error ?? "Serviço de CEP indisponível. Preencha manualmente.",
      );
    setValue((current) => ({
      ...current,
      ...result,
      number: current.number,
      complement: current.complement,
    }));
    setMessage("Endereço sugerido. Confira todos os campos antes de salvar.");
  }
  const update = (key: keyof LocationAddress, next: string) =>
    setValue((current) => ({ ...current, [key]: next }));
  const field = (
    name: keyof LocationAddress,
    label: string,
    required = false,
    maxLength = 160,
  ) => (
    <label className="field">
      <span>
        {label}{" "}
        <span className="field-requirement">
          {required ? "(obrigatório)" : "(opcional)"}
        </span>
      </span>
      <input
        name={name}
        value={String(value[name] ?? "")}
        required={required}
        maxLength={maxLength}
        onChange={(event) => update(name, event.target.value)}
      />
    </label>
  );
  return (
    <div className="form-grid">
      {field("postalCode", "CEP", true, 9)}
      <button type="button" className="secondary" onClick={lookup}>
        Buscar CEP
      </button>
      {message && (
        <p role="status" className="wide">
          {message}
        </p>
      )}
      {field("street", "Logradouro", true)}
      {field("number", "Número", true, 30)}
      {field("complement", "Complemento")}
      {field("neighborhood", "Bairro", true, 100)}
      {field("city", "Cidade", true, 100)}
      {field("state", "UF", true, 2)}
      <input type="hidden" name="latitude" value={value.latitude ?? ""} />
      <input type="hidden" name="longitude" value={value.longitude ?? ""} />
      <input type="hidden" name="geocodedAt" value={value.geocodedAt ?? ""} />
    </div>
  );
}
