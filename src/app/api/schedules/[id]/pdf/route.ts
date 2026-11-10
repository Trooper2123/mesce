import { canDownload } from "@/lib/access";
import { actor } from "@/lib/auth";
import { readData, transaction, audit } from "@/lib/store";
import { schedulePdf } from "@/lib/pdf";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await actor();
  const { id } = await params;
  const data = await readData();
  const schedule = data.schedules.find((s) => s.id === id);
  if (!schedule || !["APPROVED", "PUBLISHED"].includes(schedule.status))
    return Response.json(
      { error: "Versão aprovada não encontrada." },
      { status: 404 },
    );
  if (!canDownload(user, data, schedule))
    return Response.json(
      { error: "Sem permissão para esta escala." },
      { status: 403 },
    );
  const pdf = await schedulePdf(schedule);
  await transaction(async (client) =>
    audit(client, user.id, "schedule:pdf-download", schedule.id),
  );
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mesce-escala-${schedule.month}-v${schedule.revision}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
