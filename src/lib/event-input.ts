import { eventSchema } from "./domain";
export function parseEventForm(form: FormData, id: string) {
  if (
    form.getAll("kind").length !== 1 ||
    form.get("kind") !== "event" ||
    form.getAll("eventKind").length !== 1
  )
    throw new Error("Tipo de atividade inválido. Reabra o formulário.");
  const raw = Object.fromEntries(form.entries());
  return eventSchema.parse({
    ...raw,
    id,
    kind: raw.eventKind,
    visitSite:
      raw.eventKind === "VISIT" ? (raw.visitSite ?? "HOME") : undefined,
    assistedId: raw.eventKind === "VISIT" ? raw.assistedId : "",
    duration: Number(raw.duration),
    required: Number(raw.required),
  });
}
