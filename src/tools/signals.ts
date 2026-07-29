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
      "Platform-wide model scorecard: letter `grade`, overall `hitRate`, `sampleSize`, top- vs bottom-quintile average 90-day returns and their `spreadPp` (the real edge), `spyAvgReturn90d` (Russell 2000 benchmark preferred via IWM/^RUT, SPY fallback), `trend`/`trendDelta`, a Wilson confidence interval, and `dataSufficient`. Use to gauge overall reliability of StoQuant's signals right now.",
    schema: {},
    handler: async (_args, client) => client.request(`/accuracy/summary`),
  }),
];
