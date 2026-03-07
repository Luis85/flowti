/**
 * publish.mjs — Gated release pipeline menu and commands.
 */

import { cliConfig } from "../../infrastructure/config.mjs";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { runMenu } from "../../infrastructure/menu.mjs";
import { showHelp } from "../help/help.mjs";

const cmd = cliConfig.publish?.commands ?? {};

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	let buildPassed = false;
	let testPassed = false;

	const beforeMenu = () => {
		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const publishIcon = `${DIM}○${RESET}`;
		console.log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${publishIcon} Publish\n`);
	};

	return runMenu("Publish", [
		{ key: "1", label: "Build the increment (check → build → test → reports)", action: () => {
			const code = run(cmd.increment ?? "npm run build:increment", "Building increment...");
			buildPassed = code === 0;
			if (!buildPassed) testPassed = false;
		}},
		{ key: "2", label: "Test the increment (E2E)",
			disabled: () => !buildPassed,
			disabledMessage: `\n  ${YELLOW}Build first (option 1).${RESET}\n`,
			action: () => { testPassed = run(cmd.e2e ?? "npm run test:e2e", "Running E2E tests...") === 0; },
		},
		{ key: "3", label: "Publish the increment",
			disabled: () => !testPassed,
			disabledMessage: `\n  ${YELLOW}Build and test first.${RESET}\n`,
			action: () => { run(cmd.release ?? "npm run build:release", "Publishing..."); },
		},
		{ key: "a", label: "Run all (build → test → publish)", action: () => {
			console.log(`\n  ${CYAN}▸${RESET} Running full publish pipeline...\n`);
			const buildCode = run(cmd.increment ?? "npm run build:increment", "Step 1/3: Building increment...");
			buildPassed = buildCode === 0;
			if (!buildPassed) {
				console.log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`);
				testPassed = false;
				return;
			}
			const testCode = run(cmd.e2e ?? "npm run test:e2e", "Step 2/3: Running E2E tests...");
			testPassed = testCode === 0;
			if (!testPassed) {
				console.log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`);
				return;
			}
			run(cmd.release ?? "npm run build:release", "Step 3/3: Publishing...");
		}},
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("publish"); } },
		{ key: "b", label: "Back", action: () => "main" },
		{ key: "q", label: "Quit", action: () => "quit" },
	], { beforeMenu });
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
