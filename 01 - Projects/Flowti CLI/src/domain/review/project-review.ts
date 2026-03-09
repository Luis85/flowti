/**
 * project-review.ts — E2E journey review for the selected project.
 *
 * Scans for .journey files, provides a gated pipeline (build → test → E2E),
 * and manages a dedicated test vault for the project.
 *
 * Configured via flowti.config.json "review" section.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { VAULT_ROOT, CLI_PROJECT } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { runMenu } from "../../infrastructure/menu.js";
import { input } from "../../infrastructure/input.js";
import type { MenuEntry, MenuResult, ReviewConfig } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";
import { resolveTestVaultRoot, scaffoldTestVault } from "../../infrastructure/test-vault.js";
import { makeJourney } from "../make/makers.js";

// ── Journey scanning ────────────────────────────────────────────────

interface JourneyFile {
	name: string;
	path: string;
	meta: { journey?: string; description?: string };
}

function scanJourneys(projectPath: string, journeysDir: string): JourneyFile[] {
	const dir = paths.resolve(projectPath, journeysDir);
	if (!disk.existsSync(dir)) return [];

	return disk.readdirSync(dir)
		.filter((f) => f.endsWith(".journey") || f.endsWith(".journey.json"))
		.sort()
		.map((f) => {
			const fullPath = paths.join(dir, f);
			let meta: Record<string, unknown> = {};
			try {
				meta = JSON.parse(disk.readFileSync(fullPath, "utf-8")) as Record<string, unknown>;
			} catch { /* ignore */ }
			return {
				name: f.replace(/\.journey(\.json)?$/, ""),
				path: fullPath,
				meta: { journey: meta.journey as string | undefined, description: meta.description as string | undefined },
			};
		});
}

// ── Test vault management ───────────────────────────────────────────

function resolveTestVault(projectPath: string, config: ReviewConfig): string {
	if (config.testVault) {
		return resolveTestVaultRoot(config.testVault, VAULT_ROOT);
	}
	const projectName = paths.basename(projectPath);
	return resolveTestVaultRoot(`${projectName}-e2e`, VAULT_ROOT);
}

function ensureTestVault(vaultPath: string): boolean {
	// Always build a fresh CLI binary before scaffolding/refreshing
	log(`\n  ${CYAN}▸${RESET} Building CLI...\n`);
	const buildCode = shell.run("npm run build", { cwd: CLI_PROJECT, label: "CLI build" });
	if (buildCode !== 0) {
		log(`  ${RED}CLI build failed — cannot provision test vault.${RESET}\n`);
		return false;
	}

	const sourceBinDir = paths.join(VAULT_ROOT, ".flowti", "bin");
	const isNew = !disk.existsSync(vaultPath);

	if (isNew) {
		scaffoldTestVault(vaultPath, { name: paths.basename(vaultPath), sourceBinDir }, disk);
		log(`  ${GREEN}Created test vault:${RESET} ${vaultPath}\n`);
	} else {
		// Vault exists — refresh the CLI binary from the fresh build
		refreshTestVaultBin(vaultPath, sourceBinDir);
		log(`  ${GREEN}Refreshed CLI build in test vault.${RESET}\n`);
	}
	return true;
}

function refreshTestVaultBin(vaultPath: string, sourceBinDir: string): void {
	const binDir = paths.join(vaultPath, ".flowti", "bin");
	disk.mkdirSync(binDir, { recursive: true });
	const binFiles = ["main.js", "main.js.map", "index.js"];
	for (const file of binFiles) {
		const src = paths.join(sourceBinDir, file);
		if (disk.existsSync(src)) {
			disk.copyFileSync(src, paths.join(binDir, file));
		}
	}
}

// ── Interactive review menu ─────────────────────────────────────────

