"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actor, coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, write, audit } from "@/lib/store";
import { importLegacy } from "@/lib/legacy";
import { encrypt } from "@/lib/crypto";
import { requireFuture } from "@/lib/domain";
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
export async function cancelEvent(form: FormData) {
  const user = await coordinator();
  try {
    const id = z.string().uuid().parse(form.get("id"));
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const event = data.events.find((e) => e.id === id);
      if (!event) throw new Error("Evento inexistente.");
      requireFuture(event);
      const reason = String(form.get("reason") ?? "").trim();
      if (reason.length < 3) throw new Error("Informe a justificativa.");
      await write(client, "event", { ...event, cancelled: true });
      await audit(client, user.id, "event:cancel", id, { reason });
    });
  } catch (e) {
    redirect(
      "/celebracoes?error=" +
        encodeURIComponent(
          e instanceof Error && !("code" in e)
            ? e.message
            : "Não foi possível cancelar.",
        ),
    );
  }
  revalidatePath("/", "layout");
  redirect("/celebracoes?saved=1");
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
        monthlyLimit: z.coerce.number().int().min(1).max(100),
        historyMonths: z.coerce.number().int().min(1).max(36),
      })
      .parse(Object.fromEntries(form.entries()));
    await transaction(async (client) => {
      await assertCurrentActor(client, user, true);
      await client.query(
        "INSERT INTO mesce_settings(id,payload) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
        [encrypt(settings)],
      );
      await audit(client, user.id, "settings:update", undefined, settings);
    });
  } catch {
    redirect("/configuracao?error=Configuração inválida.");
  }
  revalidatePath("/", "layout");
  redirect("/configuracao?saved=1");
}
