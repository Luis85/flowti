/**
 * project-review.ts — E2E journey review for the selected project.
 *
 * Scans for .journey files, provides a gated pipeline (build → test → E2E),
 * and manages a dedicated test vault for the project.
 *
 * Configured via flowti.config.json "review" section.
 */

import path from "node:path";
import { disk } from "../../infrastructure/filesystem.js";
import { VAULT_ROOT } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { runMenu } from "../../infrastructure/menu.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import type { MenuEntry, MenuResult, ReviewConfig } from "../../types.js";
import { log } from "../../infrastructure/logger.js";

// ── Journey scanning ────────────────────────────────────────────────

interface JourneyFile {
	name: string;
	path: string;
	meta: { journey?: string; description?: string };
}

function scanJourneys(projectPath: string, journeysDir: string): JourneyFile[] {
	const dir = path.resolve(projectPath, journeysDir);
	if (!disk.existsSync(dir)) return [];

	return disk.readdirSync(dir)
		.filter((f) => f.endsWith(".journey") || f.endsWith(".journey.json"))
		.sort()
		.map((f) => {
			const fullPath = path.join(dir, f);
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
	const baseDir = path.resolve(VAULT_ROOT, "..");
	if (config.testVault) return path.resolve(baseDir, config.testVault);
	const projectName = path.basename(projectPath);
	return path.resolve(baseDir, `${projectName}-e2e`);
}

function ensureTestVault(vaultPath: string): boolean {
	if (disk.existsSync(vaultPath)) return true;
	disk.mkdirSync(vaultPath, { recursive: true });
	log(`  ${GREEN}Created test vault:${RESET} ${vaultPath}\n`);
	return true;
}

// ── Interactive review menu ─────────────────────────────────────────

export async function reviewMenu(projectPath: string, config: ReviewConfig): Promise<MenuResult> {
	const journeysDir = config.journeysDir ?? "tests/e2e/journeys";
	const journeys = scanJourneys(projectPath, journeysDir);
	const testVault = resolveTestVault(projectPath, config);
	let buildPassed = false;

	const buildCmd = config.build ?? "npm run build";
	const testCmd = config.test ?? "npm test";
	const runnerCmd = config.runner;

	const beforeMenu = (): void => {
		const vaultExists = disk.existsSync(testVault);
		log(`    ${DIM}Journeys:${RESET}   ${journeys.length} found in ${journeysDir}`);
		log(`    ${DIM}Test vault:${RESET} ${vaultExists ? `${GREEN}exists${RESET}` : `${YELLOW}not created${RESET}`} ${DIM}(${testVault})${RESET}`);
		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${DIM}○${RESET} E2E`);
		log();
	};

	const items: MenuEntry[] = [
		{ key: "1", label: "Build the project", action: () => {
			const code = shell.run(buildCmd, { cwd: projectPath, label: "Build" });
			buildPassed = code === 0;
		}},
		{ key: "2", label: "Run unit tests", action: () => {
			shell.run(testCmd, { cwd: projectPath, label: "Unit tests" });
		}},
	];

	// Journey-specific items
	if (journeys.length > 0) {
		if (runnerCmd) {
			items.push(
				{ key: "3", label: "Run all journeys", action: () => {
					ensureTestVault(testVault);
					shell.run(runnerCmd, { cwd: projectPath, label: "All journeys" });
				}},
				{ key: "j", label: "Run specific journey...", action: async () => {
					const journeyItems = journeys.map((j, i) => ({
						key: String(i + 1),
						label: j.meta.journey ?? j.name,
						action: () => {
							ensureTestVault(testVault);
							shell.run(`${runnerCmd} --journey=${j.name}`, { cwd: projectPath, label: j.meta.journey ?? j.name });
							return "main" as const;
						},
					}));
					journeyItems.push(
						{ key: "b", label: "Back", action: () => "main" as const },
					);
					await runMenu("Journeys", [
						...journeyItems,
						{ separator: true } as const,
						{ key: "b", label: "Back", action: () => "main" as const },
					]);
					return "main" as const;
				}},
			);
		} else {
			items.push(
				{ key: "3", label: "Run E2E tests",
					disabled: () => !buildPassed,
					disabledMessage: `\n  ${YELLOW}Build first (option 1).${RESET}\n`,
					action: () => {
						ensureTestVault(testVault);
						const e2eCmd = `npx vitest run tests/e2e/`;
						shell.run(e2eCmd, { cwd: projectPath, label: "E2E tests" });
					},
				},
			);
		}
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
				const rl = createRL();
				const confirm = await ask(rl, "Continue? (y/N)", "N");
				rl.close();
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
				const rl = createRL();
				const confirm = await ask(rl, "Continue? (y/N)", "N");
				rl.close();
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
