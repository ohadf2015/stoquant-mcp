import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker, clampLimit } from "../validate.js";

export const ownershipTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_insider_trades",
    title: "Get insider trades",
    description:
      "Recent insider (Form 4) transactions for a ticker under `data`, plus a `summary` (net buy/sell counts and dollar value). Cluster buying by officers/directors — especially large dollar buys — is a notable bullish signal. Use to check whether insiders are accumulating or distributing.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/insider/${t}`);
    },
  }),
  defineTool({
    name: "stoquant_get_institutional_holders",
    title: "Get institutional holders",
    description:
      "Top institutional holders for a ticker: organization name, shares held, and percent ownership. Use to gauge institutional concentration and who the big holders are.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/institutional/${t}/holders`);
    },
  }),
  defineTool({
    name: "stoquant_get_institutional_ratings",
    title: "Get institutional sentiment",
    description:
      "Aggregated institutional sentiment for a ticker: holder additions vs reductions and a net `signal` direction. Use as a 'smart money' flow read distinct from analyst ratings.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/institutional/${t}/ratings`);
    },
  }),
  defineTool({
    name: "stoquant_get_analyst_estimates",
    title: "Get analyst estimates",
    description:
      "Sell-side analyst forward estimates for a ticker under `data` (per fiscal period: estimated EPS avg/high/low, estimated revenue avg/high/low, number of analysts) with a `count`. Use for consensus expectations and dispersion. Some future periods may have null estimates until coverage fills in.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/analyst/${t}/estimates`);
    },
  }),
  defineTool({
    name: "stoquant_get_analyst_price_targets",
    title: "Get analyst price targets",
    description:
      "Analyst price targets for a ticker with a `consensus` block (avgTarget, highTarget, lowTarget, numAnalysts) and the underlying `data`. " +
      "Use to gauge implied upside/downside vs the current price and the dispersion of targets.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/analyst/${t}/price-targets`);
    },
  }),
  defineTool({
    name: "stoquant_get_analyst_changes",
    title: "Get analyst upgrades/downgrades",
    description:
      "Recent analyst rating changes for a ticker — upgrades, downgrades, reiterations, and initiations — with a 90-day action breakdown. " +
      "Use to see the direction of sell-side revisions (momentum in sentiment), not just the static consensus.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/analyst/${t}/upgrades-downgrades`);
    },
  }),
  defineTool({
    name: "stoquant_get_short_interest",
    title: "Get short interest",
    description:
      "Short-interest history for a ticker: append-only `snapshots` plus a `summary` (latestFloat = % of float short, latestRatio = days-to-cover, " +
      "and window deltas). Rising short interest with a price squeeze can signal a short squeeze; falling can signal covering. Use for crowded-short reads.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/research/${t}/short-interest`);
    },
  }),
  defineTool({
    name: "stoquant_get_insider_cluster",
    title: "Get insider cluster metrics",
    description:
      "Insider-buying cluster metrics for a ticker under `data`: distinctFilers14d, officerCount14d, purchaseCount90d, totalValue90d, " +
      "clusterScore, and a clusterMomentum flag. Cluster buying by multiple insiders (especially officers, large dollar value) is a strong " +
      "bullish signal — this scores it. Pairs with stoquant_get_insider_trades (the raw transactions).",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/research/${t}/insider-cluster`);
    },
  }),
  defineTool({
    name: "stoquant_get_big_insider_buys",
    title: "Get big insider buys (market-wide)",
    description:
      "Market-wide list of tickers with large recent insider purchases (default >= $1M) under `items`, each with the buy detail plus a current " +
      "quote and Q-Score. Use for 'where are insiders putting real money right now' discovery across the whole market.",
    schema: {
      minValue: z.number().int().optional().describe("Minimum total buy value in USD (default 1000000)"),
      days: z.number().int().optional().describe("Lookback window in days (default 30)"),
      limit: z.number().int().optional().describe("Max tickers (default 20, max 50)"),
    },
    handler: async ({ minValue, days, limit }, client) => {
      const lim = clampLimit(limit, 50, 20);
      return client.request(`/insider/big-buys`, { query: { minValue, days, limit: lim } });
    },
  }),
];
