#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StoQuantClient } from "./client.js";
import { loadConfig } from "./config.js";
import { runInstall } from "./install.js";
import { registerAllPrompts } from "./prompts.js";
import { registerAllResources } from "./resources.js";
import { registerAllTools } from "./tools/index.js";

const SERVER_INSTRUCTIONS = `StoQuant exposes read-only US-equity quant signals, ML predictions, screening, ownership, and macro data. All tools are safe to call (no mutation, no trading).

How to use it well:
- For "is this stock good?" start with stoquant_get_qscore (0-100 composite, sector-residualized), then stoquant_get_ml_prediction (probability of OUTPERFORMING the S&P, not a buy/hold/sell rating) and ownership tools. The analyze_ticker prompt chains these.
- For idea generation, prefer stoquant_list_prebuilt_screens + stoquant_run_prebuilt_screen over hand-built filters. Custom stoquant_run_screener needs EXACT camelCase field names (trailingPE, marketCap, debtToEquity, ...) — an unknown field silently returns zero matches. Full-universe scans can time out; prefer universe=sp500.
- For the differentiated alt-data edge, use stoquant_get_alt_signals (one call returns FDA, CPSC recalls, the full SEC filing suite, clinical trials, GitHub, App Store, Hacker News, news tone), plus stoquant_get_sec_filings, stoquant_get_news_events, stoquant_get_social_sentiment, stoquant_get_short_interest, stoquant_get_insider_cluster, and stoquant_get_catalysts. These surface catalysts and red flags an ordinary price/fundamentals feed misses.
- For top-down context, use stoquant_get_market_regime + stoquant_get_macro_dashboard (the market_briefing prompt does this).
- Batch quotes/sparklines accept up to 50 tickers in one call — use them instead of looping.
- Read the stoquant://glossary and stoquant://methodology resources to interpret fields, units (margins/growth are decimals; marketCap is raw USD), and caveats correctly.
- Errors are actionable: 401 = fix the API key, 403 = plan lacks access, 404 = bad ticker/id, 429 = back off, 504 = query too heavy (narrow it).`;

const HELP = `stoquant-mcp — Model Context Protocol server for StoQuant (Power tier).

Usage:
  npx stoquant-mcp install   Configure Claude Desktop with your API key (one-shot setup)
  npx stoquant-mcp serve     Start the MCP server over stdio (default; used by Claude Desktop)
  npx stoquant-mcp --help    Show this help

Environment:
  STOQUANT_API_KEY        Required. Power-tier API key (sk_live_… or sk_test_…)
  STOQUANT_BASE_URL       Override API base (default: https://stoquant.com/api)
  STOQUANT_RATE_LIMIT_RPM Client-side rate limit, requests/min (default: 200)
  STOQUANT_TIMEOUT_MS     Per-request timeout (default: 30000)

Get a key: https://stoquant.com/account/api-keys
`;

async function serve(): Promise<void> {
  const config = loadConfig();
  const client = new StoQuantClient(config);

  const server = new McpServer(
    {
      name: "stoquant-mcp",
      version: "0.5.3",
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerAllTools(server, client);
  registerAllResources(server);
  registerAllPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[stoquant-mcp] connected. base=${config.baseUrl} rpm=${config.maxRequestsPerMinute}\n`,
  );
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "serve";
  switch (cmd) {
    case "install":
      await runInstall();
      return;
    case "serve":
      await serve();
      return;
    case "-h":
    case "--help":
    case "help":
      process.stdout.write(HELP);
      return;
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`[stoquant-mcp] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
