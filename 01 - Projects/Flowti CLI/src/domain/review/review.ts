/**
 * review.ts — E2E testing and vault management menu and commands.
 */

import { config } from "../../infrastructure/config.js";
import { RESET, YELLOW } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import type { MenuResult } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

const cmd = (config as Record<string, Record<string, Record<string, string>>>).review?.commands ?? {};

export async function menu(): Promise<MenuResult> {
	let incrementPassed = false;

	return runMenu("Review", [
		{ key: "1", label: "Start test session (interactive E2E)", action: () => {
			shell.run(cmd.e2e ?? "node scripts/run-e2e.mjs --list", { label: "Starting interactive E2E session..." });
		}},
		{ key: "2", label: "Build the increment", action: () => {
			const code = shell.run(cmd.increment ?? "npm run build:increment", { label: "Building increment..." });
			if (code === 0) incrementPassed = true;
		}},
		{ key: "3", label: "Publish the increment",
			disabled: () => !incrementPassed,
			disabledMessage: `\n  ${YELLOW}Cannot publish — run a successful increment build first (option 2).${RESET}\n`,
			action: () => { shell.run(cmd.release ?? "npm run build:release", { label: "Publishing..." }); },
		},
		{ key: "4", label: "Teardown test vault", action: async () => {
			log(`\n  ${YELLOW}This will reset the test vault to a fresh state.${RESET}`);
			const rl = createRL();
			const confirm = await ask(rl, "Continue? (y/N)", "N");
			rl.close();
			if (confirm.toLowerCase() === "y") {
				shell.run(cmd.teardown ?? "node scripts/run-e2e.mjs --teardown", { label: "Tearing down test vault..." });
			}
		}},
		{ key: "5", label: "Rebuild (teardown → prerequisites → installer)", action: async () => {
			log(`\n  ${YELLOW}This will teardown and rebuild the test vault from scratch.${RESET}`);
			const rl = createRL();
			const confirm = await ask(rl, "Continue? (y/N)", "N");
			rl.close();
			if (confirm.toLowerCase() === "y") {
				shell.run(cmd.rebuild ?? "node scripts/run-e2e.mjs --rebuild", { label: "Rebuilding test vault..." });
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
		shell.run(cmd.e2e ?? "node scripts/run-e2e.mjs --list", { label: "Starting interactive E2E session..." });
	},
};
