# stoquant-mcp

[![npm version](https://img.shields.io/npm/v/stoquant-mcp.svg)](https://www.npmjs.com/package/stoquant-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-io.github.ohadf2015%2Fstoquant--mcp-blue)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tools](https://img.shields.io/badge/tools-48_read--only-orange.svg)](https://stoquant.com/mcp)

Model Context Protocol (MCP) server for **StoQuant** — gives Claude (and any MCP-compatible agent) direct, read-only access to StoQuant's quant signals, ML predictions, screening, ownership, and macro data.

> **Free to start.** A free StoQuant API key runs the core tools (quotes, Q-Score, screeners, market regime) at 100 requests/day. Power removes the cap and unlocks the premium tools (ML, alt-data, insider clustering). Get a key at https://stoquant.com/account/api-keys.

**Source & listings:** [GitHub](https://github.com/ohadf2015/stoquant-mcp) · [npm](https://www.npmjs.com/package/stoquant-mcp) · [Official MCP Registry](https://registry.modelcontextprotocol.io) (`io.github.ohadf2015/stoquant-mcp`) · [Landing page](https://stoquant.com/mcp)

## One-command install

```bash
npx -y stoquant-mcp install
```

You'll be prompted for your API key. The installer writes the right `claude_desktop_config.json` for your OS, backs up any existing config, then prints the next step.

After install, **fully quit and relaunch Claude Desktop**. Type `list available tools` to confirm the `stoquant_*` tools are loaded.

### Manual install (alternative)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stoquant": {
      "command": "npx",
      "args": ["-y", "stoquant-mcp", "serve"],
      "env": {
        "STOQUANT_API_KEY": "sk_live_…"
      }
    }
  }
}
```

Config locations:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## Tools (48)

| Category | Tools |
|---|---|
| **Prices** | `get_quote`, `get_quotes_batch`, `get_extended_quote`, `get_sparklines`, `get_benchmarks`, `get_sector_performers` |
| **Research** | `get_qscore`, `get_signals_v2`, `get_ml_prediction`, `explain_ml_prediction`, `get_strategic_edges`, `get_quant_analytics` |
| **Signals** | `get_market_regime`, `get_signal_accuracy`, `get_accuracy_summary` |
| **Discovery** | `get_top_conviction`, `get_hidden_gems`, `get_multibagger_candidates`, `get_related_stocks`, `get_signal_accuracy_heatmap` |
| **Screener** | `list_prebuilt_screens`, `run_prebuilt_screen`, `run_screener` |
| **Ownership** | `get_insider_trades`, `get_insider_cluster`, `get_big_insider_buys`, `get_institutional_holders`, `get_institutional_ratings`, `get_analyst_estimates`, `get_analyst_price_targets`, `get_analyst_changes`, `get_short_interest` |
| **Filings & News** | `get_sec_filings`, `get_news`, `get_news_events` |
| **Social** | `get_social_sentiment`, `get_social_trend`, `get_trending_social`, `get_social_momentum`, `get_source_credibility` |
| **Catalysts** | `get_catalysts`, `get_catalyst_watch` |
| **Alt-data** | `get_alt_signals` (FDA, CPSC, SEC suite, clinical trials, GitHub, App Store, Hacker News, news tone — one call), `get_alt_data` (Google Trends, Wikipedia views, options IV) |
| **Macro** | `get_macro_indicator`, `get_macro_dashboard`, `get_macro_calendar`, `get_macro_themes` |

All tools are read-only. No mutation, no portfolio changes, no order placement. Each tool is annotated `readOnlyHint` so agents know it is safe to call.

### Two things to know

- **The Q-Score** (`get_qscore`) is the headline 0-100 composite, computed on *sector-residualized* returns (sector beta removed). Start here for "is this a good stock".
- **The ML prediction** (`get_ml_prediction`) returns the *probability of outperforming the S&P 500* over a horizon (`classification: bull|bear`) — it is **not** a buy/hold/sell rating.

## Resources

The server exposes reference docs an agent can read on demand:

- `stoquant://glossary` — what Q-Score, ML outperformance, regimes, and signal accuracy mean, plus unit conventions.
- `stoquant://methodology` — sector residualization, IC-weighting, ML health gating, and screener field semantics.

## Prompts

Pre-built workflows that chain the tools:

- `analyze_ticker(ticker)` — full single-stock deep dive (Q-Score + ML + ownership + edges → verdict).
- `find_opportunities(style)` — generate and vet a shortlist for a style (value, momentum, growth, hidden gems).
- `market_briefing` — top-down snapshot (regime + macro + benchmarks + conviction).

## Using the screener

`run_screener` filters on **exact camelCase field names**. An unknown field is treated as null server-side and silently excludes every stock, so use the documented names:

`trailingPE`, `priceToBook`, `pegRatio`, `marketCap`, `debtToEquity`, `currentRatio`, `grossMargins`, `operatingMargins`, `revenueGrowth`, `earningsGrowth`, `rsi14`, `fiftyDayAverageChangePercent`, `twoHundredDayAverageChangePercent`, `fiftyTwoWeekHighChangePercent`, `shortPercentOfFloat`, `numberOfAnalystOpinions`, `sector`, `regularMarketPrice`, `regularMarketVolume`, `regularMarketChangePercent`.

Margins/growth are decimals (`0.25` = 25%); `marketCap` is raw USD (`250000000` = 250M). Operators: `gt`, `gte`, `lt`, `lte`, `eq`, `between` (`value: [low, high]`), `in` (`value: [string, …]`).

The screener reads from StoQuant's cached daily fundamentals (fast, refreshed daily). **Prefer `run_prebuilt_screen`** (pre-tuned) or `run_screener` with `universe: "sp500"` and a few filters.

## Example prompts

- "Get the Q-Score for NVDA and explain the top features driving the ML call."
- "Show me the top 10 conviction stocks and their current ML outperformance odds."
- "What's the current market regime, and which sectors are leading?"
- "Run the undervalued-gems prebuilt screen on the sp500 universe."
- "Screen sp500 for trailingPE under 15 and debtToEquity under 0.5."
- "Get insider activity for PLTR over the last quarter."

## Security

- Server requires `STOQUANT_API_KEY` — fails fast on boot if missing or malformed.
- All requests use HTTPS. Bearer token in `Authorization` header. Never logged.
- Tickers are validated (`^[A-Za-z0-9.\-^]{1,10}$`) before any external use.
- Client-side rate limit: 200 req/min (configurable via `STOQUANT_RATE_LIMIT_RPM`).
- 30s per-request timeout (configurable via `STOQUANT_TIMEOUT_MS`).
- Server-side: API key is hashed (SHA-256) at rest, prefix-indexed for fast lookup, timing-safe-compared on verify.
- Revoke any key from https://stoquant.com/account/api-keys at any time.

## Environment variables

| Var | Default | Description |
|---|---|---|
| `STOQUANT_API_KEY` | — (required) | Your StoQuant API key (free or Power tier) |
| `STOQUANT_BASE_URL` | `https://stoquant.com/api` | API base URL |
| `STOQUANT_RATE_LIMIT_RPM` | `200` | Client-side rate limit (req/min) |
| `STOQUANT_TIMEOUT_MS` | `30000` | Per-request timeout |
| `STOQUANT_DEV` | `0` | Set `1` to allow `http://` base URLs (local dev only) |

## License

MIT
