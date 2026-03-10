/**
 * ai-tool-commands.ts — Command handlers for AI tool management.
 *
 * Provides interactive menu and CLI commands for managing AI agent tools.
 */

import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import { disk } from "../../infrastructure/filesystem.js";
import { input } from "../../infrastructure/input.js";
import { shell } from "../../infrastructure/shell.js";
import { VAULT_ROOT, CLI_PROJECT } from "../../infrastructure/config.js";
import { runMenu } from "../../infrastructure/menu.js";
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import type { CommandHandler, MenuEntry, MenuResult } from "../../infrastructure/types.js";
import {
	loadAiTools,
	validateToolDefinition,
	scaffoldAiTool,
	discoverToolFiles,
	AI_TOOLS_DIR,
} from "./ai-tool-loader.js";
import { paths } from "../../infrastructure/paths.js";
import type { AiToolParam, LoadedAiTool } from "./ai-tool-types.js";
import { generateAiToolReference } from "./ai-tool-reference.js";

// ── Display helpers ──────────────────────────────────────────────────

function displayValidTool(tool: LoadedAiTool): void {
	log(`    ${DIM}Run: ${tool.definition.run}${RESET}`);
	const params = tool.definition.params ?? [];
	if (params.length > 0) {
		log(`    ${DIM}Params:${RESET}`);
		for (const p of params) {
			const req = p.required ? ` ${YELLOW}(required)${RESET}` : "";
			log(`      ${DIM}•${RESET} ${p.name} (${p.type})${req}`);
		}
	}
	const tags = tool.definition.tags ?? [];
	if (tags.length > 0) {
		log(`    ${DIM}Tags: ${tags.join(", ")}${RESET}`);
	}
}

function displayToolList(tools: LoadedAiTool[]): void {
	if (tools.length === 0) {
		log(`\n  ${DIM}No AI tools found in ${AI_TOOLS_DIR}/${RESET}\n`);
		return;
	}

	log(`\n  ${CYAN}AI Tools${RESET}\n`);

	for (const tool of tools) {
		const status = tool.valid ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const version = tool.definition.version ? ` ${DIM}v${tool.definition.version}${RESET}` : "";

		log(`  ${status} ${tool.definition.name}${version}`);
		log(`    ${DIM}${tool.definition.description || "(no description)"}${RESET}`);

		if (tool.valid) {
			displayValidTool(tool);
		} else {
			for (const err of tool.errors) {
				log(`    ${RED}${err}${RESET}`);
			}
		}
		log();
	}
}

function displayValidation(vaultRoot: string): void {
	const toolsDir = paths.join(vaultRoot, AI_TOOLS_DIR);
	const files = discoverToolFiles(toolsDir, disk);

	if (files.length === 0) {
		log(`\n  ${DIM}No AI tool files found in ${AI_TOOLS_DIR}/${RESET}\n`);
		return;
	}

	log(`\n  ${CYAN}AI Tool Validation${RESET}\n`);

	for (const file of files) {
		const fileName = paths.basename(file);
		try {
			const raw = JSON.parse(disk.readFileSync(file, "utf-8")) as unknown;
			const result = validateToolDefinition(raw);

			if (result.valid) {
				log(`  ${GREEN}✓${RESET} ${fileName}`);
			} else {
				log(`  ${RED}✗${RESET} ${fileName}`);
			}

			for (const err of result.errors) {
				log(`    ${RED}Error: ${err}${RESET}`);
			}
			for (const warn of result.warnings) {
				log(`    ${YELLOW}Warning: ${warn}${RESET}`);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			log(`  ${RED}✗${RESET} ${fileName}`);
			log(`    ${RED}Parse error: ${message}${RESET}`);
		}
	}
	log();
}

// ── Interactive menu ─────────────────────────────────────────────────

export async function aiToolsMenu(): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Tools",
			action: () => {
				const tools = loadAiTools(VAULT_ROOT, disk);
				displayToolList(tools);
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Validate Tools",
			action: () => {
				displayValidation(VAULT_ROOT);
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Create Tool",
			action: async () => {
				const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
				if (!name) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return "main" as const;
				}
				const desc = await input.ask("Description");
				const run = await input.ask("Shell command to run");
				if (!run) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return "main" as const;
				}
				const result = scaffoldAiTool(VAULT_ROOT, name, desc || "An AI tool", run, disk);
				if ("error" in result) {
					log(`\n  ${RED}${result.error}${RESET}\n`);
				} else {
					log(`\n  ${GREEN}✓${RESET} Created tool at ${DIM}${result.path}${RESET}`);
					log(`  ${DIM}Edit the JSON file to add parameters and tags.${RESET}\n`);
				}
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Generate Reference",
			action: () => {
				const tools = loadAiTools(VAULT_ROOT, disk);
				const doc = generateAiToolReference(tools);
				const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
				doc.save(outputPath);
				log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "quit" as const },
	];

	await runMenu("AI Tools", items);
	return "main";
}

