import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker, clampLimit } from "../validate.js";

export const researchTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_qscore",
    title: "Get Q-Score",
    description:
      "The Q-Score is StoQuant's headline 0-100 composite for a ticker, blending fundamentals, momentum/technicals, ML, analyst, and 'hidden gem' value dimensions on SECTOR-RESIDUALIZED forward returns (sector beta removed). Returns: score (0-100), signal ('strong_buy'|'buy'|'hold'|'sell'|'strong_sell'|'unrated'), per-dimension `components` (each with rawValue, normalizedScore, weight, and an `available` flag — unavailable dims contribute 0), `confidence`/`confidenceInterval`, `dimensionContributions`, a `verdict` and `plainLanguage` summary, and `riskAlerts`. This is the best single tool for 'is this a good stock right now'. period selects the scoring horizon. Note: early in the US trading day (before ~10am ET), the score may not yet be refreshed with intraday data — a `null` or empty score should be treated as 'not yet computed' rather than an error.",
    schema: {
      ticker: z.string(),
      period: z.enum(["30d", "90d"]).optional().default("90d").describe("Scoring horizon"),
    },
    handler: async ({ ticker, period }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/q-score/${t}`, { query: { period } });
    },
  }),
  defineTool({
    name: "stoquant_get_signals_v2",
    title: "Get stage-adjusted signals",
    description:
      "Returns both the raw Q-Score (`originalQScore`) and a `stage`/regime-adjusted variant (`adjusted`) for a ticker. Use this when you want the score adjusted for the stock's lifecycle stage and current market regime rather than the raw composite. For the full breakdown use stoquant_get_qscore.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/signals/${t}`);
    },
  }),
  defineTool({
    name: "stoquant_get_ml_prediction",
    title: "Get ML outperformance prediction",
    description:
      "ML model's probability that the ticker will OUTPERFORM the S&P 500 over the horizon (NOT a buy/hold/sell call). Returns `data.prediction` with: `probability` (0-1, chance of outperformance), `classification` ('bull' = predicted to outperform, 'bear' = underperform), `modelVersion`, `modelAuc`, `plainLanguage` (headline/summary/topDrivers), and `isHeuristic` (true when the trained model is gated for distribution drift and a heuristic fallback is used — weight it less). Use stoquant_explain_ml_prediction for the feature-level 'why'. horizon is in trading days. Note: early in the US trading day (before ~10am ET), the prediction may not yet be refreshed with intraday data — a `null` or empty prediction should be treated as 'not yet computed' rather than an error.",
    schema: {
      ticker: z.string(),
      horizon: z.enum(["1", "5", "10"]).optional().default("5").describe("Forecast horizon in trading days"),
    },
    handler: async ({ ticker, horizon }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/ml-predictions/${t}`, { query: { horizon } });
    },
  }),
  defineTool({
    name: "stoquant_explain_ml_prediction",
    title: "Explain ML prediction",
    description:
      "Top feature contributions behind a ticker's ML outperformance prediction — which signals pushed the probability up or down, with signed magnitudes. Use after stoquant_get_ml_prediction when the user asks WHY the model is bullish/bearish. horizon must match the prediction you are explaining.",
    schema: {
      ticker: z.string(),
      horizon: z.enum(["1", "5", "10"]).optional().default("5"),
      top: z.number().int().optional().describe("Top N features to return (default 10, max 50)"),
    },
    handler: async ({ ticker, horizon, top }, client) => {
      const t = assertTicker(ticker);
      const n = clampLimit(top, 50, 10);
      return client.request(`/ml-predictions/${t}/explain`, { query: { horizon, top: n } });
    },
  }),
  defineTool({
    name: "stoquant_get_strategic_edges",
    title: "Get competitive intelligence",
    description:
      "Qualitative competitive intelligence for a ticker: economic moats, structural weaknesses, upcoming catalysts, and peer comparison. Best for mid/small-caps; mega-caps and thinly-covered names may return `{data:null}` (no edges computed) — treat that as 'no data', not an error.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/research/${t}/strategic-edges`);
    },
  }),
  defineTool({
    name: "stoquant_get_quant_analytics",
    title: "Get quant analytics",
    description:
      "Quantitative analytics for a ticker under `data`: factor exposures, correlation/quality metrics, and risk decomposition. Use for portfolio-construction and factor-tilt questions. Complements stoquant_get_qscore (verdict) with the underlying quant detail.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/research/${t}/quant-analytics`);
    },
  }),
  defineTool({
    name: "stoquant_get_evidence",
    title: "Get named evidence (bull/bear case)",
    description:
      "The named, two-sided evidence behind a ticker's Q-Score — the 'bull case vs bear case' as concrete facts rather than scores. Returns five grids (`momentum`, `sentiment`, `earnings`, `valuation`, `risk`), each with `cells`: every cell has a human-readable `label` (e.g. 'Price above 50-day average', 'Short interest'), a formatted `value`, and a `tone` ('bullish'|'bearish'|'neutral'|'unknown'). To assemble a balanced case, collect cells with tone 'bullish' (the bull case) and 'bearish' (the bear case) across all five grids. Use this AFTER stoquant_get_qscore when the user asks WHY the score is what it is, or wants the specific positives and negatives to weigh — it is the evidence layer the research page shows above the dimension breakdown.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/research/${t}/act2`);
    },
  }),
];
