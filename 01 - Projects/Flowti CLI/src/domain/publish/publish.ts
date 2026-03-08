/**
 * publish.ts — Gated release pipeline menu and commands.
 */

import { config } from "../../infrastructure/config.js";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";

const cmd = (config as Record<string, Record<string, Record<string, string>>>).publish?.commands ?? {};

export async function menu(): Promise<MenuResult> {
	let buildPassed = false;
	let testPassed = false;

	const beforeMenu = (): void => {
		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const publishIcon = `${DIM}○${RESET}`;
		log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${publishIcon} Publish\n`);
	};

	return runMenu("Publish", [
		{ key: "1", label: "Build the increment (check → build → test → reports)", action: () => {
			const code = shell.run(cmd.increment ?? "npm run build:increment", { label: "Building increment..." });
			buildPassed = code === 0;
			if (!buildPassed) testPassed = false;
		}},
		{ key: "2", label: "Test the increment (E2E)",
			disabled: () => !buildPassed,
			disabledMessage: `\n  ${YELLOW}Build first (option 1).${RESET}\n`,
			action: () => { testPassed = shell.run(cmd.e2e ?? "npm run test:e2e", { label: "Running E2E tests..." }) === 0; },
		},
		{ key: "3", label: "Publish the increment",
			disabled: () => !testPassed,
			disabledMessage: `\n  ${YELLOW}Build and test first.${RESET}\n`,
			action: () => { shell.run(cmd.release ?? "npm run build:release", { label: "Publishing..." }); },
		},
		{ key: "a", label: "Run all (build → test → publish)", action: () => {
			log(`\n  ${CYAN}▸${RESET} Running full publish pipeline...\n`);
			const buildCode = shell.run(cmd.increment ?? "npm run build:increment", { label: "Step 1/3: Building increment..." });
			buildPassed = buildCode === 0;
			if (!buildPassed) {
				log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`);
				testPassed = false;
				return;
			}
			const testCode = shell.run(cmd.e2e ?? "npm run test:e2e", { label: "Step 2/3: Running E2E tests..." });
			testPassed = testCode === 0;
			if (!testPassed) {
				log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`);
				return;
			}
			shell.run(cmd.release ?? "npm run build:release", { label: "Step 3/3: Publishing..." });
		}},
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("publish"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	], { beforeMenu });
}

export const commands = {
	publish: () => {
		shell.run(cmd.release ?? "npm run build:release", { label: "Publishing..." });
	},
	"publish:all": () => {
		const b = shell.run(cmd.increment ?? "npm run build:increment", { label: "Step 1/3: Building increment..." });
		if (b !== 0) proc.exit(b);
		const t = shell.run(cmd.e2e ?? "npm run test:e2e", { label: "Step 2/3: Running E2E tests..." });
		if (t !== 0) proc.exit(t);
		shell.run(cmd.release ?? "npm run build:release", { label: "Step 3/3: Publishing..." });
	},
};
