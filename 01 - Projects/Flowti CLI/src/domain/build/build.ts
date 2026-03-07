/**
 * build.ts — Build commands and interactive menu.
 */

import { config } from "../../infrastructure/config.js";
import { RESET, DIM, CYAN } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import { showPostBuildGuidance } from "../onboarding/onboarding.js";
import type { MenuResult } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

const cfg = config as Record<string, Record<string, Record<string, string>>>;
const buildCmd = cfg.build?.commands ?? {};
const testCmd = cfg.test?.commands ?? {};

// ── Interactive menu ────────────────────────────────────────────────

export async function menu(): Promise<MenuResult> {
	return runMenu("Build", [
		{ key: "1", label: "Build (fast — no tests, no reports)", action: () => {
			const code = shell.run(buildCmd.fast ?? "node esbuild.config.mjs --production --no-reports", { label: "Building (fast)..." });
			if (code === 0) showPostBuildGuidance();
		}},
		{ key: "2", label: "Build increment (check → build → test → reports → distribute)", action: () => {
			const code = shell.run(buildCmd.increment ?? "npm run build:increment", { label: "Building increment (full pipeline)..." });
			if (code === 0) showPostBuildGuidance();
		}},
		{ key: "3", label: "Build full (flow tests → build → reports)", action: () => {
			const code = shell.run(buildCmd.full ?? "npm run build:full", { label: "Building full (flow tests + reports)..." });
			if (code === 0) showPostBuildGuidance();
		}},
		{ key: "4", label: "Watch mode (live rebuild on save)", action: async () => {
			const rl = createRL();
			const reload = await ask(rl, "Auto-reload plugin on save? (y/N)", "N");
			rl.close();
			const reloadFlag = reload.toLowerCase() === "y" ? " --reload" : "";
			log(`\n  ${CYAN}▸${RESET} Starting watch mode...${reloadFlag ? ` ${DIM}(with auto-reload)${RESET}` : ""}\n`);
			log(`  ${DIM}Press Ctrl+C to stop.${RESET}\n`);
			shell.run(`${buildCmd.watch ?? "node esbuild.config.mjs --watch"}${reloadFlag}`, { label: "Watch mode" });
		}},
		{ key: "5", label: "Distribute (copy to endpoint vaults)", action: () => {
			shell.run(buildCmd.distribute ?? "node esbuild.config.mjs --production --no-reports --distribution", { label: "Distributing build..." });
		}},
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("build"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	]);
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"build": () => {
		const code = shell.run(buildCmd.fast ?? "node esbuild.config.mjs --production --no-reports", { label: "Building (fast)..." });
		if (code === 0) showPostBuildGuidance();
	},
	"build:increment": () => {
		const code = shell.run(buildCmd.increment ?? "npm run build:increment", { label: "Building increment (full pipeline)..." });
		if (code === 0) showPostBuildGuidance();
	},
	"build:full": () => {
		const code = shell.run(buildCmd.full ?? "npm run build:full", { label: "Building full (flow tests + reports)..." });
		if (code === 0) showPostBuildGuidance();
	},
	"build:watch": (flags: Record<string, string | boolean>) => {
		const reloadFlag = flags.reload ? " --reload" : "";
		shell.run(`${buildCmd.watch ?? "node esbuild.config.mjs --watch"}${reloadFlag}`, { label: "Watch mode..." });
	},
	"build:distribute": () => {
		shell.run(buildCmd.distribute ?? "node esbuild.config.mjs --production --no-reports --distribution", { label: "Distributing build..." });
	},
	"test": () => {
		shell.run(testCmd.unit ?? "npm run check && vitest run", { label: "Running tests..." });
	},
	"test:increment": () => {
		shell.run(testCmd.increment ?? "npm run test:increment", { label: "Running increment tests..." });
	},
	"test:e2e": () => {
		shell.run(testCmd.e2e ?? "npm run test:e2e", { label: "Running E2E tests..." });
	},
};
