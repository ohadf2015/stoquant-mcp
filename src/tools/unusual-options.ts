import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker } from "../validate.js";

export const unusualOptionsTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_unusual_options",
    title: "Get unusual options activity",
    description:
      "Options contracts trading far above their open interest, ranked by notional (volume x price x 100). Each row under `data.rows` has " +
      "ticker, optType (call/put), strike, expiry, dte, volume, openInterest, volOi, newPosition (open interest was 0), notional, " +
      "priceSource (mid/last), lastVsMid and ageHours. IMPORTANT: this is a delayed QUOTE snapshot, front-month expiry only — there is no " +
      "trade tape, so no buyer/seller side and no sweep detection; `lastVsMid` is only where the last print sat between bid (0) and ask (1). " +
      "Open interest is published next day, so volume/OI compares today against yesterday. Descriptive, not a buy or sell signal.",
    schema: {
      ticker: z.string().optional().describe("Filter to one ticker; omit for the market-wide feed"),
      type: z.enum(["call", "put"]).optional().describe("Contract side (NOT the side of the trade)"),
      newPositionsOnly: z.boolean().optional().describe("Only contracts where open interest was 0"),
      minNotional: z.number().optional().describe("Minimum dollars traded, e.g. 250000"),
      limit: z.number().optional().describe("Max rows, default 100, cap 500"),
    },
    handler: async ({ ticker, type, newPositionsOnly, minNotional, limit }, client) => {
      const query: Record<string, string> = {};
      if (ticker) query.ticker = assertTicker(ticker);
      if (type) query.type = type;
      if (newPositionsOnly) query.new = "1";
      if (minNotional) query.minNotional = String(minNotional);
      if (limit) query.limit = String(limit);
      return client.request(`/unusual-options`, { query });
    },
  }),
];
