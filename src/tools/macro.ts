import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertFredSeries } from "../validate.js";

export const macroTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_macro_indicator",
    title: "Get macro indicator (FRED)",
    description:
      "Latest values for one FRED macro series under `data` (recent observations) with a `count`. Common ids: DGS10 (10y Treasury yield), DGS2 (2y), T10Y2Y (10y-2y spread), UNRATE (unemployment), CPIAUCSL (CPI), VIXCLS (VIX), FEDFUNDS (fed funds). Use for a single specific indicator; for the full picture use stoquant_get_macro_dashboard.",
    schema: {
      seriesId: z.string().describe("FRED series id, e.g. DGS10, UNRATE, VIXCLS, T10Y2Y"),
    },
    handler: async ({ seriesId }, client) => {
      const s = assertFredSeries(seriesId);
      return client.request(`/macro/indicators/${s}`);
    },
  }),
  defineTool({
    name: "stoquant_get_macro_dashboard",
    title: "Get macro dashboard",
    description:
      "Full top-down macro picture in one call: `regime` classification, key `indicators`, `macroStress` gauge, `sectorRotation` (which sectors are favored, with valid GICS sector names), forward `calendar`, and current `themes`. Best first call for 'what's the macro backdrop' before drilling into stocks.",
    schema: {},
    handler: async (_args, client) => client.request(`/macro/dashboard`),
  }),
  defineTool({
    name: "stoquant_get_macro_calendar",
    title: "Get economic calendar",
    description:
      "Forward (~14 day) economic calendar: scheduled releases with forecast, prior value, and expected market impact. Use to flag upcoming macro events (CPI, FOMC, jobs) that could move positions.",
    schema: {},
    handler: async (_args, client) => client.request(`/macro/calendar`),
  }),
  defineTool({
    name: "stoquant_get_macro_themes",
    title: "Get macro themes",
    description:
      "Current macro investment themes with their related sectors — the narrative layer (e.g. rate-cut beneficiaries, AI capex). Use for thematic idea generation that ties stocks to a macro thesis.",
    schema: {},
    handler: async (_args, client) => client.request(`/macro/themes`),
  }),
];
