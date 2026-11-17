const UTC_NOON = "T12:00:00Z";

export function displayDate(value: string, weekday = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: weekday ? "long" : "2-digit",
    year: "numeric",
    weekday: weekday ? "long" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${value}${UTC_NOON}`));
}

export function displayMonth(value: string) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01${UTC_NOON}`));
  return label[0].toUpperCase() + label.slice(1);
}
