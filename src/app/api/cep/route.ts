import { NextResponse } from "next/server";
import { z } from "zod";
import { coordinator } from "@/lib/auth";
import { normalizePostalCode } from "@/lib/locations";

const responseSchema = z.object({
  cep: z.string(),
  state: z.string().length(2),
  city: z.string().min(1),
  neighborhood: z.string(),
  street: z.string(),
  location: z
    .object({
      coordinates: z
        .object({
          latitude: z.string().optional(),
          longitude: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
const cache = new Map<string, unknown>();

export async function GET(request: Request) {
  await coordinator();
  let cep: string;
  try {
    cep = normalizePostalCode(
      new URL(request.url).searchParams.get("cep") ?? "",
    );
  } catch {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }
  if (!cep)
    return NextResponse.json({ error: "Informe o CEP." }, { status: 400 });
  if (cache.has(cep)) return NextResponse.json(cache.get(cep));
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      cache: "no-store",
    });
    if (response.status === 400)
      return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
    if (response.status === 404)
      return NextResponse.json(
        { error: "CEP não encontrado." },
        { status: 404 },
      );
    if (!response.ok) throw new Error("provider unavailable");
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("invalid provider response");
    const latitude = Number(parsed.data.location?.coordinates?.latitude);
    const longitude = Number(parsed.data.location?.coordinates?.longitude);
    const coordinatesValid =
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;
    const result = {
      postalCode: cep,
      street: parsed.data.street,
      neighborhood: parsed.data.neighborhood,
      city: parsed.data.city,
      state: parsed.data.state.toUpperCase(),
      latitude: coordinatesValid ? latitude : undefined,
      longitude: coordinatesValid ? longitude : undefined,
      geocodedAt: coordinatesValid ? new Date().toISOString() : undefined,
    };
    cache.set(cep, result);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error:
          "Serviço de CEP temporariamente indisponível. Preencha o endereço manualmente.",
      },
      { status: 503 },
    );
  }
}
