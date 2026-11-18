"use server";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, write, audit } from "@/lib/store";
import { csvPreviewFingerprint, csvState } from "@/lib/minister-csv";
import { planAssistedCsv } from "@/lib/assisted-csv";
import { assistedCsvChanges } from "@/lib/csv-diff";
const errorMessage = (e: unknown) =>
  e instanceof Error && !("code" in e)
    ? e.message
    : "Não foi possível importar. Nenhum cadastro foi alterado.";
export async function previewAssistedCsv(form: FormData) {
  const user = await coordinator();
  try {
    return await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const source = String(form.get("source") ?? "");
      const update = form.get("update") === "true";
      const state = csvState(data.assisted);
      const plan = planAssistedCsv(source, data.assisted, update);
      await audit(client, user.id, "assisted:csv-preview", undefined, {
        rows: plan.summary.length,
      });
      return {
        summary: plan.summary,
        changes: assistedCsvChanges(data.assisted, plan.assisted),
        plannedCount: plan.assisted.length,
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
      error: errorMessage(e),
    };
  }
}
export async function importAssistedCsv(form: FormData) {
  const user = await coordinator();
  try {
    if (form.get("confirmed") !== "true")
      throw new Error("Confirme a prévia antes de importar.");
    const result = await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      if (csvState(data.assisted) !== form.get("expectedState"))
        throw new Error("Os cadastros mudaram. Gere uma nova prévia.");
      const source = String(form.get("source") ?? "");
      const update = form.get("update") === "true";
      const state = csvState(data.assisted);
      const plan = planAssistedCsv(source, data.assisted, update);
      if (
        csvPreviewFingerprint(source, update, state) !==
        form.get("expectedPreview")
      )
        throw new Error("A prévia não corresponde ao arquivo. Gere novamente.");
      for (const next of plan.assisted) {
        await write(client, "assisted", next);
        await audit(client, user.id, "assisted:csv", next.id, {
          before: data.assisted.find((a) => a.id === next.id),
          after: next,
        });
      }
      const counts = { written: plan.assisted.length, skipped: plan.skipped };
      await audit(client, user.id, "assisted:csv-import", undefined, counts);
      return counts;
    });
    revalidatePath("/", "layout");
    return { ...result, error: "" };
  } catch (e) {
    return { written: 0, skipped: 0, error: errorMessage(e) };
  }
}
