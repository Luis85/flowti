/**
 * talk-engine.ts — Re-export shim for backwards compatibility.
 *
 * The talk engine has been refactored into domain-driven templates.
 * See `./talk/talk-engine.ts` for the implementation.
 */

export { TalkEngine } from "./talk/talk-engine.js";
export type { TalkEngineCallbacks } from "./talk/talk-engine.js";
