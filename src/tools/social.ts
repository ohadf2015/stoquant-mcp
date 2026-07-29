import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker, clampLimit } from "../validate.js";

export const socialTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_social_sentiment",
    title: "Get social sentiment",
    description:
      "Current social-media buzz for a ticker: `totalMentions`, `recentPostCount24h`, `sentimentBreakdown` (bullish/bearish/neutral), " +
      "`topPlatforms`, and a sample of `recentPosts`. Use to read retail attention and crowd sentiment. Sources are credibility-weighted " +
      "platform aggregates, not raw noise.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/social/ticker-drill/${t}`);
    },
  }),
  defineTool({
    name: "stoquant_get_social_trend",
    title: "Get social sentiment trend",
    description:
      "Daily social mention-volume and sentiment trend for a ticker over the last ~30 days. Use to see whether attention and bullishness " +
      "are building or fading, not just the current snapshot.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/social/ticker-trend/${t}`);
    },
  }),
  defineTool({
    name: "stoquant_get_trending_social",
    title: "Get trending tickers (social)",
    description:
      "Most-mentioned tickers across social platforms in the last few hours, each with mentionCount, prevMentionCount, deltaPercent, " +
      "velocityScore, bullishPct, and platforms. Use for market-wide 'what is retail talking about right now' discovery and early momentum.",
    schema: {},
    handler: async (_args, client) => client.request(`/social/trending-tickers`),
  }),
  defineTool({
    name: "stoquant_get_social_momentum",
    title: "Get social momentum surges",
    description:
      "Tickers with a sharp (2x+) surge in social mentions in the last hour vs the prior hour — the earliest social-momentum signal, with " +
      "sentiment and a recent post snippet per name. Use to catch breakouts in attention before they are widely noticed.",
    schema: {},
    handler: async (_args, client) => client.request(`/social/momentum-board`),
  }),
  defineTool({
    name: "stoquant_get_source_credibility",
    title: "Get social source credibility",
    description:
      "Leaderboard of social sources ranked by true directional accuracy (Wilson lower-bound on their calls). Use to judge how much weight " +
      "to give a platform or author's sentiment — high-credibility sources earn more trust than raw mention volume.",
    schema: {
      limit: z.number().int().optional().describe("Max sources (default 25, max 100)"),
    },
    handler: async ({ limit }, client) => {
      const lim = clampLimit(limit, 100, 25);
      // NOTE: the credibility routes are mounted at /api/credibility/* (no /social/
      // segment, unlike the sibling tools above). Calling /social/credibility/...
      // 404s to an HTML page → "Invalid JSON response". Keep this path bare.
      return client.request(`/credibility/leaderboard`, { query: { limit: lim } });
    },
  }),
];
