import { z } from "zod";
import type { StoQuantClient } from "./client.js";

/** MCP tool behavior hints surfaced to the calling agent. */
export interface ToolAnnotations {
  title?: string;
  /** Tool does not mutate state. All StoQuant tools are read-only. */
  readOnlyHint?: boolean;
  /** Tool reaches an external system (the StoQuant API). */
  openWorldHint?: boolean;
  /** Repeated identical calls return the same result (modulo fresh market data). */
  idempotentHint?: boolean;
}

export interface ToolDef<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  /** Human-facing title shown in tool pickers; defaults to `name`. */
  title?: string;
  description: string;
  schema: S;
  annotations?: ToolAnnotations;
  handler: (args: z.infer<z.ZodObject<S>>, client: StoQuantClient) => Promise<unknown>;
}

export type AnyToolDef = ToolDef<z.ZodRawShape>;

export function defineTool<S extends z.ZodRawShape>(def: ToolDef<S>): AnyToolDef {
  return def as unknown as AnyToolDef;
}
