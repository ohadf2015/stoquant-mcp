// The whole point of the free-tier change is what an agent READS back when it hits a gate:
// a keyless 401 must offer the free key, a 403 must name a price, and neither may claim the
// server is Power-only. Assertions, not a framework — `node --test` runs this file directly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { explainHttpError } from "./client.js";

test("401 without a key sells the FREE tier, not Power", () => {
  const m = explainHttpError(401, "Unauthorized", "/q-score/AAPL", "", false);
  assert.match(m, /FREE/);
  assert.match(m, /no credit card/i);
  assert.match(m, /100 requests\/day/);
  assert.doesNotMatch(m, /Power-tier key/);
});

test("401 WITH a key is a broken-credential message, not a signup pitch", () => {
  const m = explainHttpError(401, "Unauthorized", "/q-score/AAPL", "", true);
  assert.match(m, /malformed, expired, or revoked/);
  assert.doesNotMatch(m, /no credit card/i);
});

test("403 names the tier and its price so the agent can quote an upgrade", () => {
  const m = explainHttpError(403, "Forbidden", "/ml-predictions/AAPL", "", true);
  assert.match(m, /\$29\/mo/);
  assert.match(m, /\$79\/mo/);
  assert.match(m, /stoquant\.com\/pricing/);
});

test("429 explains the free daily allowance before blaming bursts", () => {
  const m = explainHttpError(429, "Too Many Requests", "/gems", "", true);
  assert.match(m, /100 requests\/day/);
  assert.match(m, /stoquant\.com\/pricing/);
});
