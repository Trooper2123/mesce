import Link from "next/link";
import { actor } from "@/lib/auth";
import {
  notificationSettings,
  saveEmailDeliveryPreference,
} from "@/app/delivery-actions";
import { PushNotificationSettings } from "@/components/push-notification-settings";

export const dynamic = "force-dynamic";

export default async function NoticeSettingsPage() {
  const user = await actor();
  const settings = await notificationSettings();
  const emailAvailable =
    process.env.MESCE_DELIVERY_OUTBOX_ENABLED === "true" &&
    process.env.MESCE_EMAIL_SEND_ENABLED === "true";
  const pushAvailable =
    process.env.MESCE_DELIVERY_OUTBOX_ENABLED === "true" &&
    process.env.MESCE_PUSH_ENABLED === "true";
  return (
    <>
      <Link href="/minhas-escalas" className="button secondary">
        Voltar às minhas escalas
      </Link>
      <h1>Notificações</h1>
      <p className="subtitle">
        Escolha como deseja receber avisos sobre alterações nas suas escalas
        publicadas.
      </p>
      {!settings.canManage ? (
        <p className="notice">
          É necessário ter um cadastro ativo de ministro vinculado à sua conta.
        </p>
      ) : (
        <>
          <section className="panel">
            <h2>Convites de calendário por e-mail</h2>
            <p>
              Os convites são enviados para o e-mail verificado da sua conta (
              {user.email}). Cada mensagem contém somente um compromisso e não
              identifica assistidos.
            </p>
            <form action={saveEmailDeliveryPreference}>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={settings.emailEnabled}
                  disabled={!emailAvailable}
                />{" "}
                Quero receber convites e atualizações de calendário por e-mail
              </label>
              <button
                className="button"
                type="submit"
                disabled={!emailAvailable}
              >
                Salvar preferência
              </button>
            </form>
            {!emailAvailable && (
              <p className="notice">
                Este canal ainda não está habilitado neste ambiente.
              </p>
            )}
          </section>
          {pushAvailable ? (
            <PushNotificationSettings
              active={settings.pushEnabled}
              publicKey={settings.vapidPublicKey ?? ""}
            />
          ) : (
            <section className="panel" style={{ marginTop: 20 }}>
              <h2>Notificações neste dispositivo</h2>
              <p>Este canal ainda não está habilitado neste ambiente.</p>
            </section>
          )}
        </>
      )}
    </>
  );
}
