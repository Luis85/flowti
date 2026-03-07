/**
 * devtools.mjs — Developer utilities menu and commands.
 */

import { cliConfig } from "../../infrastructure/config.mjs";
import { RESET, DIM, CYAN, printHeader, printMenu } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { showHelp } from "../help/help.mjs";

const cmd = cliConfig.devtools?.commands ?? {};

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Dev Tools");
		printMenu([
			{ key: "1", label: "Reload plugin" },
			{ key: "2", label: "Dev console (Obsidian)" },
			{ key: "3", label: "Dev errors (Obsidian)" },
			{ key: "4", label: "Fix frontmatter (ADR-030)" },
			{ key: "5", label: "Generate test data (Analytics CSVs)" },
			{ key: "6", label: "Type check (lint + tsc)" },
			{ key: "7", label: "Lint (ESLint only)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				run(cmd.reload ?? "node scripts/cli-reload.mjs", "Reloading plugin...");
				break;
			case "2":
				console.log(`\n  ${DIM}Press Ctrl+C to stop the console stream.${RESET}\n`);
				run(cmd.console ?? "obsidian dev:console", "Opening dev console...");
				break;
			case "3":
				console.log(`\n  ${DIM}Press Ctrl+C to stop the error stream.${RESET}\n`);
				run(cmd.errors ?? "obsidian dev:errors", "Opening error stream...");
				break;
			case "4": {
				const fmCmd = cmd.fixFrontmatter ?? "node scripts/fix-frontmatter.mjs";
				console.log(`\n  ${CYAN}▸${RESET} Running frontmatter check (dry-run)...\n`);
				run(`${fmCmd} --dry-run`, "Scanning docs/ for frontmatter issues...");
				const applyRl = createRL();
				const apply = await ask(applyRl, "Apply fixes? (y/N)", "N");
				applyRl.close();
				if (apply.toLowerCase() === "y") {
					run(fmCmd, "Fixing frontmatter...");
				}
				break;
			}
			case "5":
				run(cmd.testdata ?? "node scripts/generate-test-data.mjs", "Generating test data CSVs...");
				break;
			case "6":
				run(cmd.check ?? "npm run check", "Running lint + tsc...");
				break;
			case "7":
				run(cmd.lint ?? "npm run lint", "Running ESLint...");
				break;
			case "?":
				showHelp("devtools");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
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
