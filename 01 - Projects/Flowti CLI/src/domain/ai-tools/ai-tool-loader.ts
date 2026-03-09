/**
 * ai-tool-loader.ts — AI tool discovery, validation, and loading.
 *
 * AI tools live at .flowti/ai-tools/<name>.json (vault level).
 * Pure functions where possible. I/O is injected via IFileSystem.
 */

import type { IFileSystem } from "../../infrastructure/types.js";
import { paths } from "../../infrastructure/paths.js";
import type {
	AiToolDefinition,
	AiToolValidationResult,
	LoadedAiTool,
} from "./ai-tool-types.js";

// ── Constants ────────────────────────────────────────────────────────

export const AI_TOOLS_DIR = ".flowti/ai-tools";

const VALID_PARAM_TYPES = new Set(["string", "number", "boolean", "array", "object"]);

// ── Validation ───────────────────────────────────────────────────────

function validateRequiredFields(obj: Record<string, unknown>, errors: string[]): void {
	if (typeof obj.name !== "string" || obj.name.trim() === "") {
		errors.push('Missing or empty "name" field');
	} else if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(obj.name)) {
		errors.push('"name" must be lowercase alphanumeric with hyphens or underscores');
	}
	if (typeof obj.description !== "string" || obj.description.trim() === "") {
		errors.push('Missing or empty "description" field');
	}
	if (typeof obj.run !== "string" || obj.run.trim() === "") {
		errors.push('Missing or empty "run" field');
	}
}

function validateOptionalFields(obj: Record<string, unknown>, errors: string[], warnings: string[]): void {
	if (obj.version !== undefined && typeof obj.version !== "string") {
		warnings.push('"version" should be a string');
	}
	if (obj.cwd !== undefined && typeof obj.cwd !== "string") {
		errors.push('"cwd" must be a string');
	}
	if (obj.tags !== undefined && !Array.isArray(obj.tags)) {
		warnings.push('"tags" should be an array of strings');
	}
}

function validateSingleParam(p: Record<string, unknown>, index: number, errors: string[]): void {
	if (typeof p.name !== "string" || p.name.trim() === "") {
		errors.push(`params[${index}] missing "name"`);
	}
	if (typeof p.type !== "string" || !VALID_PARAM_TYPES.has(p.type)) {
		errors.push(`params[${index}] has invalid "type" (must be string|number|boolean|array|object)`);
	}
	if (typeof p.description !== "string" || p.description.trim() === "") {
		errors.push(`params[${index}] missing "description"`);
	}
}

function validateParams(obj: Record<string, unknown>, errors: string[]): void {
	if (obj.params === undefined) return;
	if (!Array.isArray(obj.params)) {
		errors.push('"params" must be an array');
		return;
	}
	for (let i = 0; i < obj.params.length; i++) {
		const p = obj.params[i] as Record<string, unknown>;
		if (typeof p !== "object" || p === null) {
			errors.push(`params[${i}] must be an object`);
			continue;
		}
		validateSingleParam(p, i, errors);
	}
}

/** Validate a raw JSON value as an AiToolDefinition. */
export function validateToolDefinition(raw: unknown): AiToolValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return { valid: false, errors: ["Tool definition must be a JSON object"], warnings };
	}

	const obj = raw as Record<string, unknown>;
	validateRequiredFields(obj, errors);
	validateOptionalFields(obj, errors, warnings);
	validateParams(obj, errors);

	return { valid: errors.length === 0, errors, warnings };
}

// ── I/O functions ────────────────────────────────────────────────────

/** Discover .json tool files in the ai-tools directory. */
export function discoverToolFiles(toolsDir: string, fs: IFileSystem): string[] {
	if (!fs.existsSync(toolsDir)) return [];

	return fs
		.readdirSync(toolsDir)
		.filter((f: string) => f.endsWith(".json"))
		.map((f: string) => paths.join(toolsDir, f));
}

/** Load and validate a single AI tool file. */
export function loadToolFile(
	toolPath: string,
	fs: IFileSystem,
): LoadedAiTool {
	try {
		const raw = JSON.parse(fs.readFileSync(toolPath, "utf-8")) as unknown;
		const validation = validateToolDefinition(raw);
		const fileName = paths.basename(toolPath, ".json");

		if (!validation.valid) {
			return {
				definition: { name: fileName, description: "", run: "" },
				path: toolPath,
				valid: false,
				errors: validation.errors,
			};
		}

		return {
			definition: raw as AiToolDefinition,
			path: toolPath,
			valid: true,
			errors: [],
		};
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		const fileName = paths.basename(toolPath, ".json");
		return {
			definition: { name: fileName, description: "", run: "" },
			path: toolPath,
			valid: false,
			errors: [`Failed to parse: ${message}`],
		};
	}
}

/** Load all AI tools from the vault-level ai-tools directory. */
export function loadAiTools(
	vaultRoot: string,
	fs: IFileSystem,
): LoadedAiTool[] {
	const toolsDir = paths.join(vaultRoot, AI_TOOLS_DIR);
	const files = discoverToolFiles(toolsDir, fs);
	return files.map((f) => loadToolFile(f, fs));
}

/** Scaffold a new AI tool definition file. */
export function scaffoldAiTool(
	vaultRoot: string,
	toolName: string,
	description: string,
	runCmd: string,
	fs: IFileSystem,
): { path: string } | { error: string } {
	if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(toolName)) {
		return { error: "Tool name must be lowercase alphanumeric with hyphens or underscores" };
	}

	const toolsDir = paths.join(vaultRoot, AI_TOOLS_DIR);
	const toolPath = paths.join(toolsDir, `${toolName}.json`);

	if (fs.existsSync(toolPath)) {
		return { error: `Tool "${toolName}" already exists` };
	}

	const definition: AiToolDefinition = {
		name: toolName,
		description,
		version: "1.0.0",
		run: runCmd,
		params: [],
		tags: [],
	};

	fs.mkdirSync(toolsDir, { recursive: true });
	fs.writeFileSync(toolPath, JSON.stringify(definition, null, 2), "utf-8");

	return { path: toolPath };
}

/** Generate a CLAUDE.md-compatible tool reference block for all valid tools. */
export function generateToolReference(tools: LoadedAiTool[]): string {
	const valid = tools.filter((t) => t.valid);
	if (valid.length === 0) return "";

	const lines: string[] = ["# AI Tools\n"];

	for (const tool of valid) {
		const def = tool.definition;
		lines.push(`## ${def.name}`);
		lines.push(`${def.description}\n`);
		lines.push(`- **Run**: \`${def.run}\``);

		if (def.params && def.params.length > 0) {
			lines.push("- **Parameters**:");
			for (const p of def.params) {
				const req = p.required ? " (required)" : "";
				lines.push(`  - \`${p.name}\` (${p.type})${req}: ${p.description}`);
			}
		}

		if (def.tags && def.tags.length > 0) {
			lines.push(`- **Tags**: ${def.tags.join(", ")}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
