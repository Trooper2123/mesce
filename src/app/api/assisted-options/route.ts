import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction, audit } from "@/lib/store";
export async function GET() {
  const user = await coordinator();
  const options = await transaction(async (client, data) => {
    await assertCurrentActor(client, user, true);
    await audit(client, user.id, "assisted:options");
    return data.assisted
      .filter((a) => a.active)
      .map((a) => ({
        ...a,
        id: a.id,
        name: a.name,
        ministersRequired: a.ministersRequired ?? 1,
      }));
  });
  return Response.json(options, { headers: { "Cache-Control": "no-store" } });
}
