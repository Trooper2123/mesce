import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preparationMonth,
  calendarReturn,
} from "../src/lib/calendar-navigation";
test("calendário abre no próximo mês em Brasília, inclusive na virada de ano", () => {
  assert.equal(preparationMonth(new Date("2026-11-12T12:00:00Z")), "2026-12");
  assert.equal(preparationMonth(new Date("2027-01-01T01:00:00Z")), "2027-01");
});
test("salvar, cancelar e excluir preservam o mês escolhido sem aceitar destinos externos", () => {
  const f = new FormData();
  f.set("returnMonth", "2027-02");
  assert.equal(
    calendarReturn(f, "saved", "2026-11"),
    "/celebracoes?saved=1&month=2027-02",
  );
  assert.equal(
    calendarReturn(f, "deleted"),
    "/celebracoes?deleted=1&month=2027-02",
  );
  f.set("returnMonth", "https://example.invalid");
  assert.equal(
    calendarReturn(f, "saved", "", new Date("2026-11-12T12:00:00Z")),
    "/celebracoes?saved=1&month=2026-12",
  );
});
