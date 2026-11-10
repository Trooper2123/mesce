import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { redirect } from "next/navigation";
export const configured = () =>
  !!(
    process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET &&
    process.env.AUTH0_SECRET
  );
let client: Auth0Client;
export function auth0() {
  return (client ??= new Auth0Client());
}
export async function actor() {
  if (!configured()) redirect("/setup");
  const session = await auth0().getSession();
  if (!session) redirect("/auth/login");
  const email = String(session.user.email ?? "").toLowerCase();
  const coordinators = (process.env.MESCE_COORDINATOR_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return {
    id: session.user.sub,
    email,
    coordinator:
      session.user.email_verified === true && coordinators.includes(email),
    verified: session.user.email_verified === true,
  };
}
export async function coordinator() {
  const user = await actor();
  if (!user.coordinator) throw new Error("Acesso exclusivo da coordenação.");
  return user;
}
