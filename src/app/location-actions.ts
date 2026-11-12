"use server";
import { revalidatePath } from "next/cache";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, audit, write } from "@/lib/store";
import { encrypt } from "@/lib/crypto";
import { defaultSettings } from "@/lib/domain";
import { bindLocationRecords, planLocationChange } from "@/lib/locations";
export async function saveLocation(form: FormData) {
  const user = await coordinator();
  try {
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const plan = planLocationChange(form, data);
      await client.query(
        "INSERT INTO mesce_settings(id,payload) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
        [
          encrypt({
            ...defaultSettings,
            ...data.settings,
            locations: plan.catalog,
          }),
        ],
      );
      const rebound = bindLocationRecords(data, plan.catalog);
      for (const event of rebound.events) {
        const before = data.events.find((e) => e.id === event.id)!;
        if (JSON.stringify(before) !== JSON.stringify(event)) {
          await write(client, "event", event);
          await audit(client, user.id, "event:location-normalized", event.id, {
            before,
            after: event,
          });
        }
      }
      for (const minister of rebound.ministers) {
        const before = data.ministers.find((m) => m.id === minister.id)!;
        if (JSON.stringify(before) !== JSON.stringify(minister)) {
          await write(client, "minister", minister);
          await audit(
            client,
            user.id,
            "minister:location-normalized",
            minister.id,
            { before, after: minister },
          );
        }
      }
      await audit(client, user.id, "location:save", plan.after.id, {
        before: plan.before,
        after: plan.after,
      });
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Não foi possível salvar o local.",
    };
  }
  revalidatePath("/", "layout");
  return { redirectTo: "/locais?saved=1" };
}
