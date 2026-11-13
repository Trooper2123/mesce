import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/agenda-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.MESCE_OUTBOX_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

async function run(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const processed = await processOutboxBatch(25);
    return NextResponse.json({ processed });
  } catch {
    return NextResponse.json(
      { error: "Falha ao processar a fila." },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
