import type { Config } from "./config.js";
import { redactSecrets } from "./format.js";
import { bucketForRpm, TokenBucket } from "./rate-limit.js";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | string[] | undefined>;
  body?: unknown;
  method?: "GET" | "POST";
}

export class StoQuantClient {
  private readonly bucket: TokenBucket;

  constructor(private readonly config: Config) {
    this.bucket = bucketForRpm(config.maxRequestsPerMinute);
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    if (!path.startsWith("/")) throw new Error("path must start with /");
    await this.bucket.take();

    const url = this.buildUrl(path, opts.query);
    const method = opts.method ?? "GET";
    const headers: Record<string, string> = {
      "User-Agent": this.config.userAgent,
      Accept: "application/json",
    };
    // No key is a supported (degraded) mode — send no header at all rather than `Bearer `, which
    // the API reads as a malformed credential instead of an anonymous request.
    if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error(
          `Request to ${redactPath(path)} timed out after ${this.config.requestTimeoutMs}ms. ` +
            `This endpoint (ML predictions and full-universe screens are the usual culprits) is slow right now. ` +
            `Retry once, narrow the request (universe=sp500, fewer filters, a prebuilt screen), or raise STOQUANT_TIMEOUT_MS.`,
        );
      }
      throw new Error(`Network error calling ${redactPath(path)}: ${redactSecrets((err as Error).message)}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await safeReadText(res);
      throw new Error(
        redactSecrets(explainHttpError(res.status, res.statusText, redactPath(path), body, Boolean(this.config.apiKey))),
      );
    }
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON response from ${redactPath(path)}`);
    }
  }

  private buildUrl(path: string, query: RequestOptions["query"]): string {
    const url = new URL(this.config.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v == null) continue;
        if (Array.isArray(v)) url.searchParams.set(k, v.join(","));
        else url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function redactPath(p: string): string {
  let out = p;
  try {
    const u = new URL(p);
    u.username = "";
    u.password = "";
    u.search = "";
    u.hash = "";
    out = `${u.origin}${u.pathname}`;
  } catch {
    out = p.replace(/[?#].*$/, "");
  }
  return redactSecrets(out);
}

/**
 * Turn an HTTP failure into a message an agent can act on, rather than a bare
 * status line. The goal is to let the model recover (retry, escalate tier,
 * fix params, pick another ticker) instead of looping on an opaque error.
 */
export function explainHttpError(
  status: number,
  statusText: string,
  path: string,
  body: string,
  hasKey: boolean,
): string {
  const detail = body ? ` Server said: ${truncate(redactSecrets(body), 300)}` : "";
  switch (status) {
    case 400:
      return `Bad request to ${path} (400). One or more parameters are wrong — re-check field names, enum values, and types against the tool schema before retrying.${detail}`;
    case 401:
      return hasKey
        ? `Authentication failed for ${path} (401). STOQUANT_API_KEY is set but malformed, expired, or revoked. Re-issue it at https://stoquant.com/account/api-keys. Do not retry until the key is fixed.`
        : `${path} needs an API key (401). The key is FREE — $0/month, no credit card, 100 requests/day: sign up at https://stoquant.com/pricing, mint it at https://stoquant.com/account/api-keys, then run \`npx stoquant-mcp install\` (or set STOQUANT_API_KEY). Tell the user that in one line and stop — without a key this call cannot succeed.`;
    case 403:
      return `Forbidden for ${path} (403). The key is valid but this data sits above the current plan. Pro ($29/mo) adds the full hidden-gem screener, unlimited custom screens, watchlists and alerts; Power ($79/mo) adds ML alpha scores across 3,500+ stocks, Black-Litterman optimization, HMM regime probabilities and 10-K risk-factor analysis. Upgrade: https://stoquant.com/pricing. Retrying will not help — name the tier this tool needs and move on.${detail}`;
    case 404:
      return `Not found for ${path} (404). The ticker, series, or screen id likely does not exist or has no data yet. Verify the symbol/id; do not retry the same value.${detail}`;
    case 429:
      return `Rate limited for ${path} (429). On a Free key this is usually the 100 requests/day allowance — Pro ($29/mo) and Power ($79/mo) raise it: https://stoquant.com/pricing. Otherwise back off a few seconds and avoid bursts; batch tools (quotes/sparklines, up to 50 tickers) cut request count.${detail}`;
    case 408:
    case 504:
      return `Request to ${path} timed out (${status}). This usually means an expensive query (e.g. a full-universe screener scan). Retry once; if it persists, narrow the request (universe=sp500 instead of full, fewer filters) or use a prebuilt screen.`;
    default:
      if (status >= 500) {
        return `StoQuant API error for ${path} (${status} ${statusText}). The service is temporarily unavailable. Retry after a short delay.${detail}`;
      }
      return `StoQuant API ${status} ${statusText} for ${path}.${detail}`;
  }
}
