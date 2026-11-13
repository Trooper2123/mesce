const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export function preparationMonth(now = new Date()) {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}
export function calendarReturn(
  form: FormData,
  result: "saved" | "deleted",
  fallback = "",
  now = new Date(),
) {
  const chosen = String(form.get("returnMonth") ?? "");
  const month = monthPattern.test(chosen)
    ? chosen
    : monthPattern.test(fallback)
      ? fallback
      : preparationMonth(now);
  return `/celebracoes?${result}=1&month=${month}`;
}
