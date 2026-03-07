/**
 * devtools.mjs — Developer utilities menu and commands.
 */

import { cliConfig } from "../../infrastructure/config.mjs";
import { RESET, DIM, CYAN } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { runMenu } from "../../infrastructure/menu.mjs";
import { showHelp } from "../help/help.mjs";

const cmd = cliConfig.devtools?.commands ?? {};

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	return runMenu("Dev Tools", [
		{ key: "1", label: "Reload plugin", action: () => {
			run(cmd.reload ?? "node scripts/cli-reload.mjs", "Reloading plugin...");
		}},
		{ key: "2", label: "Dev console (Obsidian)", action: () => {
			console.log(`\n  ${DIM}Press Ctrl+C to stop the console stream.${RESET}\n`);
			run(cmd.console ?? "obsidian dev:console", "Opening dev console...");
		}},
		{ key: "3", label: "Dev errors (Obsidian)", action: () => {
			console.log(`\n  ${DIM}Press Ctrl+C to stop the error stream.${RESET}\n`);
			run(cmd.errors ?? "obsidian dev:errors", "Opening error stream...");
		}},
		{ key: "4", label: "Fix frontmatter (ADR-030)", action: async () => {
			const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
			console.log(`\n  ${CYAN}▸${RESET} Running frontmatter check (dry-run)...\n`);
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
		{ key: "b", label: "Back", action: () => "main" },
		{ key: "q", label: "Quit", action: () => "quit" },
	]);
}

// ── Non-interactive commands ────────────────────────────────────────

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
	"dev:fix-frontmatter": (flags) => {
		const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
		const dryRun = flags["dry-run"] ? " --dry-run" : "";
		run(`${fmCmd}${dryRun}`, `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...`);
	},
	"dev:testdata": () => {
		run(cmd.testdata ?? "node scripts/generate-test-data.mjs", "Generating test data CSVs...");
	},
};
