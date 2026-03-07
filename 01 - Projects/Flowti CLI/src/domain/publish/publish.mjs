/**
 * publish.mjs — Gated release pipeline menu and commands.
 */

import { cliConfig } from "../../infrastructure/config.mjs";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { showHelp } from "../help/help.mjs";

const cmd = cliConfig.publish?.commands ?? {};

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	let buildPassed = false;
	let testPassed = false;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Publish");

		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const publishIcon = `${DIM}○${RESET}`;

		console.log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${publishIcon} Publish\n`);

		printMenu([
			{ key: "1", label: "Build the increment (check → build → test → reports)" },
			{ key: "2", label: "Test the increment (E2E)", disabled: !buildPassed },
			{ key: "3", label: "Publish the increment", disabled: !testPassed },
			{ key: "a", label: "Run all (build → test → publish)" },
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
				const code = run(cmd.increment ?? "npm run build:increment", "Building increment...");
				buildPassed = code === 0;
				if (!buildPassed) testPassed = false;
				break;
			}
			case "2": {
				if (!buildPassed) {
					console.log(`\n  ${YELLOW}Build first (option 1).${RESET}\n`);
					break;
				}
				const code = run(cmd.e2e ?? "npm run test:e2e", "Running E2E tests...");
				testPassed = code === 0;
				break;
			}
			case "3": {
				if (!testPassed) {
					console.log(`\n  ${YELLOW}Build and test first.${RESET}\n`);
					break;
				}
				run(cmd.release ?? "npm run build:release", "Publishing...");
				break;
			}
			case "a": {
				console.log(`\n  ${CYAN}▸${RESET} Running full publish pipeline...\n`);
				const buildCode = run(cmd.increment ?? "npm run build:increment", "Step 1/3: Building increment...");
				buildPassed = buildCode === 0;
				if (!buildPassed) {
					console.log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`);
					testPassed = false;
					break;
				}
				const testCode = run(cmd.e2e ?? "npm run test:e2e", "Step 2/3: Running E2E tests...");
				testPassed = testCode === 0;
				if (!testPassed) {
					console.log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`);
					break;
				}
				run(cmd.release ?? "npm run build:release", "Step 3/3: Publishing...");
				break;
			}
			case "?":
				showHelp("publish");
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
	publish: () => {
		run(cmd.release ?? "npm run build:release", "Publishing...");
	},
	"publish:all": () => {
		const b = run(cmd.increment ?? "npm run build:increment", "Step 1/3: Building increment...");
		if (b !== 0) process.exit(b);
		const t = run(cmd.e2e ?? "npm run test:e2e", "Step 2/3: Running E2E tests...");
		if (t !== 0) process.exit(t);
		run(cmd.release ?? "npm run build:release", "Step 3/3: Publishing...");
	},
};
