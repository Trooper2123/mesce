"use server";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { readData, transaction, write, audit } from "@/lib/store";
import { csvState, planMinisterCsv } from "@/lib/minister-csv";
import { addEmails, emailHash } from "@/lib/registration";
export async function previewCsv(form: FormData) {
  await coordinator();
  try {
    const data = await readData();
    const plan = planMinisterCsv(
      String(form.get("source") ?? ""),
      data.ministers,
      form.get("update") === "true",
    );
    return {
      summary: plan.summary,
      expectedState: csvState(data.ministers),
      error: "",
    };
  } catch (e) {
    return {
      summary: [],
      expectedState: "",
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
      const plan = planMinisterCsv(
        String(form.get("source") ?? ""),
        data.ministers,
        form.get("update") === "true",
      );
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
