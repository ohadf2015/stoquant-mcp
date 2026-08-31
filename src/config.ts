const DEFAULT_BASE_URL = "https://stoquant.com/api";

export interface Config {
  baseUrl: string;
  apiKey: string;
  userAgent: string;
  requestTimeoutMs: number;
  maxRequestsPerMinute: number;
}

function isAllowedStoquantHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "stoquant.com" || host.endsWith(".stoquant.com");
}

/**
 * Parse STOQUANT_BASE_URL. Always reject embedded credentials. Unless
 * STOQUANT_DEV=1, require https and pin the hostname to stoquant.com or a
 * subdomain. Error messages must not echo the raw URL (it may contain secrets).
 */
function parseBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("STOQUANT_BASE_URL is not a valid URL.");
  }

  if (url.username !== "" || url.password !== "") {
    throw new Error("STOQUANT_BASE_URL must not include a username or password.");
  }

  const allowDev = process.env.STOQUANT_DEV === "1";

  if (url.protocol !== "https:" && !(allowDev && url.protocol === "http:")) {
    throw new Error(
      "STOQUANT_BASE_URL must use https://. Set STOQUANT_DEV=1 to allow http for local dev.",
    );
  }

  if (!allowDev && !isAllowedStoquantHost(url.hostname)) {
    throw new Error(
      "STOQUANT_BASE_URL hostname must be stoquant.com or a subdomain of stoquant.com. Set STOQUANT_DEV=1 to override.",
    );
  }

  // origin excludes userinfo; drop query/hash; strip trailing slashes from path
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

export function loadConfig(): Config {
  const rawBase = parseBaseUrl(process.env.STOQUANT_BASE_URL ?? DEFAULT_BASE_URL);
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
