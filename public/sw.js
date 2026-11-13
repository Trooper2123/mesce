self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title =
    typeof payload.title === "string" ? payload.title : "Atualização do MESCE";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "Há uma atualização nas suas atividades. Abra o MESCE para consultar.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: "/minhas-escalas" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) return existing.focus();
        return self.clients.openWindow("/minhas-escalas");
      }),
  );
});
