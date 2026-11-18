import assert from "node:assert/strict";
import test from "node:test";
import { navigationGroupIsCurrent } from "../src/components/main-navigation";

test("identifica a área ativa por uma rota filha", () => {
  const group = {
    href: "/escalas",
    children: [
      ["/escalas/anteriores", "Escalas anteriores"],
      ["/escalas/nova", "Nova escala"],
    ],
  } as const;

  assert.equal(navigationGroupIsCurrent("/escalas/nova", group), true);
  assert.equal(navigationGroupIsCurrent("/agenda", group), false);
});
