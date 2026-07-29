import { z } from "zod";
import { defineTool, type AnyToolDef } from "../registry.js";
import { assertTicker } from "../validate.js";

export const altDataTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_alt_signals",
    title: "Get alternative-data signals",
    description:
      "The full alternative-data dossier for a ticker in one call, under `data`. Aggregates 15 sources: " +
      "sec8k (8-K event items + counts), secLate (NT-10K/Q late filings), sec13dg (13D/13G activist/passive ownership), " +
      "secDilution (S-1/S-3/424B shelf + active-dilution flag), secGovernance (DEF 14A, Form 25 delisting, Form 15 deregistration flags), " +
      "secInsiderIntent (Form 144/Form 3 counts), secS8 (employee stock plans), fdaEnforcement (Class I/II/III actions), " +
      "cpscRecalls (consumer recalls), clinicalTrials (phase/recruiting — biotech), github (stars/forks/issues/push activity), " +
      "appStore (iOS rank deltas), hackerNews (story velocity), gdelt (news tone). " +
      "Sources with no recent activity for the ticker are null (e.g. clinicalTrials for a non-biotech). This is the platform's differentiated edge — use it to surface catalysts and red flags an ordinary data feed misses.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/scrape-signals/${t}`);
    },
  }),
  defineTool({
    name: "stoquant_get_alt_data",
    title: "Get web alt-data (trends, IV, pageviews)",
    description:
      "Generic cached alternative-data for a ticker under `data`, keyed by source: google_trends (search interest), " +
      "wikipedia_pageviews (attention), options_iv (implied-vol metrics), openinsider (insider feed), edgar_8k. Each source carries its " +
      "latest values and fetchedAt. Complements stoquant_get_alt_signals with retail-attention and options-positioning reads.",
    schema: { ticker: z.string() },
    handler: async ({ ticker }, client) => {
      const t = assertTicker(ticker);
      return client.request(`/alt-data/${t}`);
    },
  }),
  defineTool({
    name: "stoquant_get_catalyst_watch",
    title: "Get catalyst watch (market-wide)",
    description:
      "Cross-ticker hot list of the highest-impact near-term catalysts the platform is tracking (FDA decisions, activist stakes, " +
      "dilution events, clinical readouts, etc.). Use for market-wide 'what's about to move' discovery, distinct from per-ticker stoquant_get_catalysts.",
    schema: {},
    handler: async (_args, client) => client.request(`/scrape-signals/catalyst-watch`),
  }),
];
