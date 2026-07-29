const TICKER_RE = /^[A-Za-z0-9.\-^]{1,10}$/;
const FRED_SERIES_RE = /^[A-Za-z0-9_]{1,32}$/;
const SECTOR_RE = /^[A-Za-z0-9 &/_\-]{1,40}$/;
const SCREEN_ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;

export function assertTicker(t: string): string {
  const v = t.trim().toUpperCase();
  if (!TICKER_RE.test(v)) throw new Error(`Invalid ticker: must match ${TICKER_RE.source}`);
  return v;
}

export function assertTickers(arr: string[], cap = 50): string[] {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("tickers must be a non-empty array");
  if (arr.length > cap) throw new Error(`tickers length ${arr.length} exceeds cap ${cap}`);
  return arr.map(assertTicker);
}

export function assertFredSeries(s: string): string {
  const v = s.trim().toUpperCase();
  if (!FRED_SERIES_RE.test(v)) throw new Error(`Invalid FRED series id`);
  return v;
}

export function assertSector(s: string): string {
  const v = s.trim();
  if (!SECTOR_RE.test(v)) throw new Error(`Invalid sector name`);
  return v;
}

export function assertScreenId(s: string): string {
  const v = s.trim();
  if (!SCREEN_ID_RE.test(v)) throw new Error(`Invalid screen id`);
  return v;
}

export function clampLimit(n: number | undefined, max: number, def: number): number {
  if (n == null) return def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

// ---------------------------------------------------------------------------
// Screener field validation
//
// Footgun being fixed: the API treats an unknown filter field as null, which
// excludes every stock and returns an EMPTY array with NO error. The model then
// reports "no matches" for what is really a typo (e.g. `peRatio` instead of
// `trailingPE`). We validate field names at the MCP boundary and throw an
// actionable error with a nearest-match suggestion instead of a silent zero.
// Keep these lists in lockstep with src/api/routes/screener.ts and FIELD_HELP.
// ---------------------------------------------------------------------------

// CANONICAL source: src/screener/types.ts TIER1_FIELDS + TIER2_FIELDS (the
// ScreenableField union). ScreenerService accepts exactly this set as filter
// fields; anything else partitions to nothing and matches zero stocks. Mirror
// the full union here so the guard never rejects a genuinely-valid field.
/** Every field accepted in a screener filter condition. */
export const SCREENER_FILTER_FIELDS = [
  // Tier 1 — quote-level
  "trailingPE", "forwardPE", "priceToBook", "marketCap",
  "epsTrailingTwelveMonths", "dividendYield", "bookValue", "regularMarketPrice",
  "fiftyDayAverage", "twoHundredDayAverage", "fiftyDayAverageChangePercent",
  "twoHundredDayAverageChangePercent", "regularMarketChangePercent",
  "fiftyTwoWeekHighChangePercent", "regularMarketVolume",
  "averageDailyVolume3Month", "sector", "industry",
  // Tier 2 — quoteSummary / computed-from-history
  "rsi14", "twentyDayAverageChangePercent", "oneHundredFiftyDayAverageChangePercent",
  "shortPercentOfFloat", "grossMargins", "operatingMargins", "profitMargins",
  "returnOnEquity", "returnOnAssets", "debtToEquity", "revenueGrowth",
  "earningsGrowth", "pegRatio", "currentRatio", "numberOfAnalystOpinions",
] as const;

/**
 * Computed overlays valid only as a sortField (not filterable — they are
 * derived post-filter). Documented for the model; sortField itself is NOT
 * validated, because an unknown sortField only yields unsorted output, not the
 * silent-zero-match footgun this guard exists to prevent.
 */
export const SCREENER_SORT_ONLY_FIELDS = [
  "valueScore", "qScore", "marginOfSafety", "mlProbability",
] as const;

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function nearestField(field: string, candidates: readonly string[]): string | null {
  const lower = field.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  // Only suggest when it is a plausible typo, not a wild guess.
  return best != null && bestDist <= Math.max(3, Math.ceil(field.length / 2)) ? best : null;
}

/**
 * Validate a screener FILTER field name. Throws an actionable Error (with a
 * nearest valid-field suggestion) when unknown, so a typo surfaces as a clear
 * message instead of a silent empty result.
 */
export function assertScreenerField(field: string): string {
  const f = field.trim();
  if ((SCREENER_FILTER_FIELDS as readonly string[]).includes(f)) return f;
  const suggestion = nearestField(f, SCREENER_FILTER_FIELDS);
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
  throw new Error(
    `Unknown screener filter field "${field}".${hint} ` +
      `An unknown filter field silently matches zero stocks, so this is rejected. ` +
      `Valid filter fields (case-sensitive): ${SCREENER_FILTER_FIELDS.join(", ")}.`,
  );
}