// ── Exported command handlers ────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"ai:list": (flags) => {
		const tools = loadAiTools(VAULT_ROOT, disk);
		const format = resolveFormat(flags);
		printOutput(format, tools.map((t) => ({
			name: t.definition.name,
			version: t.definition.version ?? null,
			description: t.definition.description,
			run: t.definition.run,
			params: t.definition.params ?? [],
			tags: t.definition.tags ?? [],
			valid: t.valid,
			errors: t.errors,
		})), () => displayToolList(tools));
	},

	"ai:validate": (flags) => {
		const format = resolveFormat(flags);
		if (format === "json") {
			const toolsDir = paths.join(VAULT_ROOT, AI_TOOLS_DIR);
			const files = discoverToolFiles(toolsDir, disk);
			const results = files.map((file) => {
				const fileName = paths.basename(file);
				try {
					const raw = JSON.parse(disk.readFileSync(file, "utf-8")) as unknown;
					const result = validateToolDefinition(raw);
					return { file: fileName, ...result };
				} catch (err: unknown) {
					return { file: fileName, valid: false, errors: [err instanceof Error ? err.message : String(err)], warnings: [] };
				}
			});
			log(JSON.stringify(results));
		} else {
			displayValidation(VAULT_ROOT);
		}
	},

	"ai:new": async () => {
		const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
		if (!name) {
			log(`\n  ${DIM}Cancelled.${RESET}\n`);
			return;
		}
		const desc = await input.ask("Description");
		const run = await input.ask("Shell command to run");
		if (!run) {
			log(`\n  ${DIM}Cancelled.${RESET}\n`);
			return;
		}
		const result = scaffoldAiTool(VAULT_ROOT, name, desc || "An AI tool", run, disk);
		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Created tool at ${DIM}${result.path}${RESET}\n`);
		}
	},

	"ai:reference": () => {
		const tools = loadAiTools(VAULT_ROOT, disk);
		const doc = generateAiToolReference(tools);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
		doc.save(outputPath);
		log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
	},

	"ai:run": (flags) => {
		const toolName = flags.tool;
		if (!toolName || typeof toolName !== "string") {
			log(`\n  ${RED}Missing --tool flag.${RESET}`);
			log(`  ${DIM}Usage: flowti ai:run --tool=<name> [--param1=value1]${RESET}\n`);
			return;
		}

		const tools = loadAiTools(VAULT_ROOT, disk);
		const tool = validateToolSelection(toolName, tools);
		if (!tool) return;

		const params = tool.definition.params ?? [];
		if (!validateRequiredParams(params, flags)) return;

		// Substitute params in command
		const cmd = substituteParams(tool.definition.run, params, flags);
		const cwd = tool.definition.cwd ? paths.join(VAULT_ROOT, tool.definition.cwd) : VAULT_ROOT;

		if (flags["dry-run"]) {
			log(`\n  ${DIM}Dry run:${RESET} ${cmd}`);
			log(`  ${DIM}cwd:${RESET} ${cwd}\n`);
			return;
		}

		log(`\n  ${CYAN}▸${RESET} Running ${toolName}...`);
		const { exitCode } = shell.runCaptureStatus(cmd, { cwd });
		if (exitCode === 0) {
			log(`  ${GREEN}✓${RESET} ${toolName} completed.\n`);
		} else {
			log(`  ${RED}✗${RESET} ${toolName} failed (exit ${exitCode}).\n`);
		}
	},
};

// ── ai:run helpers ──────────────────────────────────────────────────

/** Resolve and validate the selected tool, logging errors if invalid. Returns the tool or undefined. */
function validateToolSelection(
	toolName: string,
	tools: LoadedAiTool[],
): LoadedAiTool | undefined {
	const tool = tools.find((t) => t.definition.name === toolName);
	if (!tool) {
		log(`\n  ${RED}Tool not found: ${toolName}${RESET}`);
		const names = tools.map((t) => t.definition.name);
		if (names.length > 0) log(`  ${DIM}Available: ${names.join(", ")}${RESET}`);
		log();
		return undefined;
	}
	if (!tool.valid) {
		log(`\n  ${RED}Tool "${toolName}" has validation errors:${RESET}`);
		for (const err of tool.errors) log(`  ${RED}•${RESET} ${err}`);
		log();
		return undefined;
	}
	return tool;
}

/** Check that all required params are present in flags. Returns true when valid. */
function validateRequiredParams(
	params: AiToolParam[],
	flags: Record<string, string | boolean>,
): boolean {
	const missing = params.filter((p) => p.required && flags[p.name] === undefined);
	if (missing.length > 0) {
		log(`\n  ${RED}Missing required parameter${missing.length > 1 ? "s" : ""}:${RESET}`);
		for (const p of missing) log(`  ${RED}•${RESET} --${p.name}: ${p.description}`);
		log();
		return false;
	}
	return true;
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
