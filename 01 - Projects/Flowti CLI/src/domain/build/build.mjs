/**
 * build.mjs — Build commands and interactive menu.
 */

import { cliConfig } from "../../infrastructure/config.mjs";
import { RESET, DIM, CYAN, printHeader, printMenu } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { showHelp } from "../help/help.mjs";
import { showPostBuildGuidance } from "../onboarding/onboarding.mjs";

const buildCmd = cliConfig.build?.commands ?? {};
const testCmd = cliConfig.test?.commands ?? {};

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Build");
		printMenu([
			{ key: "1", label: "Build (fast — no tests, no reports)" },
			{ key: "2", label: "Build increment (check → build → test → reports → distribute)" },
			{ key: "3", label: "Build full (flow tests → build → reports)" },
			{ key: "4", label: "Watch mode (live rebuild on save)" },
			{ key: "5", label: "Distribute (copy to endpoint vaults)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1": {
				const code = run(buildCmd.fast ?? "node esbuild.config.mjs --production --no-reports", "Building (fast)...");
				if (code === 0) showPostBuildGuidance();
				break;
			}
			case "2": {
				const code = run(buildCmd.increment ?? "npm run build:increment", "Building increment (full pipeline)...");
				if (code === 0) showPostBuildGuidance();
				break;
			}
			case "3": {
				const code = run(buildCmd.full ?? "npm run build:full", "Building full (flow tests + reports)...");
				if (code === 0) showPostBuildGuidance();
				break;
			}
			case "4": {
				const rlReload = createRL();
				const reload = await ask(rlReload, "Auto-reload plugin on save? (y/N)", "N");
				rlReload.close();
				const reloadFlag = reload.toLowerCase() === "y" ? " --reload" : "";
				console.log(`\n  ${CYAN}▸${RESET} Starting watch mode...${reloadFlag ? ` ${DIM}(with auto-reload)${RESET}` : ""}\n`);
				console.log(`  ${DIM}Press Ctrl+C to stop.${RESET}\n`);
				run(`${buildCmd.watch ?? "node esbuild.config.mjs --watch"}${reloadFlag}`, "Watch mode");
				break;
			}
			case "5":
				run(buildCmd.distribute ?? "node esbuild.config.mjs --production --no-reports --distribution", "Distributing build...");
				break;
			case "?":
				showHelp("build");
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
	"build": () => {
		const code = run(buildCmd.fast ?? "node esbuild.config.mjs --production --no-reports", "Building (fast)...");
		if (code === 0) showPostBuildGuidance();
	},
	"build:increment": () => {
		const code = run(buildCmd.increment ?? "npm run build:increment", "Building increment (full pipeline)...");
		if (code === 0) showPostBuildGuidance();
	},
	"build:full": () => {
		const code = run(buildCmd.full ?? "npm run build:full", "Building full (flow tests + reports)...");
		if (code === 0) showPostBuildGuidance();
	},
	"build:watch": (flags) => {
		const reloadFlag = flags.reload ? " --reload" : "";
		run(`${buildCmd.watch ?? "node esbuild.config.mjs --watch"}${reloadFlag}`, "Watch mode...");
	},
	"build:distribute": () => {
		run(buildCmd.distribute ?? "node esbuild.config.mjs --production --no-reports --distribution", "Distributing build...");
	},
	"test": () => {
		run(testCmd.unit ?? "npm run check && vitest run", "Running tests...");
	},
	"test:increment": () => {
		run(testCmd.increment ?? "npm run test:increment", "Running increment tests...");
	},
	"test:e2e": () => {
		run(testCmd.e2e ?? "npm run test:e2e", "Running E2E tests...");
	},
};
