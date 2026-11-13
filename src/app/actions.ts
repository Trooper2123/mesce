"use server";
import { calendarReturn } from "@/lib/calendar-navigation";
import { visitAssistedIds } from "@/lib/visit-group";
import { ministerLocations, eventLocation } from "@/lib/locations";
import { eventChangeNotice } from "@/lib/operational-changes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actor, coordinator, assertCurrentActor } from "@/lib/auth";
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
  syncSchedule,
  blocked,
} from "@/lib/domain";
import { z } from "zod";
import { ministerDisplayName } from "@/lib/minister-name";
import { planEventSave } from "@/lib/event-agenda";
import { requireCompleteMinister } from "@/lib/profile";
import { emailHash } from "@/lib/registration";
import {
  parseAbsenceBatch,
  validateAbsenceSubmission,
} from "@/lib/absence-input";
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
  let eventMonth = "";
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
    let id = value(form, "id") || crypto.randomUUID();
    const data = {
      ...raw,
      id,
      active: form.has("active"),
      monthlyLimit: value(form, "monthlyLimit")
        ? Number(raw.monthlyLimit)
        : null,
      kind: kind === "event" ? value(form, "eventKind") : kind,
      assistedId:
        kind === "event" && value(form, "eventKind") !== "VISIT"
          ? ""
          : raw.assistedId,
      duration: Number(raw.duration),
      required: Number(raw.required),
    };
    await transaction(async (client, current) => {
      const currentUser = await assertCurrentActor(
        client,
        user,
        kind !== "absence",
      );
      if (kind === "minister") {
        if (!value(form, "id") && value(form, "email")) {
          const reserved = await client.query(
            "SELECT minister_id FROM mesce_access WHERE email_hmac=$1",
            [emailHash(value(form, "email"))],
          );
          if (reserved.rows[0]) {
            if (
              current.ministers.some(
                (m) => m.id === reserved.rows[0].minister_id,
              )
            )
              throw new Error(
                "E-mail já cadastrado. Edite o cadastro existente.",
              );
            id = reserved.rows[0].minister_id;
            data.id = id;
          }
        }
        const existingMinister = current.ministers.find((m) => m.id === id);
        const status = z
          .enum(["ACTIVE", "FORMER"])
          .parse(value(form, "participationStatus"));
        const parsed = ministerSchema.parse({
          ...data,
          active: status === "ACTIVE",
          former: status === "FORMER",
          preferredName: form.has("preferredName")
            ? value(form, "preferredName")
            : (existingMinister?.preferredName ?? ""),
          active: status
            ? status === "ACTIVE" || status === "AWAY"
            : data.active,
          away: status ? status === "AWAY" : data.away,
          former: status
            ? status === "FORMER"
            : (existingMinister?.former ?? false),
          monthlyLimit: form.has("monthlyLimit")
            ? data.monthlyLimit
            : (existingMinister?.monthlyLimit ?? null),
          ...ministerLocations(form, existingMinister, current),
          registrationStatus:
            value(form, "registrationStatus") === "DRAFT"
              ? "DRAFT"
              : "COMPLETE",
        });
        const minister =
          parsed.registrationStatus === "DRAFT"
            ? parsed
            : requireCompleteMinister(parsed);
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
        await write(
          client,
          "assisted",
          assistedSchema.parse({
            ...data,
            ministersRequired: Number(form.get("ministersRequired")),
          }),
        );
      else if (kind === "event") {
        const local = eventLocation(
          form,
          current.events.find((e) => e.id === id),
          current,
        );
        const additionalDates = String(form.get("additionalDates") ?? "")
          .split(/[\s,;]+/)
          .map((date) => date.trim())
          .filter(Boolean);
        const permanent = form.has("permanent");
        if (permanent && additionalDates.length)
          throw new Error(
            "Use datas adicionais ou evento permanente, não os dois juntos.",
          );
        const dates = permanent
          ? Array.from({ length: 53 }, (_, index) => {
              const date = new Date(event.date + "T12:00:00Z");
              date.setUTCDate(date.getUTCDate() + index * 7);
              return date.toISOString().slice(0, 10);
            })
          : [...new Set([event.date, ...additionalDates])];
        if (dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)))
          throw new Error("Informe as datas adicionais no formato AAAA-MM-DD.");
        requireFuture(event);
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
        if (current.events.some((e) => e.id === id) && dates.length !== 1)
          throw new Error(
            "Edite apenas esta ocorrência; cadastre novas datas separadamente.",
          );
        for (let index = 0; index < dates.length; index++) {
          const occurrence = {
            ...event,
            id: index === 0 ? id : crypto.randomUUID(),
            date: dates[index],
          };
          eventSchema.parse(occurrence);
          requireFuture(occurrence);
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
        if (local.location) form.set("location", local.location);
        const occurrences = planEventSave(form, id, current).map((e) => ({
          ...e,
          locationId: local.locationId,
        }));
        eventMonth = occurrences[0]?.date.slice(0, 7) ?? "";
        for (const occurrence of occurrences) {
          const previous = current.events.find((e) => e.id === occurrence.id);
          const changed =
            previous &&
            [
              "date",
              "time",
              "duration",
              "location",
              "assistedId",
              "assistedIds",
              "groupMinistersRequired",
            ].some(
              (key) =>
                JSON.stringify(previous[key as keyof typeof previous]) !==
                JSON.stringify(occurrence[key as keyof typeof occurrence]),
            );
          const saved = changed
            ? eventChangeNotice(previous, occurrence, current)
            : occurrence;
          await write(client, "event", saved);
          if (changed)
            await audit(client, user.id, "event:reschedule", saved.id, {
              before: previous,
              after: saved,
              reason: "Edição individual",
            });
        }
      } else if (kind === "absence") {
        const entries = form.getAll("rows").length
          ? parseAbsenceBatch(form)
          : [
              absenceSchema.parse({
                ...data,
                revokedAt: undefined,
                revokedBy: undefined,
                withdrawalReason: undefined,
                end: raw.scope === "DAY" ? raw.start : raw.end,
              }),
            ];
        for (const absence of entries) {
          validateAbsenceSubmission(absence, currentUser, current);
          if (
            current.absences.some(
              (a) =>
                !a.revokedAt &&
                a.id !== absence.id &&
                a.ministerId === absence.ministerId &&
                a.scope === absence.scope &&
                a.start === absence.start &&
                a.end === absence.end &&
                a.eventId === absence.eventId,
            )
          )
            continue;
          await write(client, "absence", absence);
          await audit(client, user.id, "absence:save", absence.id);
        }
      } else throw new Error("Cadastro inválido.");
      await audit(client, user.id, `save:${kind}`, id);
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
  return {
    redirectTo:
      kind === "event"
        ? calendarReturn(form, "saved", eventMonth)
        : `/${page}?saved=1`,
  };
}
export async function scheduleAction(form: FormData) {
  const user = await coordinator();
  let selected = "";
  try {
    selected = month(form);
    const operation = value(form, "operation");
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const existing = data.schedules
        .filter((s) => s.month === selected)
        .sort((a, b) => b.revision - a.revision)[0];
      if (operation === "generate") {
        if (existing?.status === "DRAFT" || existing?.status === "IN_REVIEW")
          throw new Error(
            "Já existe um rascunho. Revise ou aprove antes de gerar uma nova revisão.",
          );
        if (!data.events.some((e) => e.date.startsWith(selected)))
          throw new Error("Cadastre os eventos do mês antes de gerar.");
        const schedule = existing
          ? {
              ...syncSchedule(existing, data),
              id: crypto.randomUUID(),
              status: "DRAFT" as const,
              approvedAt: undefined,
              approvedBy: undefined,
              editVersion: 1,
            }
          : generate(data, selected);
        schedule.revision = (existing?.revision ?? 0) + 1;
        schedule.warnings = validateSchedule(schedule, data);
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
      if (operation === "sync") {
        if (!["DRAFT", "IN_REVIEW"].includes(existing.status))
          throw new Error("Abra uma nova revisão.");
        updated = syncSchedule(existing, data);
        updated.status = "IN_REVIEW";
        updated.warnings = validateSchedule(updated, data);
      } else if (operation === "assign" || operation === "capacity") {
        if (!["DRAFT", "IN_REVIEW"].includes(existing.status))
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
          const alreadyAssigned = updated.assignments.some(
            (a) => a.eventId === eventId && a.ministerId === ministerId,
          );
          if (value(form, "mode") !== "remove" && alreadyAssigned)
            throw new Error(
              "Este ministro já está designado. Selecione outro ministro para preencher a vaga.",
            );
          if (value(form, "mode") === "remove" && !alreadyAssigned)
            throw new Error("Este ministro não está designado neste encontro.");
          const assignments = updated.assignments.filter(
            (a) => !(a.eventId === eventId && a.ministerId === ministerId),
          );
          if (value(form, "mode") !== "remove") {
            const minister = data.ministers.find((m) => m.id === ministerId);
            if (
              !minister ||
              minister.former ||
              !minister.active ||
              minister.registrationStatus === "DRAFT"
            )
              throw new Error(
                "Ministro inexistente, desligado ou com cadastro pendente.",
              );
            const event = updated.events.find((e) => e.id === eventId)!;
            const conflict = blocked(
              minister,
              event,
              data,
              assignments,
              updated.events,
            );
            if (conflict) throw new Error(conflict);
            assignments.push({ eventId, ministerId, origin: "MANUAL" });
          }
          updated = { ...updated, assignments };
        }
        updated.status = "IN_REVIEW";
        updated.warnings = validateSchedule(updated, data);
      } else if (operation === "approve") {
        if (!["DRAFT", "IN_REVIEW"].includes(existing.status))
          throw new Error("Apenas rascunhos podem ser aprovados.");
        const errors = validateSchedule(existing, data);
        if (errors.length) throw new Error(errors.join(" • "));
        updated = {
          ...existing,
          status: "APPROVED",
          ministers: data.ministers.map((m) => ({
            id: m.id,
            name: ministerDisplayName(m),
          })),
          assistedSnapshot: data.assisted
            .filter((p) =>
              existing.events.some(
                (e) => e.kind === "VISIT" && visitAssistedIds(e).includes(p.id),
              ),
            )
            .map((p) => ({ ...p, notes: "" })),
          warnings: [],
          approvedBy: user.id,
          approvedAt: new Date().toISOString(),
        };
      } else if (operation === "publish") {
        if (existing.status !== "APPROVED")
          throw new Error("Aprove a escala primeiro.");
        const errors = validateSchedule(existing, data);
        if (errors.length) throw new Error(errors.join(" • "));
        updated.status = "PUBLISHED";
      } else if (operation === "cancel") {
        if (!value(form, "reason")) throw new Error("Informe a justificativa.");
        updated.status = "CANCELLED";
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
