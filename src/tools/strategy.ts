import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";

/**
 * Strategy performance + themed presets. Read-only.
 * Skipped: POST /strategy-presets/:id/portfolio (creates a paper book)
 *          POST /strategy-presets/portfolio/:id/rebalance (places paper trades)
 */
export const strategyTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_strategy_performance",
    title: "Get strategy performance",
    description:
      "Read-only strategy performance for a portfolio. `view` selects the slice: `kpis` (headline returns), `equity-curve` (vs SPY, normalized to 100), `monthly-returns`, `risk-metrics` (Sharpe/Sortino/max drawdown/capture), `attribution` (P/L by signal type), `comparison` (all active portfolios). Pro-tier. Does not trade.",
    schema: {
      portfolioId: z.number().int().positive().optional().describe("Portfolio id (default 1; ignored for comparison)"),
      view: z
        .enum(["kpis", "equity-curve", "monthly-returns", "risk-metrics", "attribution", "comparison"])
        .optional()
        .describe("Which slice to return (default kpis)"),
    },
    handler: async ({ portfolioId, view }, client) => {
      const v = view ?? "kpis";
      const query = v === "comparison" ? undefined : { portfolioId: portfolioId ?? 1 };
      return client.request(`/strategy-performance/${v}`, { query });
    },
  }),
  defineTool({
    name: "stoquant_list_strategy_presets",
    title: "List themed strategy presets",
    description:
      "Themed strategy presets (social / insider / congress, etc.) with customization knobs. Read-only signal catalog — does not create a portfolio. Use stoquant_get_strategy_preset_candidates to see the current ranked basket for one preset.",
    schema: {},
    handler: async (_args, client) => client.request(`/strategy-presets`),
  }),
  defineTool({
    name: "stoquant_get_strategy_preset_candidates",
    title: "Get ranked candidates for a strategy preset",
    description:
      "Current ranked candidate tickers and target-weight basket for a themed preset (`social`, `insider`, `congress`, …). Returns `{preset, appliedOptions, candidates, basket}`. This is a signal read — it does NOT create or rebalance a paper portfolio.",
    schema: {
      presetId: z.string().min(1).describe("Preset id from stoquant_list_strategy_presets"),
    },
    handler: async ({ presetId }, client) => {
      const id = encodeURIComponent(presetId.trim());
      return client.request(`/strategy-presets/${id}/candidates`);
    },
  }),
];
