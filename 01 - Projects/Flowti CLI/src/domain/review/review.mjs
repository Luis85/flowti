/**
 * review.mjs — E2E testing and vault management menu and commands.
 */

import { RESET, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { showHelp } from "../help/help.mjs";

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	let incrementPassed = false;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Review");
		printMenu([
			{ key: "1", label: "Start test session (interactive E2E)" },
			{ key: "2", label: "Build the increment" },
			{ key: "3", label: "Publish the increment", disabled: !incrementPassed },
			{ key: "4", label: "Teardown test vault" },
			{ key: "5", label: "Rebuild (teardown → prerequisites → installer)" },
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
				run("node scripts/run-e2e.mjs --list", "Starting interactive E2E session...");
				break;
			case "2": {
				const code = run("npm run build:increment", "Building increment...");
				if (code === 0) incrementPassed = true;
				break;
			}
			case "3": {
				if (!incrementPassed) {
					console.log(`\n  ${YELLOW}Cannot publish — run a successful increment build first (option 2).${RESET}\n`);
					break;
				}
				run("npm run build:release", "Publishing...");
				break;
			}
			case "4": {
				const teardownRl = createRL();
				console.log(`\n  ${YELLOW}This will reset the test vault to a fresh state.${RESET}`);
				const confirm = await ask(teardownRl, "Continue? (y/N)", "N");
				teardownRl.close();
				if (confirm.toLowerCase() === "y") {
					run("node scripts/run-e2e.mjs --teardown", "Tearing down test vault...");
				}
				break;
			}
			case "5": {
				const rebuildRl = createRL();
				console.log(`\n  ${YELLOW}This will teardown and rebuild the test vault from scratch.${RESET}`);
				const confirm = await ask(rebuildRl, "Continue? (y/N)", "N");
				rebuildRl.close();
				if (confirm.toLowerCase() === "y") {
					run("node scripts/run-e2e.mjs --rebuild", "Rebuilding test vault...");
				}
				break;
			}
			case "?":
				showHelp("review");
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
	review: () => {
		run("node scripts/run-e2e.mjs --list", "Starting interactive E2E session...");
	},
};
