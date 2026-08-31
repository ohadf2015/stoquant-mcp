/**
 * Join STOQUANT_BASE_URL (default https://stoquant.com/api) with a path.
 * Public unauthenticated routes live at the site origin (`/public/...`), not
 * under `/api`, so strip a trailing `/api` for those paths.
 */
export function resolveRequestUrl(baseUrl: string, path: string): string {
  if (!path.startsWith("/")) throw new Error("path must start with /");
  const base = path.startsWith("/public/") ? baseUrl.replace(/\/api$/i, "") : baseUrl;
  return base + path;
}
