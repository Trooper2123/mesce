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
export function createPreviewSession(now = Date.now()) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(
      JSON.stringify({ sub: "mesce-preview-coordinator", exp: now + 3600000 }),
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
    return session.sub === "mesce-preview-coordinator" && session.exp > now
      ? {
          id: session.sub,
          email: "coordenacao@mesce.example",
          verified: true,
          preview: true,
        }
      : null;
  } catch {
    return null;
  }
}
