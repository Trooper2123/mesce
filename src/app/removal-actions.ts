"use server";
import { calendarReturn } from "@/lib/calendar-navigation";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, audit } from "@/lib/store";
import { executeRecordRemoval, removalPages } from "@/lib/record-removal";
import { RemediationError } from "@/lib/remediation";
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
    if (error instanceof RemediationError)
      return { error: error.message, remediation: error.remediation };
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code) {
      console.error("record removal failed", {
        kind: String(form.get("kind") ?? "unknown"),
        sqlstate: code,
      });
    }
    return {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : code === "42501"
            ? "O banco de dados recusou a exclusão por falta de permissão técnica. Nenhum dado foi removido. A coordenação deve encaminhar o código SQLSTATE 42501 ao suporte do sistema."
            : code === "23503"
              ? "O banco bloqueou a exclusão porque ainda existe um vínculo com este cadastro. Nenhum dado foi removido. Reabra o cadastro, revise as escalas e os registros relacionados e tente novamente."
              : "Não foi possível excluir por uma falha no banco de dados. Nenhum dado foi removido. Atualize a tela e tente novamente; se persistir, encaminhe o código SQLSTATE ao suporte.",
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
