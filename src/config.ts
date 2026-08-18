const DEFAULT_BASE_URL = "https://stoquant.com/api";

export interface Config {
  baseUrl: string;
  apiKey: string;
  userAgent: string;
  requestTimeoutMs: number;
  maxRequestsPerMinute: number;
}

export function loadConfig(): Config {
  const rawBase = (process.env.STOQUANT_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (!rawBase.startsWith("https://") && process.env.STOQUANT_DEV !== "1") {
    throw new Error(
      `STOQUANT_BASE_URL must use https:// (got: ${rawBase}). Set STOQUANT_DEV=1 to allow http for local dev.`,
    );
  }
  // The key is NOT Power-tier-only: stoquant.com/pricing sells a Free plan at $0 with 100 API
  // requests/day and no credit card. Saying "Power tier required" here (and crashing on a missing
  // key) told every free user the server was not for them — the 87% signup→activated-key cliff.
  // Measured 2026-08-18: only 2 of 47 endpoints answer without a key (/gems, /scrape-signals/
  // catalyst-watch), so booting keyless is deliberately allowed but degraded, not the happy path.
  const apiKey = process.env.STOQUANT_API_KEY?.trim() ?? "";
  if (apiKey && !/^sk_(live|test)_[A-Za-z0-9_\-]{16,}$/.test(apiKey)) {
    throw new Error(
      "STOQUANT_API_KEY format invalid. Expected `sk_live_…` or `sk_test_…`. Re-issue at https://stoquant.com/account/api-keys.",
    );
  }
  // 30s default: ML predictions and full-universe screens can take 15-25s on a
  // cold cache; 15s tripped the abort timer before the server could respond.
  const timeout = Number.parseInt(process.env.STOQUANT_TIMEOUT_MS ?? "30000", 10);
  const rpm = Number.parseInt(process.env.STOQUANT_RATE_LIMIT_RPM ?? "200", 10);

  return {
    baseUrl: rawBase,
    apiKey,
    userAgent: `stoquant-mcp/${process.env.npm_package_version ?? "0.3.0"} (+https://stoquant.com)`,
    requestTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000,
    maxRequestsPerMinute: Number.isFinite(rpm) && rpm > 0 ? rpm : 200,
  };
}
