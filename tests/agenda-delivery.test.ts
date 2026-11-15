import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTBOX_LEASE_MS, PUSH_TIMEOUT_MS } from "@/lib/agenda-delivery";

test("Web Push timeout expires before its outbox lease", () => {
  assert.ok(PUSH_TIMEOUT_MS > 0);
  assert.ok(PUSH_TIMEOUT_MS < OUTBOX_LEASE_MS);
});
