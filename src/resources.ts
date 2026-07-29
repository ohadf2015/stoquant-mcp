import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SCREENER_FILTER_FIELDS,
  SCREENER_SORT_ONLY_FIELDS,
} from "./validate.js";

// Reference material an agent can read on demand to interpret StoQuant data
// correctly. These are static (no API call) and safe to fetch any time.

const GLOSSARY = `# StoQuant Glossary

## Q-Score (stoquant_get_qscore)
A 0-100 composite quality/opportunity score for a stock, computed on
SECTOR-RESIDUALIZED forward returns (the stock's sector beta is removed so the
score reflects stock-specific edge, not "tech went up"). Higher is better.
- signal: one of strong_buy | buy | hold | sell | strong_sell | unrated.
- components: per-dimension contributions, each with rawValue, normalizedScore
  (0-100), weight, and an \`available\` flag. A dimension with available=false
  contributes 0 — partial data lowers effective coverage, not the score directly.
- Dimensions blended: technicals/momentum, earnings_quality, ML outperformance,
  competitive moat, DCF value momentum, and hidden-gem value.
- confidence / confidenceInterval / dataCompleteness describe how trustworthy the
  score is for this name right now.

## ML Outperformance (stoquant_get_ml_prediction)
Probability the stock OUTPERFORMS the S&P 500 over the horizon (trading days).
This is NOT a buy/hold/sell rating.
- probability: 0-1 chance of outperformance.
- classification: 'bull' (predicted outperform) or 'bear' (underperform).
- isHeuristic: when true, the trained model was gated for distribution drift and
  a transparent heuristic is used instead — weight it less.
Use stoquant_explain_ml_prediction for the signed feature contributions.

## Market Regime (stoquant_get_market_regime)
Hidden Markov Model state over S&P 500 returns (e.g. Bull / Range / Bear) with a
probability vector. A near-uniform vector with a "could not fit" note means the
regime is undetermined, not a confident Range call.

## Signal accuracy (stoquant_get_signal_accuracy / _summary)
Out-of-sample track record. hitRate is the fraction of signals that were
directionally correct; trust it more when totalObservations is large. The
platform summary's topQuintile-minus-bottomQuintile spread (spreadPp) is the
realized edge vs the SPY baseline.

## Discovery lists
- Top conviction: highest Q-Score + multiple corroborating signals.
- Hidden gems: undervalued small-caps, healthy balance sheet, low analyst
  coverage, with confirming momentum/ML/insider signals.
- Multibaggers: higher-risk small/mid-caps with >5x upside setups.

## Alternative data (stoquant_get_alt_signals)
One call returns a ticker's full alt-data dossier. Sub-objects (null when no recent
activity for that ticker):
- sec8k / secLate / sec13dg / secDilution / secGovernance / secInsiderIntent / secS8:
  the SEC filing suite. 13D/G = >5% activist/passive stakes; dilution = shelf
  registrations and takedowns; governance flags = delisting (Form 25) /
  deregistration (Form 15); insider intent = Form 144/3 counts.
- fdaEnforcement: Class I/II/III recalls/actions. cpscRecalls: consumer recalls.
- clinicalTrials: phase progression / recruiting (biotech only).
- github / appStore / hackerNews / gdelt: developer traction, app rank deltas,
  story velocity, news tone — leading-indicator attention signals.
Use stoquant_get_sec_filings for the readable filing list, stoquant_get_catalysts
for date-driven events, and stoquant_get_social_sentiment for crowd positioning.

## Subscription tiers
API keys are Power-tier and clear all Pro/Power gated endpoints. A 403 means the
key owner's plan lacks access; a 401 means the key itself is bad/expired/revoked.

## Units & conventions
- marketCap: raw USD (250M = 250000000).
- Margins, growth rates, yields, short %: decimals (0.25 = 25%).
- Tickers: uppercase; dots and carets allowed (BRK.B, ^GSPC).
- Prices are vendor-delayed, not tick-by-tick. Most signals refresh daily.
`;

const METHODOLOGY = `# StoQuant Methodology Notes

## Why sector-residualized returns
All scoring diagnostics measure forward returns AFTER subtracting the stock's
sector mean. Without this, a score can look predictive merely by loading on a
sector that happened to rally. Residualization isolates stock-specific signal, so
a high Q-Score reflects edge over sector peers, not sector beta.

## Q-Score construction
Per-dimension raw signals are normalized to 0-100, weighted by their measured
predictive value (information coefficient), and combined. Dimensions with
negative measured IC are down-weighted or sign-corrected rather than naively
added. Weights are not changed on a single cohort of data — they require a
sustained, statistically significant edge across multiple market regimes.

## ML model health gating
The ML outperformance model is monitored for distribution shift (population
stability index). When drift crosses a threshold, predictions fall back to a
transparent heuristic and isHeuristic=true is set. Treat heuristic predictions as
lower-confidence.

## Screener semantics (important)
Custom screens filter on exact camelCase field names. An UNKNOWN field name is
treated as null server-side, which silently excludes every stock and returns an
empty array with NO error. Always use documented field names. Full-universe scans
are expensive and can time out (504) — prefer universe=sp500 and few filters, or a
prebuilt screen.

## Data freshness
Quotes are delayed. Benchmarks, regime, and most signals are computed on a daily
cycle; early in the trading day some endpoints may report "not yet computed".
Treat those as not-ready, not errors.
`;

