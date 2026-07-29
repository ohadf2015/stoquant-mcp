import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import {
  assertScreenId,
  clampLimit,
  assertScreenerField,
  SCREENER_FILTER_FIELDS,
  SCREENER_SORT_ONLY_FIELDS,
} from "../validate.js";

// Mirrors the server's runScreenSchema exactly. `operator` (not `op`) and the
// enum below are what the API validates against — sending `op`/`ne` is rejected
// with a 400 ZodError, so keep these in lockstep with src/api/routes/screener.ts.
const FilterSchema = z.object({
  field: z
    .string()
    .min(1)
    .max(64)
    .describe("Exact camelCase field name (see tool description for the valid set)"),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "between", "in"]),
  value: z
    .union([
      z.number(),
      z.string(),
      z.tuple([z.number(), z.number()]),
      z.array(z.string()),
    ])
    .describe("Number/string for scalar ops; [low, high] for 'between'; string[] for 'in'"),
});

// The accepted filter/sort fields. Single source of truth lives in validate.ts
// (SCREENER_FILTER_FIELDS) so the docstring and the runtime guard can never
// drift. NOTE: an unknown field is silently treated as null server-side, which
// excludes every stock and returns an empty list with no error — the handler
// now validates against this set and throws an actionable error instead.
const FIELD_HELP =
  "Valid filter fields (camelCase, case-sensitive): " +
  SCREENER_FILTER_FIELDS.join(", ") + ". " +
  "Additional sort-only fields: " + SCREENER_SORT_ONLY_FIELDS.join(", ") + ". " +
  "Margins/growth are decimals (0.25 = 25%); marketCap is raw USD (250M = 250000000). " +
  "An unknown field is rejected with a suggestion (it would otherwise silently return zero matches).";

export const screenerTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_list_prebuilt_screens",
    title: "List prebuilt screens",
    description:
      "List the curated prebuilt screens with their id, name, and description. Available screens: 'undervalued-gems' (low P/E, P/B value plays), 'momentum-leaders' (strong price momentum), 'oversold-bounce' (RSI reversal setup), 'ml-outperform' (ML-predicted S&P 500 outperformance), 'hidden-gems' (small-cap value with confirmation signals), 'growth-explosion' (high-growth micro/mid-caps before discovery), 'pre-explosion' (multibagger pattern: revenue acceleration + insider + fundamentals). Call this first, then run one with stoquant_run_prebuilt_screen — it is faster and better-tuned than hand-built filters.",
    schema: { universe: z.enum(["sp500", "russell2000", "full"]).optional() },
    handler: async ({ universe }, client) =>
      client.request(`/screener/prebuilt`, { query: { universe } }),
  }),
  defineTool({
    name: "stoquant_run_prebuilt_screen",
    title: "Run a prebuilt screen",
    description:
      "Run one curated screen by its id (from stoquant_list_prebuilt_screens) and get the ranked matching stocks. Prefer this over stoquant_run_screener for common intents (value, momentum, oversold, ML picks, hidden gems, growth) — the filters are pre-tuned. universe defaults to sp500; use 'full' for the broadest set. Result count is fixed by the screen definition.",
    schema: {
      screenId: z
        .string()
        .describe("Screen id, e.g. 'undervalued-gems' or 'momentum-leaders'"),
      universe: z.enum(["sp500", "russell2000", "full"]).optional(),
    },
    handler: async ({ screenId, universe }, client) => {
      const id = assertScreenId(screenId);
      return client.request(`/screener/prebuilt/${encodeURIComponent(id)}`, {
        query: { universe },
      });
    },
  }),
  defineTool({
    name: "stoquant_run_screener",
    title: "Run a custom screen",
    description:
      "Run a custom stock screen. Read-only — nothing is mutated. All filters are AND-combined; returns an ARRAY of matching stocks (ticker, name, price, plus the requested metrics and overlays like valueScore/qScore/mlProbability). " +
      FIELD_HELP +
      " For per-field units and typical ranges, read the stoquant://screener-fields resource." +
      " Tip: a full-universe scan can be slow and time out — prefer universe='sp500' and a handful of filters, or use stoquant_run_prebuilt_screen.",
    schema: {
      filters: z.array(FilterSchema).min(1).max(20).describe("Filter conditions, all must match (AND)"),
      sortField: z.string().optional().describe("Field to sort by (any valid field, or valueScore/qScore/marginOfSafety)"),
      sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
      universe: z.enum(["sp500", "russell2000", "full"]).optional().default("sp500"),
      limit: z.number().int().optional().describe("Max results (default 50, max 100)"),
    },
    handler: async ({ filters, sortField, sortDirection, universe, limit }, client) => {
      // Guard against the silent-zero-match footgun: validate every FILTER field
      // before hitting the API so a typo (e.g. "peRatio") returns an actionable
      // error with a suggestion instead of a confusing empty result set. sortField
      // is intentionally not validated — an unknown sort only yields unsorted
      // output, not a silent-empty result, and overlays (valueScore/qScore) sort fine.
      for (const f of filters) assertScreenerField(f.field);
      const lim = clampLimit(limit, 100, 50);
      return client.request(`/screener/run`, {
        method: "POST",
        body: { filters, sortField, sortDirection, universe, limit: lim },
      });
    },
  }),
];
