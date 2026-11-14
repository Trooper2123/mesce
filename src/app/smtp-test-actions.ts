"use server";

import { redirect } from "next/navigation";
import { coordinator, assertCurrentActor } from "@/lib/auth";
import { transaction } from "@/lib/store";
import { buildCalendarInvite, type InviteEvent } from "@/lib/calendar-invite";
import nodemailer from "nodemailer";

const SMTP_TEST_FINGERPRINT = "mesce:smtp-test:preview-single-send:v1";

function previewTestEnabled() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.MESCE_SMTP_TEST_ENABLED === "true"
  );
}

function dateInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export async function sendSingleSmtpTest() {
  if (!previewTestEnabled()) redirect("/minhas-escalas");

  const user = await coordinator();
  const host = process.env.MESCE_SMTP_HOST;
  const smtpUser = process.env.MESCE_SMTP_USER;
  const password = process.env.MESCE_SMTP_PASSWORD;
  const port = Number(process.env.MESCE_SMTP_PORT || 587);
  const from = process.env.MESCE_SMTP_FROM || smtpUser;
  const appUrl =
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (
    !host ||
    !smtpUser ||
    !password ||
    !from ||
    !appUrl ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    redirect("/minhas-escalas/teste-email?error=config");

  const reserved = await transaction(async (client) => {
    await assertCurrentActor(client, user, true);
    // The existing unique fingerprint table provides an atomic, one-time claim
    // without granting the runtime database role permission to create tables.
    const result = await client.query(
      `INSERT INTO mesce_attempts(fingerprint)
       VALUES($1)
       ON CONFLICT(fingerprint) DO NOTHING
       RETURNING fingerprint`,
      [SMTP_TEST_FINGERPRINT],
    );
    return result.rowCount === 1;
  });
  if (!reserved) redirect("/minhas-escalas/teste-email?attempted=1");

  const now = new Date();
  const eventDate = new Date(now.getTime() + 7 * 86400000);
  const event: InviteEvent = {
    id: crypto.randomUUID(),
    date: dateInSaoPaulo(eventDate),
    time: "10:00",
    duration: 60,
    kind: "MASS",
    location: "",
  };

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: smtpUser, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    const calendar = buildCalendarInvite({
      event,
      ministerId: "smtp-test",
      sequence: 1,
      method: "REQUEST",
      attendeeEmail: smtpUser,
      organizerEmail: from,
      applicationUrl: appUrl,
      dtstamp: now.toISOString(),
    });
    await transport.sendMail({
      from,
      to: smtpUser,
      subject: "Teste de convite de calendário MESCE",
      text: "Este é um único e-mail de teste do envio de convites de calendário MESCE.",
      icalEvent: { method: "REQUEST", content: calendar },
    });
  } catch {
    redirect("/minhas-escalas/teste-email?error=send");
  }
  redirect("/minhas-escalas/teste-email?sent=1");
}