// Per-field units / typical ranges for the custom screener. The FIELD NAMES are
// generated from SCREENER_FILTER_FIELDS (single source of truth in validate.ts) so
// this doc can never drift from the runtime guard. Only the human notes are curated;
// a field with no note is still listed (just without extra hints).
const SCREENER_FIELD_NOTES: Record<string, string> = {
  trailingPE: "ratio; lower = cheaper. Value screens use < 15 (CLAUDE.md §2).",
  forwardPE: "ratio on forward EPS; lower = cheaper.",
  priceToBook: "ratio; < 1.5 = value (CLAUDE.md §2).",
  pegRatio: "P/E ÷ growth; < 1.0 = growth at a reasonable price.",
  marketCap: "RAW USD (250M = 250000000). Small-cap band is 250M–10B.",
  regularMarketPrice: "raw USD last price.",
  bookValue: "book value per share, raw USD.",
  epsTrailingTwelveMonths: "trailing 12-month EPS, raw USD.",
  dividendYield: "DECIMAL (0.03 = 3%).",
  grossMargins: "DECIMAL (0.25 = 25%).",
  operatingMargins: "DECIMAL (0.25 = 25%).",
  profitMargins: "DECIMAL (0.25 = 25%).",
  returnOnEquity: "DECIMAL (0.15 = 15%).",
  returnOnAssets: "DECIMAL (0.08 = 8%).",
  revenueGrowth: "DECIMAL, YoY (0.20 = 20%).",
  earningsGrowth: "DECIMAL, YoY (0.20 = 20%).",
  debtToEquity: "ratio; < 0.5 = healthy (CLAUDE.md §2).",
  currentRatio: "ratio; > 1.5 = healthy liquidity (CLAUDE.md §2).",
  shortPercentOfFloat: "DECIMAL of float short (0.15 = 15%).",
  rsi14: "0–100; < 30 oversold, > 70 overbought.",
  numberOfAnalystOpinions: "integer count; < 8 = under-covered (small-cap edge).",
  sector: "GICS sector string — use the 'eq' or 'in' operator, not numeric ops.",
  industry: "GICS industry string — use the 'eq' or 'in' operator.",
  regularMarketVolume: "share count (today).",
  averageDailyVolume3Month: "share count (3-month avg).",
  regularMarketChangePercent: "PERCENT day move (5 = +5%).",
  fiftyDayAverageChangePercent: "PERCENT vs 50-day SMA.",
  twoHundredDayAverageChangePercent: "PERCENT vs 200-day SMA.",
  fiftyTwoWeekHighChangePercent: "PERCENT below 52-week high (negative).",
};

const SORT_ONLY_NOTES: Record<string, string> = {
  valueScore: "0–100 composite value rank.",
  qScore: "0–100 sector-residualized Q-Score.",
  marginOfSafety: "PERCENT below Graham intrinsic value (30 = 30% below).",
  mlProbability: "0–1 probability of S&P 500 outperformance.",
};

const SCREENER_FIELDS_DOC = `# StoQuant custom-screener fields (stoquant_run_screener)

Field names are camelCase and CASE-SENSITIVE. An unknown field would otherwise
silently match ZERO stocks — the validator now rejects it with a "did you mean"
suggestion, but use this list to get it right the first time.

Operators: gt, gte, lt, lte, eq, between (value = [low, high]), in (value = string[]).
All filters are AND-combined (max 20). Prefer universe='sp500' — full-universe scans can time out.

## Filterable fields
${SCREENER_FILTER_FIELDS.map(
  (f) => `- \`${f}\`${SCREENER_FIELD_NOTES[f] ? ` — ${SCREENER_FIELD_NOTES[f]}` : ""}`,
).join("\n")}

## Sort-only fields (valid for sortField, NOT filterable — derived post-filter)
${SCREENER_SORT_ONLY_FIELDS.map(
  (f) => `- \`${f}\`${SORT_ONLY_NOTES[f] ? ` — ${SORT_ONLY_NOTES[f]}` : ""}`,
).join("\n")}

## Unit reminders
- Margins, growth rates, yields, ROE/ROA, short interest are DECIMALS (0.25 = 25%), NOT percents.
- marketCap and price fields are RAW USD (250M = 250000000).
- *ChangePercent fields ARE already percents (5 = +5%).
`;

export function registerAllResources(server: McpServer): void {
  server.registerResource(
    "glossary",
    "stoquant://glossary",
    {
      title: "StoQuant glossary",
      description:
        "Definitions of Q-Score, ML outperformance, regimes, signal accuracy, tiers, and unit conventions. Read this to interpret tool outputs correctly.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: GLOSSARY }],
    }),
  );

  server.registerResource(
    "methodology",
    "stoquant://methodology",
    {
      title: "StoQuant methodology",
      description:
        "How scores are built: sector residualization, IC-weighting, ML health gating, screener field semantics, and data-freshness caveats.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: METHODOLOGY }],
    }),
  );

  server.registerResource(
    "screener-fields",
    "stoquant://screener-fields",
    {
      title: "StoQuant screener fields",
      description:
        "Exact camelCase field names, operators, and per-field units/ranges for stoquant_run_screener. Read this before building a custom screen — an unknown or mis-cased field matches zero stocks.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "text/markdown", text: SCREENER_FIELDS_DOC },
      ],
    }),
  );
}
