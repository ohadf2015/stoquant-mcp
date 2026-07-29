import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker, clampLimit } from "../validate.js";

export const filingsTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_sec_filings",
    title: "Get SEC filings",
    description:
      "Recent SEC filings for a ticker under `items` (with `count`/`total`), unioning the whole suite: 8-K events (with item " +
      "labels like 'Item 2.02 Results of Operations'), NT-10K/Q late filings, 13D/13G activist/passive ownership, S-1/S-3/424B " +
      "dilution, DEF 14A / Form 25 / Form 15 governance, and Form 144/3 insider intent. Each item has accession, formType, filedDate, " +
      "category, and a human-readable label. Use to read the actual regulatory record behind a thesis.",
    schema: {
      ticker: z.string(),
      days: z.number().int().optional().describe("Lookback window in days (default 365)"),
      limit: z.number().int().optional().describe("Max filings (default 50, max 200)"),
    },
    handler: async ({ ticker, days, limit }, client) => {
      const t = assertTicker(ticker);
      const lim = clampLimit(limit, 200, 50);
      return client.request(`/research/${t}/sec-filings`, { query: { days, limit: lim } });
    },
  }),
  defineTool({
    name: "stoquant_get_news",
    title: "Get news headlines",
    description:
      "Recent news headlines for a ticker under `items`: each with publishedAt, headline, source/provider, category, and a sentiment " +
      "label. Use for the latest narrative around a stock. For news plus filings plus earnings in one combined view, use stoquant_get_news_events.",
    schema: {
      ticker: z.string(),
      days: z.number().int().optional().describe("Lookback window in days (default 14)"),
      limit: z.number().int().optional().describe("Max articles (default 30, max 50)"),
    },
    handler: async ({ ticker, days, limit }, client) => {
      const t = assertTicker(ticker);
      const lim = clampLimit(limit, 50, 30);
      return client.request(`/research/${t}/news`, { query: { days, limit: lim } });
    },
  }),
  defineTool({
    name: "stoquant_get_news_events",
    title: "Get news, filings & earnings",
    description:
      "Combined event view for a ticker under `data`: `news` (headlines), `filings` (SEC), and `earnings` (calendar). The single best call " +
      "for 'what is happening with this stock' — recent coverage, regulatory activity, and upcoming/just-reported earnings together.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/news-events/${t}`);
    },
  }),
];
