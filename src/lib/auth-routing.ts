import { previewEnabled } from "./preview-session";
/** Keep the transaction cookie and OAuth callback on the same trusted origin. */
export function authEntryRedirect(
  input: string,
  env = process.env,
): string | null {
  const request = new URL(input);
  if (previewEnabled(env)) {
    if (
      request.pathname.startsWith("/auth/") ||
      request.pathname ===
        (env.MESCE_AUTH0_CALLBACK_PATH ?? "/api/auth/callback")
    )
      return new URL("/acesso-dev", request.origin).href;
    return null;
  }
  if (
    env.VERCEL_ENV !== "production" ||
    request.pathname !== "/auth/login" ||
    !env.APP_BASE_URL
  )
    return null;
  const base = new URL(env.APP_BASE_URL);
  if (base.protocol !== "https:" || base.username || base.password)
    throw new Error("APP_BASE_URL deve ser uma origem HTTPS confiável.");
  if (request.origin === base.origin) return null;
  const target = new URL("/auth/login", base.origin);
  // Do not forward deployment-share tokens or provider parameters to another host.
  const returnTo = request.searchParams.get("returnTo");
  if (
    returnTo?.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\")
  )
    target.searchParams.set("returnTo", returnTo);
  return target.href;
}
