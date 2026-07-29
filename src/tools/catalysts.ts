import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker } from "../validate.js";

export const catalystTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_catalysts",
    title: "Get catalysts",
    description:
      "Upcoming and recent catalysts under `data`, each with ticker, type (e.g. earnings_soon, activist_stake, dilution, fda), date, " +
      "label, direction (bullish/bearish/neutral), and source. Omit ticker for the market-wide feed; pass a ticker to filter to one name " +
      "(may be empty if that stock has no tracked catalysts right now). Use to find date-driven, event-based opportunities.",
    schema: {
      ticker: z.string().optional().describe("Filter to one ticker; omit for the market-wide feed"),
    },
    handler: async ({ ticker }, client) => {
      const query = ticker ? { ticker: assertTicker(ticker) } : undefined;
      return client.request(`/catalysts`, { query });
    },
  }),
];
