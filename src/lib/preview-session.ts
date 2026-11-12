import { z } from "zod";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export function previewEnabled(env = process.env) {
  return (
    env.VERCEL_ENV === "preview" &&
    env.MESCE_AUTH_MODE === "bypass" &&
    !!env.MESCE_DEV_PASSWORD &&
    (env.MESCE_DEV_SESSION_SECRET?.length ?? 0) >= 32
  );
}
export function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input).digest(),
    b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
function key() {
  return createHash("sha256")
    .update(process.env.MESCE_DEV_SESSION_SECRET ?? "")
    .digest();
}
export const previewProfileSchema = z.enum([
  "COORDINATOR",
  "MINISTER_A",
  "MINISTER_B",
]);
export type PreviewProfile = z.infer<typeof previewProfileSchema>;
export const previewProfiles = {
  COORDINATOR: {
    label: "Coordenador",
    sub: "mesce-preview-coordinator",
    email: "coordenacao@mesce.example",
    ministerId: undefined,
  },
  MINISTER_A: {
    label: "Ministro de teste A",
    sub: "mesce-preview-minister-a",
    email: "ministro-a@mesce.example",
    ministerId: "9b6de502-6aa9-4c5d-9a6b-fb79c2614c01",
  },
  MINISTER_B: {
    label: "Ministro de teste B",
    sub: "mesce-preview-minister-b",
    email: "ministro-b@mesce.example",
    ministerId: "9b6de502-6aa9-4c5d-9a6b-fb79c2614c02",
  },
} as const;
export function createPreviewSession(
  now = Date.now(),
  profile: PreviewProfile = "COORDINATOR",
) {
  if (!previewEnabled()) throw new Error("Sessão de homologação indisponível.");
  previewProfileSchema.parse(profile);
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(
      JSON.stringify({
        version: 2,
        profile,
        sub: previewProfiles[profile].sub,
        exp: now + 3600000,
      }),
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function readPreviewSession(raw: string, now = Date.now()) {
  if (!previewEnabled()) return null;
  try {
    const bytes = Buffer.from(raw, "base64url"),
      cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    const session = JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString(),
    );
    const profile = previewProfileSchema.parse(session.profile);
    const selected = previewProfiles[profile];
    return session.version === 2 &&
      session.sub === selected.sub &&
      Number.isFinite(session.exp) &&
      session.exp > now &&
      session.exp <= now + 3600000
      ? {
          id: selected.sub,
          email: selected.email,
          verified: true,
          preview: true,
          previewRole:
            profile === "COORDINATOR"
              ? ("COORDINATOR" as const)
              : ("MINISTER" as const),
          previewProfile: profile,
        }
      : null;
  } catch {
    return null;
  }
}
