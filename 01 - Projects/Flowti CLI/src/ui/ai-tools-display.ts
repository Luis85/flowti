/**
 * ai-tools-display.ts — Console display renderers for AI tool commands.
 *
 * Pure display functions that render AI tool data with ANSI colors.
 * Controllers pass these as callbacks to dataResponse().
 */

import { log } from "../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../infrastructure/ui.js";
import type { AiToolParam } from "../domain/ai-tools/ai-tool-types.js";

// ── Data models ──────────────────────────────────────────────────────

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

export interface ToolRunResultModel {
	toolName: string;
	exitCode: number;
}

export interface DryRunModel {
	cmd: string;
	cwd: string;
}

export interface ToolNotFoundModel {
	toolName: string;
	available: string[];
}

export interface ToolInvalidModel {
	toolName: string;
	errors: string[];
}

export interface MissingParamsModel {
	params: { name: string; description: string }[];
}

export interface MissingToolFlagModel {
	usage: string;
}

// ── Renderers ────────────────────────────────────────────────────────

function renderToolEntry(tool: ToolListItem): void {
	const status = tool.valid ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
	const version = tool.version ? ` ${DIM}v${tool.version}${RESET}` : "";
	log(`  ${status} ${tool.name}${version}`);
	log(`    ${DIM}${tool.description || "(no description)"}${RESET}`);
	if (!tool.valid) {
		for (const err of tool.errors) log(`    ${RED}${err}${RESET}`);
		return;
	}
	log(`    ${DIM}Run: ${tool.run}${RESET}`);
	if (tool.params.length > 0) {
		log(`    ${DIM}Params:${RESET}`);
		for (const p of tool.params) {
			const req = p.required ? ` ${YELLOW}(required)${RESET}` : "";
			log(`      ${DIM}•${RESET} ${p.name} (${p.type})${req}`);
		}
	}
	if (tool.tags.length > 0) log(`    ${DIM}Tags: ${tool.tags.join(", ")}${RESET}`);
}

export function renderToolList(tools: ToolListItem[]): void {
	if (tools.length === 0) {
		log(`\n  ${DIM}No AI tools found.${RESET}\n`);
		return;
	}
	log(`\n  ${CYAN}AI Tools${RESET}\n`);
	for (const tool of tools) {
		renderToolEntry(tool);
		log();
	}
}

export function renderToolValidation(results: ToolValidationItem[]): void {
	if (results.length === 0) {
		log(`\n  ${DIM}No AI tool files found.${RESET}\n`);
		return;
	}
	log(`\n  ${CYAN}AI Tool Validation${RESET}\n`);
	for (const r of results) {
		log(r.valid ? `  ${GREEN}✓${RESET} ${r.file}` : `  ${RED}✗${RESET} ${r.file}`);
		for (const err of r.errors) log(`    ${RED}Error: ${err}${RESET}`);
		for (const warn of r.warnings) log(`    ${YELLOW}Warning: ${warn}${RESET}`);
	}
	log();
}

export function renderToolRunResult(data: ToolRunResultModel): void {
	if (data.exitCode === 0) {
		log(`  ${GREEN}✓${RESET} ${data.toolName} completed.\n`);
	} else {
		log(`  ${RED}✗${RESET} ${data.toolName} failed (exit ${data.exitCode}).\n`);
	}
}

export function renderDryRun(data: DryRunModel): void {
	log(`\n  ${DIM}Dry run:${RESET} ${data.cmd}`);
	log(`  ${DIM}cwd:${RESET} ${data.cwd}\n`);
}

export function renderToolNotFound(data: ToolNotFoundModel): void {
	log(`\n  ${RED}Tool not found: ${data.toolName}${RESET}`);
	if (data.available.length > 0) log(`  ${DIM}Available: ${data.available.join(", ")}${RESET}`);
	log();
}

export function renderToolInvalid(data: ToolInvalidModel): void {
	log(`\n  ${RED}Tool "${data.toolName}" has validation errors:${RESET}`);
	for (const err of data.errors) log(`  ${RED}•${RESET} ${err}`);
	log();
}

export function renderMissingParams(data: MissingParamsModel): void {
	log(`\n  ${RED}Missing required parameter${data.params.length > 1 ? "s" : ""}:${RESET}`);
	for (const p of data.params) log(`  ${RED}•${RESET} --${p.name}: ${p.description}`);
	log();
}

export function renderMissingToolFlag(data: MissingToolFlagModel): void {
	log(`\n  ${RED}Missing --tool flag.${RESET}`);
	log(`  ${DIM}Usage: ${data.usage}${RESET}\n`);
}

export function renderRunning(toolName: string): void {
	log(`\n  ${CYAN}▸${RESET} Running ${toolName}...`);
}
