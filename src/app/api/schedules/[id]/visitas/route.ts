import { actor } from "@/lib/auth";
import { readData, transaction, audit } from "@/lib/store";
import { latestPublished } from "@/lib/domain";
import { canDownload } from "@/lib/access";
import { visitGuidePdf } from "@/lib/pdf";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await actor();
  const { id } = await params;
  const data = await readData();
  const s = data.schedules.find((s) => s.id === id);
  if (!s || !s.assistedSnapshot || !canDownload(user, data, s))
    return Response.json(
      { error: "Guia restrito indisponível ou não autorizado." },
      { status: 403 },
    );
  if (
    !user.coordinator &&
    (!latestPublished(data).some((current) => current.id === s.id) ||
      !s.events.some(
        (e) =>
          e.kind === "VISIT" &&
          s.assignments.some(
            (a) => a.eventId === e.id && a.ministerId === user.ministerId,
          ),
      ))
  )
    return Response.json(
      { error: "Você não está designado a visitas nesta versão." },
      { status: 403 },
    );
  const pdf = await visitGuidePdf(
    s,
    user.coordinator ? undefined : user.ministerId,
  );
  await transaction(async (client) =>
    audit(client, user.id, "visits:pdf-download", s.id),
  );
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mesce-guia-restrito-${s.month}-v${s.revision}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
