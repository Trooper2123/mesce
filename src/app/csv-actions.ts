"use server";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, write, audit } from "@/lib/store";
import {
  csvPreviewFingerprint,
  csvState,
  planMinisterCsv,
} from "@/lib/minister-csv";
import { addEmails, emailHash, syncMinisterEmail } from "@/lib/registration";
import { ministerCsvChanges } from "@/lib/csv-diff";
import { locationCatalog } from "@/lib/locations";
export async function previewCsv(form: FormData) {
  const user = await coordinator();
  try {
    return await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const source = String(form.get("source") ?? "");
      const update = form.get("update") === "true";
      const state = csvState(data.ministers);
      const plan = planMinisterCsv(source, data.ministers, update);
      await audit(client, user.id, "minister:csv-preview", undefined, {
        rows: plan.summary.length,
      });
      return {
        summary: plan.summary,
        changes: ministerCsvChanges(
          data.ministers,
          plan.ministers,
          locationCatalog(data),
        ),
        plannedCount: plan.ministers.length,
        expectedState: state,
        expectedPreview: csvPreviewFingerprint(source, update, state),
        error: "",
      };
    });
  } catch (e) {
    return {
      summary: [],
      changes: [],
      plannedCount: 0,
      expectedState: "",
      expectedPreview: "",
      error:
        e instanceof Error && !("code" in e)
          ? e.message
          : "Não foi possível validar o arquivo.",
    };
  }
}
export async function importCsv(form: FormData) {
  const user = await coordinator();
  try {
    if (form.get("confirmed") !== "true")
      throw new Error("Confirme a prévia antes de importar.");
    const result = await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      if (csvState(data.ministers) !== form.get("expectedState"))
        throw new Error("Os cadastros mudaram. Gere uma nova prévia.");
      const source = String(form.get("source") ?? "");
      const update = form.get("update") === "true";
      const state = csvState(data.ministers);
      const plan = planMinisterCsv(source, data.ministers, update);
      if (
        csvPreviewFingerprint(source, update, state) !==
        form.get("expectedPreview")
      )
        throw new Error("A prévia não corresponde ao arquivo. Gere novamente.");
      const remap = new Map<string, string>();
      for (const m of plan.ministers) {
        if (!m.email) continue;
        const access = await client.query(
          "SELECT minister_id,status FROM mesce_access WHERE email_hmac=$1",
          [emailHash(m.email)],
        );
        if (access.rows[0] && !data.ministers.some((x) => x.id === m.id))
          remap.set(m.id, access.rows[0].minister_id);
        if (
          form.get("authorize") === "true" &&
          access.rows[0]?.status === "REVOKED"
        )
          throw new Error(
            "Um e-mail está com acesso revogado. Restaure-o em Pré-cadastros ou importe sem autorizar acessos.",
          );
      }
      for (const m of plan.ministers) {
        const previous = data.ministers.find((x) => x.id === m.id);
        const next = {
          ...m,
          id: remap.get(m.id) ?? m.id,
          spouseId: remap.get(m.spouseId) ?? m.spouseId,
        };
        await write(client, "minister", next);
        await syncMinisterEmail(client, next.id, next.email, user.id);
        await audit(client, user.id, "minister:csv", next.id, {
          before: previous,
          after: next,
        });
      }
      if (form.get("authorize") === "true")
        await addEmails(
          client,
          user.id,
          plan.ministers
            .filter((m) => m.active && !m.former && m.email)
            .map((m) => m.email),
        );
      const counts = { written: plan.ministers.length, skipped: plan.skipped };
      await audit(client, user.id, "csv:import", undefined, counts);
      return counts;
    });
    revalidatePath("/", "layout");
    return { ...result, error: "" };
  } catch (e) {
    return {
      written: 0,
      skipped: 0,
      error:
        e instanceof Error && !("code" in e)
          ? e.message
          : "Importação revertida. Nenhum cadastro foi alterado.",
    };
  }
}
