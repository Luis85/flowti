/**
 * agent-brief.ts — Re-exports from brief-store.ts (the single brief service).
 *
 * All brief generation, storage, and lifecycle operations are in brief-store.ts.
 * This file exists only to avoid breaking existing imports during migration.
 */

export { briefFileName, agentWikilink, planWikilink, generateBrief, buildLifecyclePath } from "./brief-store.js";
export type { BriefContext } from "./brief-store.js";
