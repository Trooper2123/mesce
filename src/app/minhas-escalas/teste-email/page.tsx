import { notFound } from "next/navigation";
import { coordinator } from "@/lib/auth";
import { sendSingleSmtpTest } from "@/app/smtp-test-actions";
import Link from "next/link";
import { pool } from "@/lib/store";

export const dynamic = "force-dynamic";

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
  const table = await pool().query(
    "SELECT to_regclass('mesce_smtp_test_attempts') AS name",
  );
  const attempted = table.rows[0]?.name
    ? await pool().query(
        "SELECT result_code FROM mesce_smtp_test_attempts WHERE test_key='preview-single-send-v1'",
      )
    : { rows: [] };
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
      {params.sent || attempted.rows.length ? (
        <p className="notice" role="status">
          {attempted.rows[0]?.result_code === "SMTP_ERROR" ||
          params.error === "send"
            ? "A única tentativa foi realizada, mas o SMTP não confirmou o envio. Confira as credenciais antes de preparar outro teste."
            : "A tentativa única foi concluída. O SMTP aceitou a mensagem; confira a caixa de entrada e a pasta de spam."}
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
          Faltam variáveis SMTP para enviar o teste.
        </p>
      )}
      {params.error === "send" && (
        <p className="notice" role="alert">
          O SMTP não aceitou o e-mail. Verifique as credenciais e tente
          novamente.
        </p>
      )}
      {params.attempted && !attempted.rows.length && (
        <p className="notice" role="alert">
          O teste já foi iniciado neste ambiente; não haverá um segundo envio.
        </p>
      )}
    </>
  );
}
