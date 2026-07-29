import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker, clampLimit } from "../validate.js";

export const discoveryTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_top_conviction",
    title: "Get top-conviction picks",
    description:
      "StoQuant's current highest-conviction names: the stocks with the strongest Q-Scores backed by multiple corroborating signals. Use as the starting point for 'what does the platform like right now'. May be empty between scans (`{stocks:{}}`).",
    schema: { limit: z.number().int().optional().describe("Max results (default 10, max 50)") },
    handler: async ({ limit }, client) => {
      const lim = clampLimit(limit, 50, 10);
      return client.request(`/conviction/top`, { query: { limit: lim } });
    },
  }),
  defineTool({
    name: "stoquant_get_hidden_gems",
    title: "Get hidden gems",
    description:
      "Undervalued small-caps with confirming signals (the 'hidden gem' screen: low valuation, healthy balance sheet, low analyst coverage, plus momentum/ML/insider confirmation). Returns `{gems:[...], totalCount, lastScanAt}`. freshness filters by how recently a gem's signals fired. Use for value-oriented idea generation distinct from momentum.",
    schema: {
      limit: z.number().int().optional().describe("Max results (default 20, max 100)"),
      freshness: z.enum(["fresh", "aging", "stale"]).optional().describe("Filter by signal age: 'fresh' (within 2 hours), 'aging' (within 24 hours), 'stale' (24+ hours). Omit to exclude stale gems."),
    },
    handler: async ({ limit, freshness }, client) => {
      const lim = clampLimit(limit, 100, 20);
      return client.request(`/gems`, { query: { limit: lim, freshness } });
    },
  }),
  defineTool({
    name: "stoquant_get_multibagger_candidates",
    title: "Get multibagger candidates",
    description:
      "Small/mid-caps flagged with high (>5x) upside potential: revenue acceleration, improving fundamentals, and pre-discovery setups. Higher risk/variance than hidden gems. Use for aggressive growth idea generation.",
    schema: { limit: z.number().int().optional().describe("Max results (default 20, max 100)") },
    handler: async ({ limit }, client) => {
      const lim = clampLimit(limit, 100, 20);
      return client.request(`/screener/multibagger-scan`, { query: { limit: lim } });
    },
  }),
  defineTool({
    name: "stoquant_get_related_stocks",
    title: "Get related/peer stocks",
    description:
      "Find peers of a ticker under `peers`, each with qScore, quote, and market cap. `by` selects the relation: 'sector' (same sector), " +
      "'tag' (shared thematic tags), 'setup' (same technical setup firing), or 'correlation' (highest 60-day return correlation). Use to build " +
      "a comparison set or find alternatives to a name.",
    schema: {
      ticker: z.string(),
      by: z.enum(["sector", "tag", "setup", "correlation"]).optional().default("sector"),
      limit: z.number().int().optional().describe("Max peers (default 12, max 25)"),
    },
    handler: async ({ ticker, by, limit }, client) => {
      const t = assertTicker(ticker);
      const lim = clampLimit(limit, 25, 12);
      return client.request(`/research/${t}/related`, { query: { by, limit: lim } });
    },
  }),
  defineTool({
    name: "stoquant_get_signal_accuracy_heatmap",
    title: "Get accuracy heatmap",
    description:
      "Hit-rate heatmap of signals over time/ticker for a date range — which signal types worked when. Use for backtest-style 'has this signal been reliable lately' questions. Dates are YYYY-MM-DD; omit for the default recent window.",
    schema: {
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
    },
    handler: async ({ startDate, endDate }, client) =>
      client.request(`/signal-accuracy/heatmap`, {
        query: { start_date: startDate, end_date: endDate },
      }),
  }),
];
