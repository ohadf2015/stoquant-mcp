import assert from "node:assert/strict";
import { test } from "node:test";
import { portfolioTools } from "./portfolio.js";
import { backtestTools } from "./backtest.js";
import { strategyTools } from "./strategy.js";
import type { StoQuantClient } from "../client.js";

type Call = { path: string; opts?: { method?: string; query?: unknown; body?: unknown } };

function mockClient(calls: Call[]): StoQuantClient {
  return {
    request: async (path: string, opts?: Call["opts"]) => {
      calls.push({ path, opts });
      return { ok: true, path };
    },
  } as unknown as StoQuantClient;
}

function tool(tools: { name: string; handler: Function }[], name: string) {
  const t = tools.find((x) => x.name === name);
  assert.ok(t, `missing tool ${name}`);
  return t;
}

test("get_auto_portfolio_status hits eval-status and diagnostics, never evaluate", async () => {
  const calls: Call[] = [];
  const t = tool(portfolioTools, "stoquant_get_auto_portfolio_status");
  await t.handler({ portfolioId: 7 }, mockClient(calls));
  const paths = calls.map((c) => c.path).sort();
  assert.deepEqual(paths, ["/auto-portfolio/diagnostics", "/auto-portfolio/eval-status"]);
  assert.ok(calls.every((c) => (c.opts?.method ?? "GET") === "GET"));
  assert.ok(calls.every((c) => !c.path.includes("evaluate")));
});

test("get_auto_portfolio_history is a GET with limit clamp", async () => {
  const calls: Call[] = [];
  const t = tool(portfolioTools, "stoquant_get_auto_portfolio_history");
  await t.handler({ portfolioId: 2, limit: 9999 }, mockClient(calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/auto-portfolio/history");
  assert.equal((calls[0].opts?.query as { limit: number }).limit, 1000);
});

test("get_portfolio_health hits the system health GET", async () => {
  const calls: Call[] = [];
  await tool(portfolioTools, "stoquant_get_portfolio_health").handler({}, mockClient(calls));
  assert.deepEqual(calls.map((c) => c.path), ["/portfolio-health"]);
});

test("optimize_portfolio POSTs weights-only black-litterman", async () => {
  const calls: Call[] = [];
  await tool(portfolioTools, "stoquant_optimize_portfolio").handler(
    { tickers: ["aapl", "msft"], method: "black-litterman" },
    mockClient(calls),
  );
  assert.equal(calls[0].path, "/risk/portfolio-optimize");
  assert.equal(calls[0].opts?.method, "POST");
  const body = calls[0].opts?.body as { tickers: string[]; method: string };
  assert.deepEqual(body.tickers, ["AAPL", "MSFT"]);
  assert.equal(body.method, "black-litterman");
});

test("run_backtest POSTs /backtest/run and rejects inverted dates", async () => {
  const calls: Call[] = [];
  const t = tool(backtestTools, "stoquant_run_backtest");
  await t.handler(
    { strategyId: "momentum", startDate: "2024-01-01", endDate: "2024-12-31", universe: "sp500" },
    mockClient(calls),
  );
  assert.equal(calls[0].path, "/backtest/run");
  assert.equal(calls[0].opts?.method, "POST");
  await assert.rejects(
    () =>
      t.handler(
        { strategyId: "momentum", startDate: "2024-12-31", endDate: "2024-01-01" },
        mockClient([]),
      ),
    /startDate must be before endDate/,
  );
});

test("get_backtest and templates are GETs", async () => {
  const calls: Call[] = [];
  const client = mockClient(calls);
  await tool(backtestTools, "stoquant_get_backtest").handler({ id: 42 }, client);
  await tool(backtestTools, "stoquant_list_backtest_templates").handler({}, client);
  await tool(backtestTools, "stoquant_get_backtest_history").handler({ strategyId: "value" }, client);
  assert.equal(calls[0].path, "/backtest/results/42");
  assert.equal(calls[1].path, "/backtest/templates");
  assert.equal(calls[2].path, "/backtest/history");
});

test("strategy performance and presets are GETs, never rebalance", async () => {
  const calls: Call[] = [];
  const client = mockClient(calls);
  await tool(strategyTools, "stoquant_get_strategy_performance").handler(
    { portfolioId: 3, view: "risk-metrics" },
    client,
  );
  await tool(strategyTools, "stoquant_list_strategy_presets").handler({}, client);
  await tool(strategyTools, "stoquant_get_strategy_preset_candidates").handler(
    { presetId: "insider" },
    client,
  );
  assert.equal(calls[0].path, "/strategy-performance/risk-metrics");
  assert.equal(calls[1].path, "/strategy-presets");
  assert.equal(calls[2].path, "/strategy-presets/insider/candidates");
  assert.ok(calls.every((c) => !/rebalance|evaluate|execute/.test(c.path)));
});

test("no portfolio/backtest/strategy tool wraps evaluate or execute-trade", () => {
  const names = [...portfolioTools, ...backtestTools, ...strategyTools].map((t) => t.name);
  assert.ok(!names.some((n) => /evaluate|execute|rebalance|apply_preset/.test(n)));
});
