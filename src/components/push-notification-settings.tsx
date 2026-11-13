"use client";
import { useEffect, useState } from "react";
import {
  registerPushSubscription,
  revokePushSubscriptions,
} from "@/app/delivery-actions";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function PushNotificationSettings({
  active,
  publicKey,
}: {
  active: boolean;
  publicKey: string;
}) {
  const [enabled, setEnabled] = useState(active);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);
  useEffect(
    () =>
      setSupported(
        "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window,
      ),
    [],
  );

  async function enable() {
    setPending(true);
    setMessage("");
    try {
      if (!supported || !publicKey)
        throw new Error("Notificações push indisponíveis neste navegador.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Permissão não concedida. Você pode ativá-la nas configurações do navegador.",
        );
      const registration = await navigator.serviceWorker.register("/sw.js");
      const ready = await navigator.serviceWorker.ready;
      const subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      });
      await registerPushSubscription(subscription.toJSON());
      setEnabled(true);
      setMessage("Notificações ativadas neste dispositivo.");
      void registration;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar as notificações.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await revokePushSubscriptions();
      setEnabled(false);
      setMessage("Notificações desativadas neste dispositivo.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar as notificações.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <h2>Notificações neste dispositivo</h2>
      <p>
        Você receberá um aviso genérico quando sua escala publicada mudar. O
        aviso não inclui dados dos assistidos.
      </p>
      {enabled ? (
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() => void disable()}
        >
          {pending ? "Salvando…" : "Desativar notificações"}
        </button>
      ) : (
        <button
          className="button"
          type="button"
          disabled={pending || !supported || !publicKey}
          onClick={() => void enable()}
        >
          {pending ? "Ativando…" : "Ativar notificações neste dispositivo"}
        </button>
      )}
      {!supported && (
        <p className="notice">Este navegador não oferece notificações push.</p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <small>
        No iPhone ou iPad, o MESCE precisa estar instalado na Tela de Início. A
        compatibilidade ainda depende de validação no dispositivo.
      </small>
    </section>
  );
}