export async function reviewMenu(projectPath: string, config: ReviewConfig): Promise<MenuResult> {
	const journeysDir = config.journeysDir ?? "tests/e2e/journeys";
	const journeys = scanJourneys(projectPath, journeysDir);
	const testVault = resolveTestVault(projectPath, config);
	let buildPassed = false;
	let testPassed = false;

	const buildCmd = config.build ?? "npm run build";
	const testCmd = config.test ?? "npm test";
	const runnerCmd = config.runner;

	const beforeMenu = (): void => {
		const vaultExists = disk.existsSync(testVault);
		log(`    ${DIM}Journeys:${RESET}   ${journeys.length} found in ${journeysDir}`);
		log(`    ${DIM}Test vault:${RESET} ${vaultExists ? `${GREEN}exists${RESET}` : `${YELLOW}not created${RESET}`} ${DIM}(${testVault})${RESET}`);
		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${DIM}○${RESET} E2E`);
		log();
	};

	const items: MenuEntry[] = [
		{ key: "1", label: "Build", action: () => {
			const code = shell.run(buildCmd, { cwd: projectPath, label: "Build" });
			buildPassed = code === 0;
			if (!buildPassed) testPassed = false;
		}},
		{ key: "2", label: "Test",
			disabled: () => !buildPassed,
			disabledMessage: `\n  ${YELLOW}Build first (option 1).${RESET}\n`,
			action: () => {
				testPassed = shell.run(testCmd, { cwd: projectPath, label: "Test" }) === 0;
			},
		},
	];

	// Journey-specific items — gated behind build + test
	if (journeys.length > 0) {
		const e2eDisabled = (): boolean => !testPassed;
		const e2eDisabledMessage = `\n  ${YELLOW}Build and test first.${RESET}\n`;

		if (runnerCmd) {
			items.push(
				{ key: "3", label: "Run all journeys",
					disabled: e2eDisabled,
					disabledMessage: e2eDisabledMessage,
					action: () => {
						ensureTestVault(testVault);
						shell.run(runnerCmd, { cwd: projectPath, label: "All journeys" });
					},
				},
				{ key: "j", label: "Run specific journey...",
					disabled: e2eDisabled,
					disabledMessage: e2eDisabledMessage,
					action: async () => {
						const journeyItems = journeys.map((j, i) => ({
							key: String(i + 1),
							label: j.meta.journey ?? j.name,
							action: () => {
								ensureTestVault(testVault);
								shell.run(`${runnerCmd} --journey=${j.name}`, { cwd: projectPath, label: j.meta.journey ?? j.name });
								return "main" as const;
							},
						}));
						await runMenu("Journeys", [
							...journeyItems,
							{ separator: true } as const,
							{ key: "b", label: "Back", action: () => "main" as const },
						]);
						return "main" as const;
					},
				},
			);
		} else {
			items.push(
				{ key: "3", label: "Run E2E tests",
					disabled: e2eDisabled,
					disabledMessage: e2eDisabledMessage,
					action: () => {
						ensureTestVault(testVault);
						const e2eCmd = `npx vitest run tests/e2e/`;
						shell.run(e2eCmd, { cwd: projectPath, label: "E2E tests" });
					},
				},
			);
		}

		// Run all: build → test → E2E (sequential, stops on failure)
		items.push(
			{ key: "a", label: "Run all (build → test → E2E)", action: () => {
				log(`\n  ${CYAN}▸${RESET} Running full review pipeline...\n`);
				const buildCode = shell.run(buildCmd, { cwd: projectPath, label: "Step 1/3: Build" });
				buildPassed = buildCode === 0;
				if (!buildPassed) {
					log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`);
					testPassed = false;
					return;
				}
				const testCode = shell.run(testCmd, { cwd: projectPath, label: "Step 2/3: Test" });
				testPassed = testCode === 0;
				if (!testPassed) {
					log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`);
					return;
				}
				log(`\n  ${CYAN}▸${RESET} Step 3/3: E2E\n`);
				ensureTestVault(testVault);
				const e2eCmd = runnerCmd ?? `npx vitest run tests/e2e/`;
				shell.run(e2eCmd, { cwd: projectPath, label: "E2E tests" });
			}},
		);
	}

	// Journey listing
	if (journeys.length > 0) {
		items.push(
			{ key: "l", label: "List journeys", action: () => {
				log(`\n  ${BOLD}Journeys${RESET} ${DIM}(${journeysDir})${RESET}\n`);
				for (const j of journeys) {
					const title = j.meta.journey ?? j.name;
					const desc = j.meta.description ? `${DIM} — ${j.meta.description}${RESET}` : "";
					log(`    ${CYAN}${title}${RESET}${desc}`);
				}
				log();
			}},
		);
	}

	// Journey creation
	items.push(
		{ key: "n", label: "New journey", action: async () => {
			await makeJourney(projectPath);
			return "main" as const;
		}},
	);

	// Test vault management
	items.push(
		{ key: "v", label: "Create/ensure test vault", action: () => {
			ensureTestVault(testVault);
			log(`  ${GREEN}✓${RESET} Test vault ready: ${testVault}\n`);
		}},
		{ key: "o", label: "Open test vault in Explorer", action: () => {
			ensureTestVault(testVault);
			shell.runSilent(`explorer "${testVault}"`);
		}},
	);

	if (config.teardown) {
		items.push(
			{ key: "t", label: "Teardown test vault", action: async () => {
				log(`\n  ${YELLOW}This will reset the test vault to a fresh state.${RESET}`);
				const confirm = await input.ask("Continue? (y/N)", "N");
				if (confirm.toLowerCase() === "y") {
					shell.run(config.teardown!, { cwd: projectPath, label: "Teardown test vault" });
				}
			}},
		);
	}

	if (config.rebuild) {
		items.push(
			{ key: "x", label: "Rebuild test vault (teardown + setup)", action: async () => {
				log(`\n  ${YELLOW}This will teardown and rebuild the test vault from scratch.${RESET}`);
				const confirm = await input.ask("Continue? (y/N)", "N");
				if (confirm.toLowerCase() === "y") {
					shell.run(config.rebuild!, { cwd: projectPath, label: "Rebuild test vault" });
				}
			}},
		);
	}

	return runMenu("Review", [
		...items,
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	], { beforeMenu });
}
