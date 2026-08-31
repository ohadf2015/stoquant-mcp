import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_TOOLS } from "./index.js";

const REQUIRED = [
  "stoquant_get_accuracy_summary",
  "stoquant_get_auto_portfolio_status",
  "stoquant_get_auto_portfolio_history",
  "stoquant_get_portfolio_health",
  "stoquant_optimize_portfolio",
  "stoquant_list_backtest_templates",
  "stoquant_run_backtest",
  "stoquant_get_backtest",
  "stoquant_get_backtest_history",
  "stoquant_get_strategy_performance",
  "stoquant_list_strategy_presets",
  "stoquant_get_strategy_preset_candidates",
  "stoquant_get_unusual_options",
];

const FORBIDDEN = [
  "stoquant_evaluate_auto_portfolio",
  "stoquant_execute_trade",
  "stoquant_rebalance",
  "stoquant_apply_preset",
  "stoquant_reset_drawdown",
  "stoquant_force_heal",
];

test("new portfolio/backtest/strategy tools are registered", () => {
  const names = ALL_TOOLS.map((t) => t.name);
  for (const n of REQUIRED) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
});

test("trade-execution tools are not registered", () => {
  const names = ALL_TOOLS.map((t) => t.name);
  for (const n of FORBIDDEN) {
    assert.ok(!names.includes(n), `must not expose ${n}`);
  }
  assert.ok(!names.some((n) => /execute_trade|evaluate_auto_portfolio|rebalance/.test(n)));
});

test("accuracy summary description warns about hitRate and no_edge", () => {
  const t = ALL_TOOLS.find((x) => x.name === "stoquant_get_accuracy_summary");
  assert.ok(t);
  assert.match(t.description, /excessSpreadPp/);
  assert.match(t.description, /dataSufficient/);
  assert.match(t.description, /independentWindows/);
  assert.match(t.description, /hitRate/);
  assert.match(t.description, /not treat hitRate as skill|do NOT treat hitRate as skill/i);
  assert.match(t.description, /no_edge/);
});

test("run_backtest is marked non-readOnly (persists a run, still no orders)", () => {
  const t = ALL_TOOLS.find((x) => x.name === "stoquant_run_backtest");
  assert.ok(t);
  assert.equal(t.annotations?.readOnlyHint, false);
});
