/**
 * plugins-display.ts — Console display renderers for plugin commands.
 *
 * Pure display functions that render plugin data with ANSI colors.
 * Controllers pass these as callbacks to dataResponse().
 */

import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";

// ── Data models ──────────────────────────────────────────────────────

export interface PluginListItem {
	name: string;
	version: string | null;
	description: string;
	commands: string[];
	valid: boolean;
	errors: string[];
}

export interface PluginValidationItem {
	name: string;
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export interface PluginCreatedModel {
	path: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderPluginList(plugins: PluginListItem[], log: (msg?: string) => void): void {
	if (plugins.length === 0) {
		log(`\n  ${DIM}No plugins found.${RESET}\n`);
		return;
	}
	log(`\n  ${CYAN}Installed Plugins${RESET}\n`);
	for (const plugin of plugins) {
		const status = plugin.valid ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const version = plugin.version ? ` ${DIM}v${plugin.version}${RESET}` : "";
		log(`  ${status} ${plugin.name}${version}`);
		log(`    ${DIM}${plugin.description || "(no description)"}${RESET}`);
		if (plugin.valid) {
			if (plugin.commands.length > 0) {
				log(`    ${DIM}Commands:${RESET}`);
				for (const cmd of plugin.commands) log(`      ${DIM}•${RESET} ${cmd}`);
			}
		} else {
			for (const err of plugin.errors) log(`    ${RED}${err}${RESET}`);
		}
		log();
	}
}

export function renderPluginValidation(results: PluginValidationItem[], log: (msg?: string) => void): void {
	if (results.length === 0) {
		log(`\n  ${DIM}No plugin manifests found.${RESET}\n`);
		return;
	}
	log(`\n  ${CYAN}Plugin Validation${RESET}\n`);
	for (const r of results) {
		log(r.valid ? `  ${GREEN}✓${RESET} ${r.name}` : `  ${RED}✗${RESET} ${r.name}`);
		for (const err of r.errors) log(`    ${RED}Error: ${err}${RESET}`);
		for (const warn of r.warnings) log(`    ${YELLOW}Warning: ${warn}${RESET}`);
	}
	log();
}

export function renderPluginCreated(data: PluginCreatedModel, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Created plugin at ${DIM}${data.path}${RESET}`);
	log(`  ${DIM}Edit manifest.json to add commands.${RESET}\n`);
}
