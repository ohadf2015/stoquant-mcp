import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StoQuantClient } from "../client.js";
import { asErrorResult, asTextResult } from "../format.js";
import type { AnyToolDef } from "../registry.js";
import { altDataTools } from "./altdata.js";
import { catalystTools } from "./catalysts.js";
import { discoveryTools } from "./discovery.js";
import { filingsTools } from "./filings.js";
import { macroTools } from "./macro.js";
import { ownershipTools } from "./ownership.js";
import { priceTools } from "./prices.js";
import { researchTools } from "./research.js";
import { screenerTools } from "./screener.js";
import { signalTools } from "./signals.js";
import { socialTools } from "./social.js";

/** Every StoQuant tool, in a stable, category-grouped order. */
export const ALL_TOOLS: AnyToolDef[] = [
  ...priceTools,
  ...researchTools,
  ...signalTools,
  ...discoveryTools,
  ...screenerTools,
  ...ownershipTools,
  ...macroTools,
  ...filingsTools,
  ...socialTools,
  ...catalystTools,
  ...altDataTools,
];

export function findTool(name: string): AnyToolDef | undefined {
  const candidates = [name, `stoquant_${name}`, name.replace(/^stoquant_/, "")];
  return ALL_TOOLS.find((def) => candidates.includes(def.name));
}

export function registerAllTools(server: McpServer, client: StoQuantClient): void {
  for (const def of ALL_TOOLS) {
    server.registerTool(
      def.name,
      {
        title: def.title ?? def.name,
        description: def.description,
        inputSchema: def.schema,
        // Every StoQuant tool is a read-only fetch from the external API.
        annotations: {
          title: def.title ?? def.name,
          readOnlyHint: true,
          openWorldHint: true,
          ...def.annotations,
        },
      },
      async (args: unknown) => {
        try {
          // The SDK validates against inputSchema, but re-parse defensively so
          // defaults/coercion are applied consistently for every tool.
          const parsed = z.object(def.schema).parse(args ?? {});
          const data = await def.handler(parsed, client);
          return asTextResult(data);
        } catch (err) {
          return asErrorResult(err);
        }
      },
    );
  }
}
