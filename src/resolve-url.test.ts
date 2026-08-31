import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRequestUrl } from "./resolve-url.js";

test("API paths stay under /api", () => {
  assert.equal(
    resolveRequestUrl("https://stoquant.com/api", "/accuracy/summary"),
    "https://stoquant.com/api/accuracy/summary",
  );
});

test("public accuracy is origin-relative, not under /api", () => {
  assert.equal(
    resolveRequestUrl("https://stoquant.com/api", "/public/accuracy/summary"),
    "https://stoquant.com/public/accuracy/summary",
  );
});

test("local dev /api base also strips for /public", () => {
  assert.equal(
    resolveRequestUrl("http://localhost:3000/api", "/public/accuracy/summary"),
    "http://localhost:3000/public/accuracy/summary",
  );
});

test("rejects relative paths", () => {
  assert.throws(() => resolveRequestUrl("https://stoquant.com/api", "public/accuracy/summary"));
});
