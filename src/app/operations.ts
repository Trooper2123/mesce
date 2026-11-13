"use server";
import { calendarReturn } from "@/lib/calendar-navigation";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actor, coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, write, audit } from "@/lib/store";
import { importLegacy } from "@/lib/legacy";
import { encrypt } from "@/lib/crypto";
import {
  planAbsenceWithdrawal,
  planEventChange,
} from "@/lib/operational-changes";
export async function legacyImportAction() {
  const user = await coordinator();
  try {
    await transaction(async (client) => {
      await assertCurrentActor(client, user, true);
      await importLegacy(client, user.id);
    });
  } catch (e) {
    redirect(
      "/configuracao?error=" +
        encodeURIComponent(
          e instanceof Error && !("code" in e)
            ? e.message
            : "Falha na importação; operação revertida.",
        ),
    );
  }
  revalidatePath("/", "layout");
  redirect("/configuracao?saved=1");
}
export async function withdrawAbsence(form: FormData) {
  const user = await actor();
  try {
    await transaction(async (client, data) => {
      const current = await assertCurrentActor(client, user);
      const id = z.string().uuid().parse(form.get("id"));
      const updated = planAbsenceWithdrawal(
        id,
        String(form.get("reason") ?? ""),
        current,
        data,
      );
      await write(client, "absence", updated);
      await audit(client, current.id, "absence:withdraw", id, {
        before: data.absences.find((a) => a.id === id),
        after: updated,
      });
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Não foi possível retirar o impedimento.",
    };
  }
  revalidatePath("/", "layout");
  return { redirectTo: "/impedimentos?saved=1" };
}
export async function changeEvents(form: FormData) {
  const user = await coordinator();
  try {
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const plan = planEventChange(form, data);
      for (const event of plan.events) {
        await write(client, "event", event);
        await audit(
          client,
          user.id,
          `event:${plan.operation.toLowerCase()}`,
          event.id,
          {
            before: data.events.find((e) => e.id === event.id),
            after: event,
            reason: plan.reason,
            scope: plan.scope,
            excluded: plan.excluded,
          },
        );
      }
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Não foi possível alterar os eventos.",
    };
  }
  revalidatePath("/", "layout");
  return { redirectTo: calendarReturn(form, "saved") };
}
export async function monthlyResponse(form: FormData) {
  const user = await actor();
  try {
    const month = z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .parse(form.get("month"));
    await transaction(async (client, data) => {
      const current = await assertCurrentActor(client, user);
      const ministerId = current.coordinator
        ? String(form.get("ministerId") ?? current.ministerId ?? "")
        : current.ministerId;
      if (!data.ministers.some((m) => m.id === ministerId && m.active))
        throw new Error("Ministro não autorizado.");
      if (!current.coordinator) {
        const now = new Date();
        const local = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);
        const [y, m, d] = local.split("-").map(Number);
        const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
        if (d > 25 || month !== next)
          throw new Error("Conclua a resposta do próximo mês até o dia 25.");
      }
      const previous = data.responses?.find(
        (r) => r.ministerId === ministerId && r.month === month,
      );
      const response = {
        id: previous?.id ?? crypto.randomUUID(),
        ministerId: ministerId!,
        month,
        submittedAt: new Date().toISOString(),
      };
      await write(client, "response", response);
      await audit(client, user.id, "availability:submitted", response.id);
    });
  } catch (e) {
    redirect(
      "/respostas?error=" +
        encodeURIComponent(
          e instanceof Error && !("code" in e)
            ? e.message
            : "Não foi possível registrar a resposta.",
        ),
    );
  }
  revalidatePath("/", "layout");
  redirect("/respostas?month=" + monthFrom(form) + "&saved=1");
}
function monthFrom(form: FormData) {
  return encodeURIComponent(String(form.get("month") ?? ""));
}

export async function settingsAction(form: FormData) {
  const user = await coordinator();
  try {
    const settings = z
      .object({
        unansweredPolicy: z.enum(["REVIEW", "ELIGIBLE"]),
        monthlyLimit: z.preprocess(
          (v) => (v === "" ? null : v),
          z.coerce.number().int().min(1).max(100).nullable(),
        ),
        historyMonths: z.coerce.number().int().min(1).max(36),
      })
      .parse(Object.fromEntries(form.entries()));
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      await client.query(
        "INSERT INTO mesce_settings(id,payload) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
        [encrypt({ ...data.settings, ...settings })],
      );
      await audit(client, user.id, "settings:update", undefined, settings);
    });
  } catch {
    redirect("/configuracao?error=Configuração inválida.");
  }
  revalidatePath("/", "layout");
  redirect("/configuracao?saved=1");
}
