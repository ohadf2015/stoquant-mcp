import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker, assertTickers, assertSector, clampLimit } from "../validate.js";

const TIMEZONE_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;

function assertTimezone(tz: string | undefined): string | undefined {
  if (tz == null) return undefined;
  const v = tz.trim();
  if (!v) return undefined;
  if (!TIMEZONE_RE.test(v)) {
    throw new Error("Invalid timezone: use an IANA name (e.g. America/New_York), max 64 characters");
  }
  return v;
}

export const priceTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_quote",
    title: "Get stock quote",
    description:
      "Real-time quote for ONE ticker: last price, day change (absolute and percent), bid/ask, day high/low, and volume. Use for a single symbol; for 2+ symbols use stoquant_get_quotes_batch (one call, far fewer requests). Prices are delayed per the data vendor, not tick-by-tick.",
    schema: { ticker: z.string().describe("Stock ticker symbol, e.g. AAPL or BRK.B") },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/prices/${t}/quote`);
    },
  }),
  defineTool({
    name: "stoquant_get_quotes_batch",
    title: "Get quotes (batch)",
    description:
      "Current quotes for up to 50 tickers in a single call. Preferred over calling stoquant_get_quote in a loop — same data, one request, stays well under rate limits. Returns one quote object per ticker (price, change, volume).",
    schema: { tickers: z.array(z.string()).min(1).max(50).describe("Up to 50 ticker symbols") },
    handler: async ({ tickers }, client) => {
      const ts = assertTickers(tickers, 50);
      return client.request(`/prices/batch/quotes`, { query: { tickers: ts } });
    },
  }),
  defineTool({
    name: "stoquant_get_extended_quote",
    title: "Get quote with technicals",
    description:
      "Quote plus computed technical indicators for one ticker: RSI(14), MACD, Bollinger Bands, and moving-average context. Use when you need momentum/overbought-oversold context, not just price. Heavier than stoquant_get_quote; can occasionally time out on cold cache — retry once if so.",
    schema: {
      ticker: z.string(),
      timezone: z.string().optional().describe("IANA timezone, e.g. America/New_York"),
    },
    handler: async ({ ticker, timezone }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/prices/${t}/extended`, { query: { timezone: assertTimezone(timezone) } });
    },
  }),
  defineTool({
    name: "stoquant_get_sparklines",
    title: "Get price history (sparklines)",
    description:
      "Historical price series (~90 days) for up to 50 tickers, for charting or trend/return computation. interval controls granularity (1d daily, 1wk weekly, 1mo monthly). Returns an array of close prices per ticker, not full OHLCV.",
    schema: {
      tickers: z.array(z.string()).min(1).max(50),
      interval: z.enum(["1d", "1wk", "1mo"]).optional().default("1d").describe("Bar granularity"),
    },
    handler: async ({ tickers, interval }, client) => {
      const ts = assertTickers(tickers, 50);
      return client.request(`/prices/batch/sparklines`, { query: { tickers: ts, interval } });
    },
  }),
  defineTool({
    name: "stoquant_get_benchmarks",
    title: "Get index benchmarks",
    description:
      "Current performance of major index ETFs (SPY, QQQ, IWM, and peers): 1-day and year-to-date return. Use to frame an individual stock against the market. Early in the trading day the response may be `{error:'Benchmarks not yet computed'}` until the daily compute runs — treat that as 'not ready', not a failure.",
    schema: {},
    handler: async (_args, client) => client.request(`/benchmarks`),
  }),
  defineTool({
    name: "stoquant_get_sector_performers",
    title: "Get sector leaders/laggards",
    description:
      "Top and bottom performing stocks within a GICS sector, by recent return. Use to find what is leading or lagging inside a sector. sector must be a full GICS name (see stoquant_get_macro_dashboard sectorRotation for valid names), e.g. 'Technology', 'Health Care', 'Financials'.",
    schema: {
      sector: z.string().describe("GICS sector name, e.g. 'Technology' or 'Health Care'"),
      limit: z.number().int().optional().describe("Max performers per side (default 10, max 50)"),
    },
    handler: async ({ sector, limit }, client) => {
      const s = encodeURIComponent(assertSector(sector));
      const lim = clampLimit(limit, 50, 10);
      return client.request(`/sector/${s}/performers`, { query: { limit: lim } });
    },
  }),
];
