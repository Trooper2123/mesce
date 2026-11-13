import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { decrypt } from "./crypto";
import { pool } from "./store";
import { findAccess, SessionIdentity } from "./registration";
import { previewEnabled, readPreviewSession } from "./preview-session";
export const configured = () =>
  !!(
    process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET &&
    process.env.AUTH0_SECRET
  );
let client: Auth0Client;
export function auth0() {
  return (client ??= new Auth0Client({
    routes: {
      callback: process.env.MESCE_AUTH0_CALLBACK_PATH ?? "/api/auth/callback",
    },
  }));
}
export type Actor = SessionIdentity & {
  coordinator: boolean;
  ministerId?: string;
};
export async function identity(): Promise<SessionIdentity> {
  if (previewEnabled()) {
    const session = readPreviewSession(
      (await cookies()).get("mesce_preview")?.value ?? "",
    );
    if (session) return session;
    redirect("/acesso-dev");
  }
  if (!configured()) redirect("/setup");
  const session = await auth0().getSession();
  if (!session) redirect("/auth/login");
  return {
    id: session.user.sub,
    email: String(session.user.email ?? "").toLowerCase(),
    verified: session.user.email_verified === true,
  };
}
export async function resolveActor(
  db: Pick<PoolClient, "query">,
  user: SessionIdentity,
): Promise<Actor | null> {
  if (!user.verified) return null;
  if (user.preview) {
    if (!previewEnabled()) return null;
    if (user.previewRole === "COORDINATOR")
      return { ...user, coordinator: true };
    if (user.previewRole !== "MINISTER") return null;
  }
  const legacyTable = user.preview
    ? { rows: [] }
    : await db.query("SELECT to_regclass('mesce_dev.actors') AS table_name");
  if (legacyTable.rows[0]?.table_name) {
    const legacy = await db.query(
      "SELECT role,active FROM mesce_dev.actors WHERE auth0_sub=$1",
      [user.id],
    );
    if (legacy.rows[0]) {
      if (!legacy.rows[0].active) return null;
      if (legacy.rows[0].role === "COORDINATOR") {
        const own = await db.query(
          "SELECT minister_id FROM mesce_access WHERE auth0_sub=$1",
          [user.id],
        );
        return {
          ...user,
          coordinator: true,
          ministerId: own.rows[0]?.minister_id,
        };
      }
    }
  }
  const access = await findAccess(db, user);
  if (access) {
    if (user.preview && access.role !== "MINISTER") return null;
    if (access.status !== "ACTIVE") return null;
    const record = await db.query(
      "SELECT payload FROM mesce_records WHERE id=$1 AND kind='minister'",
      [access.minister_id],
    );
    const member = record.rows[0]
      ? (decrypt(record.rows[0].payload) as {
          active: boolean;
          former?: boolean;
        })
      : null;
    if (access.role === "COORDINATOR" && !user.preview)
      return {
        ...user,
        coordinator: true,
        ministerId:
          member?.active && !member.former ? access.minister_id : undefined,
      };
    if (!member?.active || member.former) return null;
    return {
      ...user,
      coordinator: false,
      ministerId: access.minister_id,
    };
  }
  if (user.preview) return null;
  // Administrative bootstrap only. Persisted revocation always wins above.
  const bootstrap = (process.env.MESCE_COORDINATOR_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return bootstrap.includes(user.email) ? { ...user, coordinator: true } : null;
}
export async function actor(): Promise<Actor> {
  const user = await identity();
  const resolved = await resolveActor(pool(), user);
  if (!resolved)
    redirect(
      user.preview
        ? "/acesso-dev?error=Perfil%20indisponível.%20Troque%20o%20perfil%20ou%20consulte%20a%20coordenação."
        : "/cadastro",
    );
  return resolved;
}
export async function coordinator() {
  const user = await actor();
  if (!user.coordinator) redirect("/minhas-escalas");
  return user;
}
export async function assertCurrentActor(
  client: PoolClient,
  user: Actor,
  admin = false,
) {
  const current = await resolveActor(client, user);
  if (!current || (admin && !current.coordinator))
    throw new Error("Acesso revogado ou não autorizado.");
  return current;
}
