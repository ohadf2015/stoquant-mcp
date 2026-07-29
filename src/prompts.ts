import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Reusable workflows. Each returns a single user message that tells the model
// which StoQuant tools to chain and how to synthesize the result. Prompt
// arguments must be strings (MCP constraint).

function userText(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function registerAllPrompts(server: McpServer): void {
  server.registerPrompt(
    "analyze_ticker",
    {
      title: "Full ticker analysis",
      description:
        "Deep-dive one stock by chaining the Q-Score, ML, ownership, and edge tools into a single verdict.",
      argsSchema: { ticker: z.string().describe("Ticker symbol, e.g. NVDA") },
    },
    ({ ticker }) =>
      userText(
        `Produce a structured investment read on ${ticker} using StoQuant tools. Steps:\n` +
          `1. stoquant_get_qscore(${ticker}) — headline score, signal, and which dimensions drive it.\n` +
          `2. stoquant_get_ml_prediction(${ticker}) then stoquant_explain_ml_prediction(${ticker}) — outperformance odds vs the S&P and why.\n` +
          `3. stoquant_get_insider_trades(${ticker}) and stoquant_get_institutional_ratings(${ticker}) — is smart money accumulating?\n` +
          `4. stoquant_get_analyst_estimates(${ticker}) — consensus expectations.\n` +
          `5. stoquant_get_strategic_edges(${ticker}) — moats, risks, catalysts (may be empty for mega-caps).\n` +
          `If unsure how to read a field, consult the stoquant://glossary resource. Conclude with: overall stance (bullish/neutral/bearish), the 2-3 strongest supporting signals, the biggest risk, and the model's confidence. Note any data that was missing or heuristic.`,
      ),
  );

  server.registerPrompt(
    "explain_verdict",
    {
      title: "Explain a verdict (bull case vs bear case)",
      description:
        "Explain WHY a stock has its Q-Score using the named two-sided evidence, then cite how the score is computed. Mirrors the research page's verdict + methodology surface.",
      argsSchema: { ticker: z.string().describe("Ticker symbol, e.g. NVDA") },
    },
    ({ ticker }) =>
      userText(
        `Explain the StoQuant verdict on ${ticker} in plain English, backed by concrete evidence. Steps:\n` +
          `1. stoquant_get_qscore(${ticker}) — the headline score, signal, confidence, and dimensionContributions (which pillars drive it).\n` +
          `2. stoquant_get_evidence(${ticker}) — the named facts behind the score. Collect cells with tone 'bullish' as the BULL CASE and tone 'bearish' as the BEAR CASE across all five grids (momentum, sentiment, earnings, valuation, risk).\n` +
          `3. Read the stoquant://methodology resource so you can state, accurately, how the 0-100 composite is built (sector-residualized dimensions, rolling IC-based weights, no hand-tuning) — do not invent a formula.\n` +
          `Conclude with: the verdict in one sentence, a BULL CASE bullet list and a BEAR CASE bullet list (concrete facts, not scores), the single most important driver, and a one-line note on how the score was computed. If a bearish verdict lands on a heavily-shorted name, flag squeeze/reversal risk.`,
      ),
  );

  server.registerPrompt(
    "find_opportunities",
    {
      title: "Find opportunities",
      description:
        "Generate and vet a shortlist of ideas matching a style (value, momentum, growth, or hidden gems).",
      argsSchema: {
        style: z
          .string()
          .describe("Investing style: 'value', 'momentum', 'growth', 'hidden gems', or free text"),
      },
    },
    ({ style }) =>
      userText(
        `Find and vet stock ideas matching this style: "${style}". Steps:\n` +
          `1. stoquant_list_prebuilt_screens — pick the screen id that best matches the style (e.g. value -> undervalued-gems, momentum -> momentum-leaders, growth -> growth-explosion, hidden gems -> hidden-gems).\n` +
          `2. stoquant_run_prebuilt_screen with that id (or stoquant_run_screener with explicit camelCase filters if no prebuilt fits — see the tool's field list).\n` +
          `3. For the top 3-5 names, call stoquant_get_qscore to confirm conviction and filter out weak signals.\n` +
          `Return a ranked shortlist: ticker, why it fits the style, Q-Score/signal, and one risk each. Prefer prebuilt screens — they are pre-tuned and faster than custom full-universe scans.`,
      ),
  );

  server.registerPrompt(
    "market_briefing",
    {
      title: "Market briefing",
      description: "Top-down snapshot: regime, macro backdrop, benchmarks, and what the platform likes.",
      argsSchema: {},
    },
    () =>
      userText(
        `Give a concise top-down market briefing using StoQuant tools. Steps:\n` +
          `1. stoquant_get_market_regime — current regime and confidence (note if undetermined).\n` +
          `2. stoquant_get_macro_dashboard — regime, macro stress, sector rotation, and key indicators/calendar.\n` +
          `3. stoquant_get_benchmarks — how the major indices are doing today and YTD.\n` +
          `4. stoquant_get_top_conviction(limit=10) — what the platform's signals favor right now.\n` +
          `Synthesize into: market posture (risk-on/neutral/risk-off), the macro events to watch, leading/lagging sectors, and the 3-5 most interesting conviction names. Keep it tight.`,
      ),
  );

  server.registerPrompt(
    "compare_stocks",
    {
      title: "Compare two stocks head-to-head",
      description:
        "Side-by-side quantitative comparison of two tickers — Q-Scores, ML predictions, evidence, and analyst upside — with a final head-to-head verdict.",
      argsSchema: {
        ticker1: z.string().describe("First ticker, e.g. NVDA"),
        ticker2: z.string().describe("Second ticker, e.g. AMD"),
      },
    },
    ({ ticker1, ticker2 }) =>
      userText(
        `Compare ${ticker1} vs ${ticker2} side-by-side using StoQuant. Steps:\n` +
          `1. stoquant_get_qscore for both — headline score, signal, and top dimension contributors for each.\n` +
          `2. stoquant_get_evidence for both — strongest bull-case (tone:'bullish') and bear-case (tone:'bearish') facts for each.\n` +
          `3. stoquant_get_ml_prediction for both — outperformance probability vs the S&P for each.\n` +
          `4. stoquant_get_analyst_price_targets for both — consensus implied upside from analyst targets.\n` +
          `Synthesize into: (a) a comparison table — Q-Score, ML probability, analyst upside, and top 2 strong/weak dimensions for each name; (b) 1-2 specific factors where each ticker has a genuine edge; (c) a head-to-head verdict — which looks stronger on a risk-adjusted basis and why. Flag any major red flags or heavy short interest for either name.`,
      ),
  );
}
