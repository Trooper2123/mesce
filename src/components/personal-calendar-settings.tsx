"use client";

import { useState, useTransition } from "react";
import {
  createPersonalCalendarFeed,
  revokePersonalCalendarFeed,
} from "@/app/calendar-actions";

export function PersonalCalendarSettings({
  enabled,
  active,
  migrationReady,
}: {
  enabled: boolean;
  active: boolean;
  migrationReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [revoked, setRevoked] = useState(false);
  const [urls, setUrls] = useState<{ https: string; webcal: string } | null>(
    null,
  );

  function activate() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await createPersonalCalendarFeed();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const url = new URL(
        `/api/calendars/${result.token}`,
        window.location.origin,
      );
      setUrls({
        https: url.toString(),
        webcal: `webcal://${url.host}${url.pathname}`,
      });
      setRevoked(false);
    });
  }

  function revoke() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await revokePersonalCalendarFeed();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setUrls(null);
      setRevoked(true);
    });
  }

  return (
    <section className="panel" aria-labelledby="calendar-feed-title">
      <h2 id="calendar-feed-title">Assinatura da agenda pessoal</h2>
      <p>
        Adicione suas designações publicadas ao Google Agenda, Apple Calendar ou
        outro aplicativo compatível. A agenda é somente leitura e atualizada
        quando o aplicativo consulta a assinatura. Ela não confirma presença.
      </p>
      <p className="muted">
        O endereço funciona como uma chave de acesso: não o compartilhe. Ele não
        mostra dados de assistidos nem a escala de outros ministros. Você pode
        revogá-lo ou gerar outro quando quiser.
      </p>
      {!enabled ? (
        <p className="notice">
          A assinatura ainda não está habilitada neste ambiente.
        </p>
      ) : !migrationReady ? (
        <p className="notice error">
          O banco ainda não recebeu a migração de agenda. Solicite a aplicação
          da migração à administração do sistema.
        </p>
      ) : (
        <>
          {active && !revoked ? (
            <>
              <p role="status">Sua assinatura está ativa.</p>
              <button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={revoke}
              >
                {pending ? "Revogando…" : "Revogar endereço"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={activate}
                style={{ marginInlineStart: 8 }}
              >
                Gerar novo endereço
              </button>
            </>
          ) : (
            <>
              <p>
                {revoked
                  ? "O endereço anterior foi revogado."
                  : "Você ainda não ativou a assinatura."}
              </p>
              <button type="button" disabled={pending} onClick={activate}>
                {pending ? "Ativando…" : "Ativar e gerar endereço"}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {urls && (
            <div className="panel" style={{ marginTop: 16 }}>
              <p role="status">
                Copie agora o endereço HTTPS ou use o link webcal. Por
                segurança, o endereço secreto não será exibido novamente nesta
                página.
              </p>
              <label className="field">
                Endereço HTTPS da assinatura
                <input
                  readOnly
                  value={urls.https}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <p>
                <a href={urls.webcal}>Abrir no aplicativo de calendário</a>
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
