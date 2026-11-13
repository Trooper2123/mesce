import { z } from "zod";
import { type Event } from "./domain";
/** Materialized occurrences have independent IDs; editing one never re-anchors a series. */
export function weeklyOccurrences(
  event: Event,
  count: number,
  existing: Event[],
): Event[] {
  z.number().int().min(1).max(53).parse(count);
  if (existing.some((e) => e.id === event.id) && count !== 1)
    throw new Error(
      "Edite apenas esta ocorrência; recorrência é criada no cadastro inicial.",
    );
  if (event.eventClass === "EXTRAORDINARY" && count !== 1)
    throw new Error(
      "Eventos extraordinários são cadastrados por ocorrência. Para repetição semanal, escolha Fixo recorrente.",
    );
  const seriesId = event.seriesId ?? (count > 1 ? event.id : undefined);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(event.date + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + index * 7);
    return {
      ...event,
      seriesId,
      id: index === 0 ? event.id : crypto.randomUUID(),
      date: date.toISOString().slice(0, 10),
    };
  });
}
