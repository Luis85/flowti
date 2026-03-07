/**
 * review.ts — E2E testing and vault management menu and commands.
 */

import { config } from "../../infrastructure/config.js";
import { RESET, YELLOW } from "../../infrastructure/ui.js";
import { run } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import type { MenuResult } from "../../types.js";

const cmd = (config as Record<string, Record<string, Record<string, string>>>).review?.commands ?? {};

export async function menu(): Promise<MenuResult> {
	let incrementPassed = false;

	return runMenu("Review", [
		{ key: "1", label: "Start test session (interactive E2E)", action: () => {
			run(cmd.e2e ?? "node scripts/run-e2e.mjs --list", "Starting interactive E2E session...");
		}},
		{ key: "2", label: "Build the increment", action: () => {
			const code = run(cmd.increment ?? "npm run build:increment", "Building increment...");
			if (code === 0) incrementPassed = true;
		}},
		{ key: "3", label: "Publish the increment",
			disabled: () => !incrementPassed,
			disabledMessage: `\n  ${YELLOW}Cannot publish — run a successful increment build first (option 2).${RESET}\n`,
			action: () => { run(cmd.release ?? "npm run build:release", "Publishing..."); },
		},
		{ key: "4", label: "Teardown test vault", action: async () => {
			console.log(`\n  ${YELLOW}This will reset the test vault to a fresh state.${RESET}`);
			const rl = createRL();
			const confirm = await ask(rl, "Continue? (y/N)", "N");
			rl.close();
			if (confirm.toLowerCase() === "y") {
				run(cmd.teardown ?? "node scripts/run-e2e.mjs --teardown", "Tearing down test vault...");
			}
		}},
		{ key: "5", label: "Rebuild (teardown → prerequisites → installer)", action: async () => {
			console.log(`\n  ${YELLOW}This will teardown and rebuild the test vault from scratch.${RESET}`);
			const rl = createRL();
			const confirm = await ask(rl, "Continue? (y/N)", "N");
			rl.close();
			if (confirm.toLowerCase() === "y") {
				run(cmd.rebuild ?? "node scripts/run-e2e.mjs --rebuild", "Rebuilding test vault...");
			}
		}},
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("review"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	]);
}

export const commands = {
	review: () => {
		run(cmd.e2e ?? "node scripts/run-e2e.mjs --list", "Starting interactive E2E session...");
	},
};
