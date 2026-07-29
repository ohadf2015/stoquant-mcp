import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

const KEY_RE = /^sk_(live|test)_[A-Za-z0-9_\-]{16,}$/;

interface ClaudeDesktopConfig {
  mcpServers?: Record<
    string,
    { command: string; args?: string[]; env?: Record<string, string> }
  >;
  [k: string]: unknown;
}

function claudeDesktopConfigPath(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32": {
      const appdata = process.env.APPDATA ?? join(home, "AppData", "Roaming");
      return join(appdata, "Claude", "claude_desktop_config.json");
    }
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function runInstall(): Promise<void> {
  const out = process.stdout;
  out.write("\nStoQuant MCP — one-shot installer\n");
  out.write("---------------------------------\n");
  out.write("This will register stoquant-mcp with Claude Desktop using your Power-tier API key.\n");
  out.write("Get your key at: https://stoquant.com/account/api-keys\n\n");

  const fromEnv = process.env.STOQUANT_API_KEY?.trim();
  let apiKey = fromEnv ?? "";
  if (!apiKey) {
    apiKey = await prompt("Paste your STOQUANT_API_KEY (sk_live_… or sk_test_…): ");
  }
  if (!KEY_RE.test(apiKey)) {
    process.stderr.write(
      `\nKey format invalid (expected sk_live_… or sk_test_…). Aborting; nothing written.\n`,
    );
    process.exit(2);
  }

  const cfgPath = claudeDesktopConfigPath();
  const cfgDir = dirname(cfgPath);
  if (!existsSync(cfgDir)) {
    mkdirSync(cfgDir, { recursive: true });
  }

  let cfg: ClaudeDesktopConfig = {};
  if (existsSync(cfgPath)) {
    try {
      const raw = readFileSync(cfgPath, "utf8");
      cfg = raw.trim() ? (JSON.parse(raw) as ClaudeDesktopConfig) : {};
    } catch (err) {
      process.stderr.write(
        `\nExisting config at ${cfgPath} is not valid JSON: ${(err as Error).message}\nAborting to avoid corruption.\n`,
      );
      process.exit(2);
    }
    const backup = cfgPath + ".stoquant-bak";
    copyFileSync(cfgPath, backup);
    out.write(`\nBackup of existing config: ${backup}\n`);
  }

  cfg.mcpServers ??= {};
  cfg.mcpServers["stoquant"] = {
    command: "npx",
    args: ["-y", "stoquant-mcp", "serve"],
    env: { STOQUANT_API_KEY: apiKey },
  };

  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });

  out.write(`\n✓ Wrote: ${cfgPath}\n`);
  out.write(`✓ Server registered as "stoquant" with ${Object.keys(cfg.mcpServers).length} total MCP server(s).\n`);
  out.write(`\nNext step: fully quit and relaunch Claude Desktop. The stoquant tools will appear in the MCP picker.\n`);
  out.write(`\nVerify with: 'list available tools' inside Claude Desktop.\n`);
}
