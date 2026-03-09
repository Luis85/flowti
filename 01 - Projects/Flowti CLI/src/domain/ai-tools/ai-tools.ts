/**
 * ai-tools.ts — AI Tools domain facade.
 *
 * Re-exports the public API for AI agent tool management.
 */

export { commands, aiToolsMenu } from "./ai-tool-commands.js";
export { loadAiTools, scaffoldAiTool, generateToolReference, AI_TOOLS_DIR } from "./ai-tool-loader.js";
export { generateAiToolReference } from "./ai-tool-reference.js";
export type { AiToolDefinition, LoadedAiTool, AiToolValidationResult } from "./ai-tool-types.js";
