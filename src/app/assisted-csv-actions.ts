"use server";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, write, audit } from "@/lib/store";
import { csvState } from "@/lib/minister-csv";
import { planAssistedCsv } from "@/lib/assisted-csv";
const errorMessage = (e: unknown) =>
  e instanceof Error && !("code" in e)
    ? e.message
    : "Não foi possível importar. Nenhum cadastro foi alterado.";
export async function previewAssistedCsv(form: FormData) {
  const user = await coordinator();
  try {
    return await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const plan = planAssistedCsv(
        String(form.get("source") ?? ""),
        data.assisted,
        form.get("update") === "true",
      );
      await audit(client, user.id, "assisted:csv-preview", undefined, {
        rows: plan.summary.length,
      });
      return {
        summary: plan.summary,
        expectedState: csvState(data.assisted),
        error: "",
      };
    });
  } catch (e) {
    return { summary: [], expectedState: "", error: errorMessage(e) };
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
      const plan = planAssistedCsv(
        String(form.get("source") ?? ""),
        data.assisted,
        form.get("update") === "true",
      );
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
