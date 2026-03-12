/**
 * ai-tool-commands.ts — Pure domain logic for AI tool management.
 *
 * Data-mapping functions and parameter substitution.
 * Interactive menu lives in ui/menus/ai-tools-menu.ts.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import {
	validateToolDefinition,
	discoverToolFiles,
	AI_TOOLS_DIR,
} from "./ai-tool-loader.js";
import type { LoadedAiTool, AiToolParam } from "./ai-tool-types.js";

// ── Data mapping (domain → display model) ────────────────────────────

export interface ToolListItem {
	name: string;
	version: string | null;
	description: string;
	run: string;
	params: AiToolParam[];
	tags: string[];
	valid: boolean;
	errors: string[];
}

export interface ToolValidationItem {
	file: string;
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export function toToolListItems(tools: LoadedAiTool[]): ToolListItem[] {
	return tools.map((tool) => ({
		name: tool.definition.name,
		version: tool.definition.version ?? null,
		description: tool.definition.description || "",
		run: tool.definition.run,
		params: (tool.definition.params ?? []).map((p) => ({
			...p,
			required: p.required ?? false,
		})),
		tags: tool.definition.tags ?? [],
		valid: tool.valid,
		errors: [...tool.errors],
	}));
}

export function toToolValidationItems(
	deps: Pick<CliDeps, "disk" | "paths">,
	vaultRoot: string,
): ToolValidationItem[] {
	const toolsDir = deps.paths.join(vaultRoot, AI_TOOLS_DIR);
	const files = discoverToolFiles(deps, toolsDir, deps.disk);
	return files.map((file) => {
		const fileName = deps.paths.basename(file);
		try {
			const raw = JSON.parse(deps.disk.readFileSync(file, "utf-8")) as unknown;
			const result = validateToolDefinition(raw);
			return {
				file: fileName,
				valid: result.valid,
				errors: [...result.errors],
				warnings: [...result.warnings],
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				file: fileName,
				valid: false,
				errors: [`Parse error: ${message}`],
				warnings: [],
			};
		}
	});
}

// ── Param substitution ──────────────────────────────────────────────

/** Replace {{param}} placeholders in a command string with flag values. */
export function substituteParams(
	command: string,
	params: { name: string; default?: string | number | boolean }[],
	flags: Record<string, string | boolean>,
): string {
	let result = command;
	for (const p of params) {
		const value = flags[p.name] ?? p.default ?? "";
		result = result.replace(new RegExp(`\\{\\{${p.name}\\}\\}`, "g"), String(value));
	}
	return result;
}
