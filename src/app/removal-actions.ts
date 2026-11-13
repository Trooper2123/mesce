"use server";
import { calendarReturn } from "@/lib/calendar-navigation";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, audit } from "@/lib/store";
import { executeRecordRemoval, removalPages } from "@/lib/record-removal";
export async function removeRecord(form: FormData) {
  const user = await coordinator();
  let page = "";
  try {
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const plan = await executeRecordRemoval(client, data, user, form);
      page = removalPages[plan.kind];
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Não foi possível excluir. Nenhum dado foi removido.",
    };
  }
  revalidatePath("/", "layout");
  return {
    redirectTo:
      page === "celebracoes"
        ? calendarReturn(form, "deleted")
        : `/${page}?deleted=1`,
  };
}

export async function removePendingAccess(form: FormData) {
  const user = await coordinator();
  try {
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const { z } = await import("zod");
      const id = z.string().uuid().parse(form.get("id"));
      const reason = z
        .string()
        .trim()
        .min(3)
        .max(2000)
        .parse(form.get("reason"));
      if (form.get("confirm") !== "yes")
        throw new Error("Confirme a exclusão.");
      const result = await client.query(
        "SELECT * FROM mesce_access WHERE id=$1 FOR UPDATE",
        [id],
      );
      const access = result.rows[0];
      if (
        !access ||
        access.role !== "MINISTER" ||
        access.status !== "PENDING" ||
        access.auth0_sub ||
        data.ministers.some((m) => m.id === access.minister_id)
      )
        throw new Error(
          "Somente pré-cadastros pendentes, sem login nem cadastro vinculado, podem ser excluídos. Para os demais, use Revogar acesso.",
        );
      await client.query("DELETE FROM mesce_access WHERE id=$1", [id]);
      await audit(client, user.id, "allowlist:delete", id, { reason });
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Não foi possível excluir o pré-cadastro.",
    };
  }
  revalidatePath("/", "layout");
  return { redirectTo: "/pre-cadastros?deleted=1" };
}
