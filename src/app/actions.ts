"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actor, coordinator } from "@/lib/auth";
import { transaction, write, audit } from "@/lib/store";
import {
  ministerSchema,
  assistedSchema,
  eventSchema,
  absenceSchema,
  generate,
  validateSchedule,
  Minister,
  Schedule,
} from "@/lib/domain";
import { z } from "zod";
function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function month(form: FormData) {
  return z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .parse(value(form, "month"));
}
function message(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" • ");
  if (
    error instanceof Error &&
    (error.message.startsWith("NEXT_") || error.message === "NEXT_REDIRECT")
  )
    throw error;
  return error instanceof Error && !("code" in error)
    ? error.message
    : "Não foi possível salvar. Verifique a configuração e tente novamente.";
}
export async function save(form: FormData) {
  const user = await actor();
  const kind = value(form, "kind");
  const page =
    kind === "minister"
      ? "ministros"
      : kind === "assisted"
        ? "assistidos"
        : kind === "event"
          ? "celebracoes"
          : "impedimentos";
  try {
    if (kind !== "absence" && !user.coordinator)
      throw new Error("Acesso exclusivo da coordenação.");
    const raw = Object.fromEntries(form.entries());
    const id = value(form, "id") || crypto.randomUUID();
    const data = {
      ...raw,
      id,
      active: form.has("active"),
      away: form.has("away"),
      monthlyLimit: Number(raw.monthlyLimit),
      duration: Number(raw.duration),
      required: Number(raw.required),
    };
    await transaction(async (client, current) => {
      if (kind === "minister") {
        const minister = ministerSchema.parse(data);
        if (
          minister.email &&
          current.ministers.some(
            (m) =>
              m.id !== id &&
              m.email.toLowerCase() === minister.email.toLowerCase(),
          )
        )
          throw new Error("E-mail já cadastrado.");
        if (
          minister.spouseId &&
          !current.ministers.some((m) => m.id === minister.spouseId)
        )
          throw new Error("Cônjuge inexistente.");
        const spouse = current.ministers.find(
          (m) => m.id === minister.spouseId,
        );
        if (spouse?.spouseId && spouse.spouseId !== id)
          throw new Error("Cônjuge já vinculado a outro ministro.");
        const previous = current.ministers.find((m) => m.id === id);
        if (previous?.spouseId && previous.spouseId !== minister.spouseId) {
          const old = current.ministers.find((m) => m.id === previous.spouseId);
          if (old)
            await write(client, "minister", {
              ...old,
              spouseId: "",
              couplePreference: "NONE",
            } as Minister);
        }
        if (spouse)
          await write(client, "minister", {
            ...spouse,
            spouseId: id,
            couplePreference: minister.couplePreference,
          } as Minister);
        await write(client, "minister", minister);
      } else if (kind === "assisted")
        await write(client, "assisted", assistedSchema.parse(data));
      else if (kind === "event") {
        const event = eventSchema.parse(data);
        if (
          event.kind === "VISIT" &&
          !current.assisted.some((a) => a.id === event.assistedId && a.active)
        )
          throw new Error("Selecione um assistido ativo.");
        if (
          current.events.some(
            (e) =>
              e.id !== id &&
              e.date === event.date &&
              e.time === event.time &&
              e.location === event.location &&
              e.assistedId === event.assistedId,
          )
        )
          throw new Error("Já existe um evento neste horário e local.");
        const occurrences = z.coerce
          .number()
          .int()
          .min(1)
          .max(53)
          .parse(form.get("occurrences") ?? 1);
        if (current.events.some((e) => e.id === id) && occurrences !== 1)
          throw new Error(
            "Edite apenas esta ocorrência; recorrência é criada no cadastro inicial.",
          );
        for (let index = 0; index < occurrences; index++) {
          const date = new Date(event.date + "T12:00:00Z");
          date.setUTCDate(date.getUTCDate() + index * 7);
          const occurrence = {
            ...event,
            id: index === 0 ? id : crypto.randomUUID(),
            date: date.toISOString().slice(0, 10),
          };
          if (
            current.events.some(
              (e) =>
                e.id !== occurrence.id &&
                e.date === occurrence.date &&
                e.time === occurrence.time &&
                e.location === occurrence.location &&
                e.assistedId === occurrence.assistedId,
            )
          )
            continue;
          await write(client, "event", occurrence);
        }
      } else if (kind === "absence") {
        const absence = absenceSchema.parse(data);
        const minister = current.ministers.find(
          (m) => m.id === absence.ministerId,
        );
        if (
          !minister ||
          (!user.coordinator &&
            (!user.verified || minister.email.toLowerCase() !== user.email))
        )
          throw new Error("Você só pode informar seus impedimentos.");
        if (
          absence.scope === "CELEBRATION" &&
          !current.events.some((e) => e.id === absence.eventId)
        )
          throw new Error("Celebração inexistente.");
        const previous = current.absences.find((a) => a.id === id);
        if (
          previous &&
          !user.coordinator &&
          previous.ministerId !== minister.id
        )
          throw new Error("Impedimento de outro ministro.");
        if (!user.coordinator) {
          const now = new Date();
          const local = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now);
          const parts = local.split("-").map(Number);
          const next = new Date(Date.UTC(parts[0], parts[1], 1))
            .toISOString()
            .slice(0, 7);
          const date =
            absence.scope === "CELEBRATION"
              ? current.events.find((e) => e.id === absence.eventId)!.date
              : absence.start;
          if (
            parts[2] > 25 ||
            !date.startsWith(next) ||
            (absence.scope !== "CELEBRATION" && !absence.end.startsWith(next))
          )
            throw new Error(
              "Informe impedimentos do próximo mês até o dia 25. Fora do prazo, procure a coordenação.",
            );
        }
        if (
          current.absences.some(
            (a) =>
              a.id !== id &&
              a.ministerId === absence.ministerId &&
              a.scope === absence.scope &&
              a.start === absence.start &&
              a.end === absence.end &&
              a.eventId === absence.eventId,
          )
        )
          throw new Error("Impedimento já informado.");
        await write(client, "absence", absence);
      } else throw new Error("Cadastro inválido.");
      await audit(client, user.id, `save:${kind}`, id);
    });
  } catch (error) {
    redirect(`/${page}?error=${encodeURIComponent(message(error))}`);
  }
  revalidatePath("/", "layout");
  redirect(`/${page}?saved=1`);
}
export async function scheduleAction(form: FormData) {
  const user = await coordinator();
  let selected = "";
  try {
    selected = month(form);
    const operation = value(form, "operation");
    await transaction(async (client, data) => {
      const existing = data.schedules
        .filter((s) => s.month === selected)
        .sort((a, b) => b.revision - a.revision)[0];
      if (operation === "generate") {
        if (existing?.status === "DRAFT")
          throw new Error(
            "Já existe um rascunho. Revise ou aprove antes de gerar uma nova revisão.",
          );
        if (!data.events.some((e) => e.date.startsWith(selected)))
          throw new Error("Cadastre os eventos do mês antes de gerar.");
        const schedule = generate(data, selected);
        schedule.revision = (existing?.revision ?? 0) + 1;
        await write(client, "schedule", schedule);
        await audit(client, user.id, "schedule:generate", schedule.id);
        return;
      }
      if (!existing) throw new Error("Gere a escala primeiro.");
      if (
        value(form, "scheduleId") !== existing.id ||
        Number(value(form, "editVersion")) !== (existing.editVersion ?? 1)
      )
        throw new Error("A escala foi atualizada. Recarregue a página.");
      let updated: Schedule = { ...existing };
      if (operation === "assign" || operation === "capacity") {
        if (existing.status !== "DRAFT")
          throw new Error("Abra uma nova revisão para ajustar esta escala.");
        const reason = value(form, "reason");
        if (reason.length < 3) throw new Error("Informe uma justificativa.");
        const eventId = value(form, "eventId");
        if (!updated.events.some((e) => e.id === eventId))
          throw new Error("Evento inexistente.");
        if (operation === "capacity") {
          const required = z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .parse(form.get("required"));
          updated = {
            ...updated,
            events: updated.events.map((e) =>
              e.id === eventId ? { ...e, required } : e,
            ),
          };
        } else {
          const ministerId = z.string().uuid().parse(form.get("ministerId"));
          const assignments = updated.assignments.filter(
            (a) => !(a.eventId === eventId && a.ministerId === ministerId),
          );
          if (value(form, "mode") !== "remove")
            assignments.push({ eventId, ministerId });
          updated = { ...updated, assignments };
        }
        updated.warnings = validateSchedule(updated, data);
      } else if (operation === "approve") {
        if (existing.status !== "DRAFT")
          throw new Error("Apenas rascunhos podem ser aprovados.");
        const errors = validateSchedule(existing, data);
        if (errors.length) throw new Error(errors.join(" • "));
        updated = {
          ...existing,
          status: "APPROVED",
          warnings: [],
          approvedBy: user.id,
          approvedAt: new Date().toISOString(),
        };
      } else if (operation === "publish") {
        if (existing.status !== "APPROVED")
          throw new Error("Aprove a escala primeiro.");
        updated.status = "PUBLISHED";
      } else throw new Error("Operação inválida.");
      updated.editVersion = (existing.editVersion ?? 1) + 1;
      await write(client, "schedule", updated);
      await audit(
        client,
        user.id,
        `schedule:${operation}`,
        updated.id,
        operation === "assign" || operation === "capacity"
          ? {
              reason: value(form, "reason"),
              eventId: value(form, "eventId"),
              ministerId: value(form, "ministerId"),
              before: existing,
              after: updated,
            }
          : undefined,
      );
    });
  } catch (error) {
    redirect(
      `/escalas?month=${selected}&error=${encodeURIComponent(message(error))}`,
    );
  }
  revalidatePath("/", "layout");
  redirect(`/escalas?month=${selected}&saved=1`);
}
