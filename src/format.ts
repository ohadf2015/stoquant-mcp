/** Strip API keys and bearer tokens from strings that may reach MCP output or logs. */
export function redactSecrets(s: string): string {
  return s
    .replace(/\bsk_(live|test)_[A-Za-z0-9_\-]+/g, "sk_$1_[REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
}

export function asTextResult(payload: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }] };
}

export function asErrorResult(err: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const msg = redactSecrets(err instanceof Error ? err.message : String(err));
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}
