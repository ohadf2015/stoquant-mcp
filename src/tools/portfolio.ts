import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";

/**
 * Auto-portfolio + health + optimizer.
 *
 * Read / evaluate / optimize only. We do NOT wrap:
 *   POST /auto-portfolio/evaluate     — evaluateRules generates AND executes paper trades
 *   POST /auto-portfolio/apply-preset — mutates risk parameters
 *   PUT  /auto-portfolio/risk-params  — mutates risk parameters
 *   POST /portfolio-health/reset-drawdown, /force-heal
 *   paper-trading execute-trade / cash moves / rebalance
 *
 * Buy recommendations on the live book are suppressed when the public accuracy
 * scorecard has dataSufficient && excessSpreadPp < 0 (gateReason `no_edge`).
 */
export const portfolioTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_auto_portfolio_status",
    title: "Get auto-portfolio status (last eval + holdings)",
    description:
      "Read-only snapshot of an auto-portfolio: last evaluation (`evalStatus.lastEvalResult`, `lastEvalAt`, `recsGenerated`) plus diagnostics (cash, holdings tickers, cascade/drawdown breakers, risk params, recent recommendations). " +
      "`lastEvalResult` is `success` or `gated:<reason>`. Important gate: `gated:no_edge` means the public accuracy scorecard has dataSufficient && excessSpreadPp < 0, so BUY recommendations were suppressed — do not treat that as a buy signal. " +
      "Other gates include `static_snapshot`, `health_critical`, `cascade_breaker_paused`, `no_cash_buys_suppressed`, `no_changes`. " +
      "Requires Power-tier API key and ownership of portfolioId. This does NOT run a new evaluation and does NOT place orders.",
    schema: {
      portfolioId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Portfolio id (required by the API; default 1)"),
    },
    handler: async ({ portfolioId }, client) => {
      const pid = portfolioId ?? 1;
      const query = { portfolioId: pid };
      const [evalStatus, diagnostics] = await Promise.all([
        client.request(`/auto-portfolio/eval-status`, { query }),
        client.request(`/auto-portfolio/diagnostics`, { query }),
      ]);
      return {
        portfolioId: pid,
        evalStatus,
        diagnostics,
        note:
          "Read-only. lastEvalResult `gated:no_edge` means buys were suppressed because the live accuracy tail is inverted (excessSpreadPp < 0 with dataSufficient). Call stoquant_get_accuracy_summary before recommending buys. This tool does not execute trades.",
      };
    },
  }),
  defineTool({
    name: "stoquant_get_auto_portfolio_history",
    title: "Get auto-portfolio recommendation history",
    description:
      "Read-only recommendation history for an auto-portfolio (ticker, action, status, timestamps). Use to inspect what the engine last proposed — including rows that stayed pending or were gated. Does not execute or cancel anything. Power-tier; requires portfolio ownership.",
    schema: {
      portfolioId: z.number().int().positive().optional().describe("Portfolio id (default 1)"),
      limit: z.number().int().optional().describe("Max rows (default 100, max 1000)"),
    },
    handler: async ({ portfolioId, limit }, client) => {
      const pid = portfolioId ?? 1;
      const lim = limit == null ? 100 : Math.min(1000, Math.max(1, Math.floor(limit)));
      return client.request(`/auto-portfolio/history`, { query: { portfolioId: pid, limit: lim } });
    },
  }),
  defineTool({
    name: "stoquant_get_portfolio_health",
    title: "Get portfolio-engine health report",
    description:
      "System-wide auto-portfolio health report (subsystem statuses, degraded mode, last check time). Use to see whether the engine is healthy before trusting a last-eval snapshot. Read-only — does not trigger healing or reset the drawdown breaker.",
    schema: {},
    handler: async (_args, client) => client.request(`/portfolio-health`),
  }),
  defineTool({
    name: "stoquant_optimize_portfolio",
    title: "Optimize portfolio weights (Black-Litterman)",
    description:
      "Compute target weights via Black-Litterman (HRP blend fallback). Returns an `optimization` object with weights — it does NOT place orders, rebalance, or move cash. " +
      "If `predictions` is omitted the server fills views from ML forecasts (up to 20 tickers). Pro/Power tier. " +
      "Use the weights as a recommendation; call stoquant_get_accuracy_summary first and do not size into buys while excessSpreadPp is negative and dataSufficient is true.",
    schema: {
      tickers: z.array(z.string()).min(1).max(50).describe("Universe to allocate across"),
      method: z
        .enum(["black-litterman"])
        .optional()
        .default("black-litterman")
        .describe("Optimizer method (only black-litterman is supported)"),
      initialCapital: z.number().positive().optional().describe("Starting capital in USD (informational)"),
      predictions: z
        .record(z.object({ forecast: z.number(), confidence_interval: z.number() }))
        .optional()
        .describe("Optional views keyed by ticker. Omit to auto-fetch ML predictions."),
    },
    handler: async ({ tickers, method, initialCapital, predictions }, client) => {
      const ts = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
      if (ts.length === 0) throw new Error("tickers must be a non-empty array");
      return client.request(`/risk/portfolio-optimize`, {
        method: "POST",
        body: {
          tickers: ts,
          method: method ?? "black-litterman",
          initialCapital,
          predictions,
        },
      });
    },
  }),
];
