/**
 * devtools.ts — Developer utilities menu and commands.
 */

import { config } from "../../infrastructure/config.js";
import { RESET, DIM, CYAN } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import type { MenuResult } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

const cmd = (config as Record<string, Record<string, Record<string, string>>>).devtools?.commands ?? {};

export async function menu(): Promise<MenuResult> {
	return runMenu("Dev Tools", [
		{ key: "1", label: "Reload plugin", action: () => {
			shell.run(cmd.reload ?? "node scripts/cli-reload.mjs", { label: "Reloading plugin..." });
		}},
		{ key: "2", label: "Dev console (Obsidian)", action: () => {
			log(`\n  ${DIM}Press Ctrl+C to stop the console stream.${RESET}\n`);
			shell.run(cmd.console ?? "obsidian dev:console", { label: "Opening dev console..." });
		}},
		{ key: "3", label: "Dev errors (Obsidian)", action: () => {
			log(`\n  ${DIM}Press Ctrl+C to stop the error stream.${RESET}\n`);
			shell.run(cmd.errors ?? "obsidian dev:errors", { label: "Opening error stream..." });
		}},
		{ key: "4", label: "Fix frontmatter (ADR-030)", action: async () => {
			const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
			log(`\n  ${CYAN}▸${RESET} Running frontmatter check (dry-run)...\n`);
			shell.run(`${fmCmd} --dry-run`, { label: "Scanning docs/ for frontmatter issues..." });
			const rl = createRL();
			const apply = await ask(rl, "Apply fixes? (y/N)", "N");
			rl.close();
			if (apply.toLowerCase() === "y") {
				shell.run(fmCmd, { label: "Fixing frontmatter..." });
			}
		}},
		{ key: "5", label: "Generate test data (Analytics CSVs)", action: () => {
			shell.run(cmd.testdata ?? "node scripts/generate-test-data.mjs", { label: "Generating test data CSVs..." });
		}},
		{ key: "6", label: "Type check (lint + tsc)", action: () => {
			shell.run(cmd.check ?? "npm run check", { label: "Running lint + tsc..." });
		}},
		{ key: "7", label: "Lint (ESLint only)", action: () => {
			shell.run(cmd.lint ?? "npm run lint", { label: "Running ESLint..." });
		}},
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("devtools"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	]);
}

export const commands = {
	"dev:reload": () => {
		shell.run(cmd.reload ?? "node scripts/cli-reload.mjs", { label: "Reloading plugin..." });
	},
	"dev:console": () => {
		shell.run(cmd.console ?? "obsidian dev:console", { label: "Opening dev console..." });
	},
	"dev:errors": () => {
		shell.run(cmd.errors ?? "obsidian dev:errors", { label: "Opening error stream..." });
	},
	"dev:check": () => {
		shell.run(cmd.check ?? "npm run check", { label: "Running lint + tsc..." });
	},
	"dev:lint": () => {
		shell.run(cmd.lint ?? "npm run lint", { label: "Running ESLint..." });
	},
	"dev:fix-frontmatter": (flags: Record<string, string | boolean>) => {
		const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
		const dryRun = flags["dry-run"] ? " --dry-run" : "";
		shell.run(`${fmCmd}${dryRun}`, { label: `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...` });
	},
	"dev:testdata": () => {
		shell.run(cmd.testdata ?? "node scripts/generate-test-data.mjs", { label: "Generating test data CSVs..." });
	},
};
