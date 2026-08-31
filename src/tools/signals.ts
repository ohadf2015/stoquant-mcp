import { defineTool, type AnyToolDef } from "../registry.js";

export const signalTools: AnyToolDef[] = [
  defineTool({
    name: "stoquant_get_market_regime",
    title: "Get market regime",
    description:
      "Current market-regime classification from the Hidden Markov Model over S&P 500 returns: regime label (e.g. Bull/Range/Bear) and the probability vector across states. Use to set top-down context before stock-level calls. If the model reports it could not fit, probabilities fall back to roughly uniform — read that as 'regime undetermined', not a confident Range call.",
    schema: {},
    handler: async (_args, client) => client.request(`/risk/market-regime`),
  }),
  defineTool({
    name: "stoquant_get_signal_accuracy",
    title: "Get signal hit-rates",
    description:
      "Historical track record per signal type: an array of records with `signalType`, `hitRate` (0-1), `totalObservations`, `avgReturnPercent`, `precision`, and `windowDays`. Use to weight how much to trust a given signal before acting on it — prefer signals with high hitRate AND large totalObservations.",
    schema: {},
    handler: async (_args, client) => client.request(`/signal-accuracy`),
  }),
  defineTool({
    name: "stoquant_get_accuracy_summary",
    title: "Get platform accuracy summary",
    description:
      "Public, unauthenticated platform scorecard from /public/accuracy/summary (no Pro gate). Key fields: letter `grade`, `hitRate` (do NOT treat hitRate as skill — a high hit-rate on a negatively-skewed book still loses money), `excessSpreadPp` (top-minus-bottom quintile 90-day *alpha*; this is the real edge), `spreadPp` (raw return spread, not alpha), `dataSufficient` (false = sample too small, ignore the grade), `independentWindows` (independent 90-day windows behind the Wilson CI), `sampleSize`, Wilson CI. When `dataSufficient` is true AND `excessSpreadPp` < 0 the live book has an inverted tail — auto-portfolio BUY recommendations are suppressed with gateReason `no_edge`. Call this before any buy-oriented auto-portfolio or optimizer read.",
    schema: {},
    handler: async (_args, client) => client.request(`/public/accuracy/summary`),
  }),
];
