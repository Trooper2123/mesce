"use server";
import { ministerLocations } from "@/lib/locations";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";
import { identity, actor, coordinator, assertCurrentActor } from "@/lib/auth";
import { pool, transaction, write, audit } from "@/lib/store";
import {
  addEmails,
  parseEmails,
  findAccess,
  completeRegistration,
  rateLimit,
} from "@/lib/registration";
import {
  blankMinister,
  ownProfile,
  validateSpouse,
  requireCompleteMinister,
} from "@/lib/profile";
import {
  previewEnabled,
  passwordMatches,
  createPreviewSession,
  readPreviewSession,
  previewProfileSchema,
} from "@/lib/preview-session";
import { ensurePreviewMinister } from "@/lib/preview-profiles";
function failure(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues.map((i) => i.message).join(" • ")
    : error instanceof Error && !("code" in error)
      ? error.message
      : "Não foi possível salvar. Tente novamente.";
}
export async function allowlistAction(form: FormData) {
  const user = await coordinator();
  try {
    await rateLimit(pool(), "allowlist:" + user.id, 30);
    await transaction(async (client, data) => {
      await assertCurrentActor(client, user, true);
      const operation = String(form.get("operation"));
      if (operation === "add") {
        await addEmails(
          client,
          user.id,
          parseEmails(String(form.get("emails") ?? "")),
        );
        return;
      }
      const id = z.string().uuid().parse(form.get("id"));
      const result = await client.query(
        "SELECT * FROM mesce_access WHERE id=$1 FOR UPDATE",
        [id],
      );
      const access = result.rows[0];
      if (!access || access.role !== "MINISTER")
        throw new Error("Pré-cadastro não encontrado.");
      if (operation !== "revoke" && operation !== "restore")
        throw new Error("Operação inválida.");
      await client.query(
        "UPDATE mesce_access SET status=$1,updated_at=now() WHERE id=$2",
        [operation === "revoke" ? "REVOKED" : "PENDING", id],
      );
      const minister = data.ministers.find((m) => m.id === access.minister_id);
      if (minister && operation === "revoke")
        await write(client, "minister", { ...minister, active: false });
      await audit(client, user.id, "allowlist:" + operation, id);
    });
  } catch (e) {
    redirect("/pre-cadastros?error=" + encodeURIComponent(failure(e)));
  }
  revalidatePath("/", "layout");
  redirect("/pre-cadastros?saved=1");
}
export async function saveOwnProfile(form: FormData) {
  const user = await actor();
  try {
    await transaction(async (client, data) => {
      const current = await assertCurrentActor(client, user);
      const previous = data.ministers.find((m) => m.id === current.ministerId);
      if (!previous || !previous.active)
        throw new Error("Cadastro indisponível. Procure a coordenação.");
      const minister = requireCompleteMinister(
        ownProfile(
          {
            ...Object.fromEntries(form.entries()),
            ...ministerLocations(form, previous, data),
          },
          previous,
        ),
      );
      validateSpouse(minister, data.ministers);
      if (previous.spouseId && previous.spouseId !== minister.spouseId) {
        const old = data.ministers.find((m) => m.id === previous.spouseId);
        if (old)
          await write(client, "minister", {
            ...old,
            spouseId: "",
            couplePreference: "NONE",
          });
      }
      const spouse = data.ministers.find((m) => m.id === minister.spouseId);
      if (spouse)
        await write(client, "minister", {
          ...spouse,
          spouseId: minister.id,
          couplePreference: minister.couplePreference,
        });
      await write(client, "minister", minister);
      await audit(client, user.id, "profile:update", minister.id, {
        before: previous,
        after: minister,
      });
    });
  } catch (e) {
    return { error: failure(e) };
  }
  revalidatePath("/", "layout");
  redirect("/meus-dados?saved=1");
}
export async function saveCoordinatorProfile(form: FormData) {
  const user = await actor();
  try {
    const profile = z
      .object({
        name: z.string().trim().min(3).max(200),
        phone: z.string().trim().max(40),
      })
      .parse(Object.fromEntries(form.entries()));
    await transaction(async (client) => {
      const current = await assertCurrentActor(client, user, true);
      if (!current.coordinator)
        throw new Error("Acesso exclusivo da coordenação.");
      await client.query(
        "INSERT INTO mesce_coordinator_profiles(auth0_sub,payload) VALUES($1,$2) ON CONFLICT(auth0_sub) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()",
        [user.id, encrypt(profile)],
      );
      await audit(client, user.id, "coordinator_profile:update");
    });
  } catch (e) {
    return { error: failure(e) };
  }
  revalidatePath("/", "layout");
  redirect("/meus-dados?saved=1");
}
export async function finishRegistration(form: FormData) {
  const user = await identity();
  try {
    await rateLimit(pool(), "registration:" + user.id, 20);
    await transaction(async (client, data) => {
      const access = await findAccess(client, user);
      if (!access || access.status === "REVOKED")
        throw new Error("Cadastro não autorizado. Procure a coordenação.");
      const prior =
        data.ministers.find((m) => m.id === access.minister_id) ??
        blankMinister(access.minister_id, user.email);
      const profile = ownProfile(
        {
          ...Object.fromEntries(form.entries()),
          ...ministerLocations(form, prior, data),
        },
        {
          ...prior,
          email: user.email,
        },
      );
      if (prior.former)
        throw new Error("Cadastro de ex-ministro. Procure a coordenação.");
      requireCompleteMinister(profile);
      profile.registrationStatus = "COMPLETE";
      validateSpouse(profile, data.ministers);
      await completeRegistration(client, user, profile);
    });
  } catch (e) {
    return { error: failure(e) };
  }
  revalidatePath("/", "layout");
  redirect("/meus-dados?saved=1");
}
export async function previewLogin(form: FormData) {
  if (!previewEnabled()) redirect("/");
  const h = await headers();
  const fingerprint = createHmac(
    "sha256",
    process.env.MESCE_DEV_SESSION_SECRET!,
  )
    .update(h.get("x-forwarded-for")?.split(",")[0].slice(0, 100) ?? "unknown")
    .digest("hex");
  let profile: import("@/lib/preview-session").PreviewProfile;
  try {
    await rateLimit(pool(), "preview:" + fingerprint, 10);
    profile = previewProfileSchema.parse(form.get("profile") ?? "COORDINATOR");
    if (
      !passwordMatches(
        String(form.get("password") ?? ""),
        process.env.MESCE_DEV_PASSWORD!,
      )
    )
      throw new Error("Credenciais inválidas.");
    await transaction(async (client) => {
      await ensurePreviewMinister(client, profile);
      await audit(client, "preview-login", "preview:login", undefined, {
        profile,
      });
    });
  } catch (e) {
    redirect("/acesso-dev?error=" + encodeURIComponent(failure(e)));
  }
  (await cookies()).set(
    "mesce_preview",
    createPreviewSession(Date.now(), profile!),
    {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 3600,
    },
  );
  revalidatePath("/", "layout");
  redirect(profile! === "COORDINATOR" ? "/" : "/minhas-escalas");
}
export async function switchPreviewProfile(form: FormData) {
  if (!previewEnabled()) redirect("/");
  const store = await cookies();
  const session = readPreviewSession(store.get("mesce_preview")?.value ?? "");
  if (!session) redirect("/acesso-dev");
  let profile: import("@/lib/preview-session").PreviewProfile;
  try {
    profile = previewProfileSchema.parse(form.get("profile"));
    await rateLimit(pool(), "preview-switch:" + session.id, 30);
    await transaction(async (client) => {
      await ensurePreviewMinister(client, profile);
      await audit(client, session.id, "preview:switch-profile", undefined, {
        from: session.previewProfile,
        to: profile,
      });
    });
  } catch (error) {
    redirect("/acesso-dev?error=" + encodeURIComponent(failure(error)));
  }
  store.set("mesce_preview", createPreviewSession(Date.now(), profile!), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  });
  revalidatePath("/", "layout");
  redirect(profile! === "COORDINATOR" ? "/" : "/minhas-escalas");
}
export async function previewLogout() {
  (await cookies()).delete("mesce_preview");
  redirect("/acesso-dev");
}
