import { createHash } from "node:crypto";
import { z } from "zod";
import type { Data, Minister, Event } from "./domain";
import { defaultLocations, locationKey, type Location } from "./location-rules";
export function locationCatalog(data: Data): Location[] {
  const catalog = (data.settings?.locations ?? defaultLocations).map((l) => ({
    ...l,
  }));
  for (const name of [
    ...data.ministers
      .filter((m) => !m.locationIds?.length)
      .map((m) => m.location),
    ...data.events.filter((e) => e.kind !== "VISIT").map((e) => e.location),
  ]) {
    const label = name.trim().replace(/\s+/g, " ");
    if (
      !label ||
      catalog.some((l) => locationKey(l.name) === locationKey(label))
    )
      continue;
    const hex = createHash("sha256")
      .update("mesce:location:" + locationKey(label))
      .digest("hex");
    catalog.push({
      id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
      name: label,
      active: true,
    });
  }
  return catalog.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export function ministerLocations(
  form: FormData,
  previous: Minister | undefined,
  data: Data,
) {
  if (!form.has("locationsSubmitted")) {
    if (previous)
      return { location: previous.location, locationIds: previous.locationIds };
    const local = locationCatalog(data).find(
      (l) =>
        l.active &&
        locationKey(l.name) ===
          locationKey(String(form.get("location") ?? "Matriz")),
    );
    if (!local) throw new Error("Selecione uma comunidade do catálogo.");
    return { location: local.name, locationIds: [local.id] };
  }
  const ids = z
    .array(z.string().uuid())
    .max(100)
    .parse([...new Set(form.getAll("locationIds").map(String))]);
  const catalog = locationCatalog(data);
  for (const id of ids) {
    const entry = catalog.find((l) => l.id === id);
    if (!entry || (!entry.active && !previous?.locationIds?.includes(id)))
      throw new Error("Selecione comunidades ativas do catálogo.");
  }
  if (
    form.get("servicePreference") !== "VISITS" &&
    form.get("locationPreference") !== "ACCEPT" &&
    !ids.length
  )
    throw new Error("Escolha ao menos uma comunidade para a preferência.");
  return {
    location: ids
      .map((id) => catalog.find((l) => l.id === id)!.name)
      .join("; "),
    locationIds: ids,
  };
}
export function eventLocation(
  form: FormData,
  previous: Event | undefined,
  data: Data,
) {
  if (form.get("eventKind") === "VISIT") return { locationId: undefined };
  if (!form.has("locationId")) {
    const entry = locationCatalog(data).find(
      (l) =>
        locationKey(l.name) ===
        locationKey(String(form.get("location") ?? previous?.location ?? "")),
    );
    if (!entry || (!entry.active && previous?.locationId !== entry.id))
      throw new Error("Selecione um local ativo do catálogo.");
    return { locationId: entry.id, location: entry.name };
  }
  const id = z.string().uuid().parse(form.get("locationId"));
  const entry = locationCatalog(data).find((l) => l.id === id);
  if (!entry || (!entry.active && previous?.locationId !== id))
    throw new Error("Selecione um local ativo do catálogo.");
  return { locationId: id, location: entry.name };
}
export function planLocationChange(form: FormData, data: Data) {
  const catalog = locationCatalog(data);
  const supplied = String(form.get("id") ?? "");
  const previous = supplied
    ? catalog.find((l) => l.id === supplied)
    : undefined;
  if (supplied && !previous) throw new Error("Local inexistente.");
  const name = z
    .string()
    .trim()
    .min(2)
    .max(120)
    .parse(form.get("name"))
    .replace(/\s+/g, " ");
  if (
    catalog.some(
      (l) => l.id !== previous?.id && locationKey(l.name) === locationKey(name),
    )
  )
    throw new Error("Já existe um local com esse nome.");
  if (previous && form.get("expectedName") !== previous.name)
    throw new Error("Local alterado; recarregue o catálogo.");
  const updated = {
    id: previous?.id ?? crypto.randomUUID(),
    name,
    active: form.get("active") === "on",
  };
  return {
    before: previous,
    after: updated,
    catalog: [...catalog.filter((l) => l.id !== updated.id), updated],
  };
}

/** Bind legacy current records by exact normalized name; snapshots are never touched. */
export function bindLocationRecords(data: Data, catalog: Location[]) {
  const before = locationCatalog(data);
  return {
    events: data.events.map((e) => {
      if (e.kind === "VISIT") return e;
      const id =
        e.locationId ??
        before.find((l) => locationKey(l.name) === locationKey(e.location))?.id;
      const local = catalog.find((l) => l.id === id);
      return local ? { ...e, locationId: id, location: local.name } : e;
    }),
    ministers: data.ministers.map((m) => {
      const ids =
        m.locationIds ??
        before
          .filter((l) => locationKey(l.name) === locationKey(m.location))
          .map((l) => l.id);
      return ids.length
        ? {
            ...m,
            locationIds: ids,
            location: ids
              .map((id) => catalog.find((l) => l.id === id)?.name)
              .filter(Boolean)
              .join("; "),
          }
        : m;
    }),
  };
}
