/**
 * devtools.ts — Developer utilities menu and commands.
 */

import { config } from "../../infrastructure/config.js";
import { RESET, DIM, CYAN } from "../../infrastructure/ui.js";
import { run } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import type { MenuResult } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

const cmd = (config as Record<string, Record<string, Record<string, string>>>).devtools?.commands ?? {};

export async function menu(): Promise<MenuResult> {
	return runMenu("Dev Tools", [
		{ key: "1", label: "Reload plugin", action: () => {
			run(cmd.reload ?? "node scripts/cli-reload.mjs", "Reloading plugin...");
		}},
		{ key: "2", label: "Dev console (Obsidian)", action: () => {
			log(`\n  ${DIM}Press Ctrl+C to stop the console stream.${RESET}\n`);
			run(cmd.console ?? "obsidian dev:console", "Opening dev console...");
		}},
		{ key: "3", label: "Dev errors (Obsidian)", action: () => {
			log(`\n  ${DIM}Press Ctrl+C to stop the error stream.${RESET}\n`);
			run(cmd.errors ?? "obsidian dev:errors", "Opening error stream...");
		}},
		{ key: "4", label: "Fix frontmatter (ADR-030)", action: async () => {
			const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
			log(`\n  ${CYAN}▸${RESET} Running frontmatter check (dry-run)...\n`);
			run(`${fmCmd} --dry-run`, "Scanning docs/ for frontmatter issues...");
			const rl = createRL();
			const apply = await ask(rl, "Apply fixes? (y/N)", "N");
			rl.close();
			if (apply.toLowerCase() === "y") {
				run(fmCmd, "Fixing frontmatter...");
			}
		}},
		{ key: "5", label: "Generate test data (Analytics CSVs)", action: () => {
			run(cmd.testdata ?? "node scripts/generate-test-data.mjs", "Generating test data CSVs...");
		}},
		{ key: "6", label: "Type check (lint + tsc)", action: () => {
			run(cmd.check ?? "npm run check", "Running lint + tsc...");
		}},
		{ key: "7", label: "Lint (ESLint only)", action: () => {
			run(cmd.lint ?? "npm run lint", "Running ESLint...");
		}},
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("devtools"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	]);
}

export const commands = {
	"dev:reload": () => {
		run(cmd.reload ?? "node scripts/cli-reload.mjs", "Reloading plugin...");
	},
	"dev:console": () => {
		run(cmd.console ?? "obsidian dev:console", "Opening dev console...");
	},
	"dev:errors": () => {
		run(cmd.errors ?? "obsidian dev:errors", "Opening error stream...");
	},
	"dev:check": () => {
		run(cmd.check ?? "npm run check", "Running lint + tsc...");
	},
	"dev:lint": () => {
		run(cmd.lint ?? "npm run lint", "Running ESLint...");
	},
	"dev:fix-frontmatter": (flags: Record<string, string | boolean>) => {
		const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
		const dryRun = flags["dry-run"] ? " --dry-run" : "";
		run(`${fmCmd}${dryRun}`, `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...`);
	},
	"dev:testdata": () => {
		run(cmd.testdata ?? "node scripts/generate-test-data.mjs", "Generating test data CSVs...");
	},
};
