import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Historical strategy backtests. Simulation only — no live/paper orders.
 * Strategy ids come from GET /backtest/templates (momentum, growth_chaser,
 * value, insider_follower, gem_composite, research_*).
 */
export const backtestTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_list_backtest_templates",
    title: "List backtest strategy templates",
    description:
      "The pre-built strategy templates you can backtest (`id`, name, parameters). Known ids include `momentum`, `growth_chaser`, `value`, `insider_follower`, `gem_composite`, and `research_*` variants. Call this before stoquant_run_backtest so you pass a real strategyId. Power-tier. Read-only.",
    schema: {},
    handler: async (_args, client) => client.request(`/backtest/templates`),
  }),
  defineTool({
    name: "stoquant_run_backtest",
    title: "Run a historical backtest",
    description:
      "Run a historical backtest for a strategy template over [startDate, endDate]. Returns the full run (metrics at 0% slippage plus bias disclosure: Deflated Sharpe, iteration count). " +
      "This is a simulation — it does NOT place live or paper orders. It does persist a run record you can reload with stoquant_get_backtest. " +
      "Power-tier; computationally expensive (this call can take tens of seconds). Prefer universe=sp500. Dates are YYYY-MM-DD.",
    schema: {
      strategyId: z
        .string()
        .min(1)
        .describe("Template id from stoquant_list_backtest_templates, e.g. momentum, value, gem_composite"),
      startDate: z.string().regex(ISO_DATE).describe("YYYY-MM-DD inclusive start"),
      endDate: z.string().regex(ISO_DATE).describe("YYYY-MM-DD inclusive end"),
      universe: z.enum(["sp500", "russell2000", "full"]).optional().describe("Default sp500"),
      initialCapital: z.number().positive().optional().describe("Starting capital USD (default 100000)"),
    },
    annotations: { readOnlyHint: false, idempotentHint: false },
    handler: async ({ strategyId, startDate, endDate, universe, initialCapital }, client) => {
      if (startDate >= endDate) throw new Error("startDate must be before endDate");
      return client.request(`/backtest/run`, {
        method: "POST",
        body: {
          strategyId,
          startDate,
          endDate,
          universe: universe ?? "sp500",
          initialCapital: initialCapital ?? 100000,
        },
      });
    },
  }),
  defineTool({
    name: "stoquant_get_backtest",
    title: "Get a saved backtest run",
    description:
      "Reload a previously stored backtest run by numeric id, including metrics and bias disclosure. Use after stoquant_run_backtest or to inspect history. Power-tier. Read-only.",
    schema: {
      id: z.number().int().positive().describe("Backtest run id returned by stoquant_run_backtest"),
    },
    handler: async ({ id }, client) => client.request(`/backtest/results/${id}`),
  }),
  defineTool({
    name: "stoquant_get_backtest_history",
    title: "List past backtest runs",
    description:
      "Metadata for past backtest runs (ids, strategy, dates) without the full equity curve. Filter by strategyId. Power-tier. Read-only.",
    schema: {
      strategyId: z.string().optional().describe("Filter to one template id"),
      limit: z.number().int().optional().describe("Max rows (default 20, max 100)"),
    },
    handler: async ({ strategyId, limit }, client) => {
      const lim = limit == null ? 20 : Math.min(100, Math.max(1, Math.floor(limit)));
      return client.request(`/backtest/history`, { query: { strategyId, limit: lim } });
    },
  }),
];
