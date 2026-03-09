/**
 * ai-tool-types.ts — Type definitions for AI agent tools.
 *
 * AI tools are JSON definitions that describe capabilities exposed to AI agents.
 * Each tool lives in .flowti/ai-tools/<name>.json at vault level.
 */

/** Shape of a single parameter in an AI tool definition. */
export interface AiToolParam {
	name: string;
	type: "string" | "number" | "boolean" | "array" | "object";
	description: string;
	required?: boolean;
	default?: string | number | boolean;
}

/** The JSON format stored in .flowti/ai-tools/<name>.json. */
export interface AiToolDefinition {
	name: string;
	description: string;
	version?: string;
	/** Shell command to execute when the tool is invoked. */
	run: string;
	/** Working directory for the command (relative to vault root). */
	cwd?: string;
	/** Parameter definitions for the tool. */
	params?: AiToolParam[];
	/** Tags for categorization. */
	tags?: string[];
}

/** An AI tool after discovery and validation. */
export interface LoadedAiTool {
	definition: AiToolDefinition;
	path: string;
	valid: boolean;
	errors: string[];
}

/** Result of validating a raw AI tool definition. */
export interface AiToolValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}
