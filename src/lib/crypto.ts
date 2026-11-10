import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
function key() {
  const raw = process.env.MESCE_DATA_KEY_HEX;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
    throw new Error(
      "Configure MESCE_DATA_KEY_HEX com 64 caracteres hexadecimais.",
    );
  return Buffer.from(raw, "hex");
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), body]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decrypt(value: string): unknown {
  const [iv, tag, body] = value.split(".").map((x) => Buffer.from(x, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8"),
  );
}
