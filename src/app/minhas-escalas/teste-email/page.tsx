import { notFound } from "next/navigation";
import { coordinator } from "@/lib/auth";
import { sendSingleSmtpTest } from "@/app/smtp-test-actions";
import Link from "next/link";
import { pool } from "@/lib/store";

export const dynamic = "force-dynamic";

const SMTP_TEST_FINGERPRINT = "mesce:smtp-test:preview-single-send:v1";

export default async function SmtpTestPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; attempted?: string }>;
}) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.MESCE_SMTP_TEST_ENABLED !== "true"
  )
    notFound();

  await coordinator();
  const params = await searchParams;
  const attempted = await pool().query(
    "SELECT fingerprint FROM mesce_attempts WHERE fingerprint=$1",
    [SMTP_TEST_FINGERPRINT],
  );
  return (
    <>
      <Link className="button secondary" href="/minhas-escalas/avisos">
        Voltar às notificações
      </Link>
      <h1>Teste de e-mail</h1>
      <p className="subtitle">
        Envia exatamente uma mensagem de teste para o endereço configurado em
        MESCE_SMTP_USER, com um convite de calendário fictício. Nenhum ministro
        ou dado de escala real é usado.
      </p>
      {attempted.rows.length ? (
        <p className="notice" role="status">
          {params.error === "send"
            ? "A tentativa única falhou. Nenhum segundo envio será realizado por esta tela."
            : params.sent
              ? "O SMTP aceitou a mensagem. Confira a caixa de entrada e a pasta de spam."
              : "Uma tentativa já foi registrada neste ambiente. Confira a caixa de entrada; não haverá um segundo envio."}
        </p>
      ) : (
        <form action={sendSingleSmtpTest}>
          <button className="button" type="submit">
            Enviar um único e-mail de teste
          </button>
        </form>
      )}
      {params.error === "config" && (
        <p className="notice" role="alert">
          Faltam variáveis SMTP válidas para enviar o teste.
        </p>
      )}
      {params.attempted && !attempted.rows.length && (
        <p className="notice" role="alert">
          O teste já foi iniciado neste ambiente; atualize a página antes de
          tentar novamente.
        </p>
      )}
    </>
  );
}
