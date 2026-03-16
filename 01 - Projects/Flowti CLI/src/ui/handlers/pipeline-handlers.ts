/**
 * pipeline-handlers.ts — Action handlers for review and publish pipeline menus.
 *
 * Module-level state tracks pipeline progress (buildPassed, testPassed, etc.)
 * across menu iterations within a single sitemap router session.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { ReviewConfig, PublishConfig, PublishEndpoint } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";

import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { VAULT_ROOT } from "../../infrastructure/config.js";
import { resolveTestVaultRoot, scaffoldTestVault } from "../../infrastructure/test-vault.js";
import { distribute } from "./pipeline-distribute.js";

// ── Deps subset ─────────────────────────────────────────────────────

type PipelineDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "input" | "log">;

// ── Review pipeline state ───────────────────────────────────────────

const review = { buildPassed: false, testPassed: false };

function reviewConfig(ctx: { project?: { config: { review?: ReviewConfig }; path: string } }): {
	config: ReviewConfig; projectPath: string;
} | null {
	if (!ctx.project) return null;
	return { config: ctx.project.config.review ?? {}, projectPath: ctx.project.path };
}

// ── Review helpers (ported from review-menu.ts) ─────────────────────

interface JourneyFile {
	name: string;
	path: string;
	meta: { journey?: string; description?: string };
}

function scanJourneys(projectPath: string, journeysDir: string, deps: Pick<CliDeps, "disk" | "paths">): JourneyFile[] {
	const dir = deps.paths.resolve(projectPath, journeysDir);
	if (!deps.disk.existsSync(dir)) return [];
	return deps.disk.readdirSync(dir)
		.filter((f) => f.endsWith(".journey") || f.endsWith(".journey.json"))
		.sort()
		.map((f) => {
			const fullPath = deps.paths.join(dir, f);
			let meta: Record<string, unknown> = {};
			try { meta = JSON.parse(deps.disk.readFileSync(fullPath, "utf-8")) as Record<string, unknown>; } catch { /* */ }
			return {
				name: f.replace(/\.journey(\.json)?$/, ""),
				path: fullPath,
				meta: { journey: meta.journey as string | undefined, description: meta.description as string | undefined },
			};
		});
}

function resolveTestVault(projectPath: string, config: ReviewConfig, deps: Pick<CliDeps, "paths">): string {
	if (config.testVault) return resolveTestVaultRoot(config.testVault, VAULT_ROOT);
	return resolveTestVaultRoot(`${deps.paths.basename(projectPath)}-e2e`, VAULT_ROOT);
}

function ensureTestVault(vaultPath: string, deps: Pick<CliDeps, "disk" | "paths" | "log">): boolean {
	const sourceBinDir = deps.paths.join(VAULT_ROOT, ".flowti", "bin");
	if (!deps.disk.existsSync(deps.paths.join(sourceBinDir, "main.mjs"))) {
		deps.log(`  ${RED}No CLI binary found at ${sourceBinDir}${RESET}`);
		deps.log(`  ${DIM}Run the build from the source project first.${RESET}\n`);
		return false;
	}
	const isNew = !deps.disk.existsSync(vaultPath);
	if (isNew) {
		scaffoldTestVault(vaultPath, { name: deps.paths.basename(vaultPath), sourceBinDir }, deps.disk);
		deps.log(`  ${GREEN}Created test vault:${RESET} ${vaultPath}\n`);
	} else {
		refreshTestVaultBin(vaultPath, sourceBinDir, deps);
		deps.log(`  ${GREEN}Refreshed CLI binary in test vault.${RESET}\n`);
	}
	return true;
}

function refreshTestVaultBin(vaultPath: string, sourceBinDir: string, deps: Pick<CliDeps, "disk" | "paths">): void {
	const binDir = deps.paths.join(vaultPath, ".flowti", "bin");
	deps.disk.mkdirSync(binDir, { recursive: true });
	for (const file of ["main.mjs", "main.mjs.map", "index.mjs"]) {
		const src = deps.paths.join(sourceBinDir, file);
		if (deps.disk.existsSync(src)) deps.disk.copyFileSync(src, deps.paths.join(binDir, file));
	}
}

// ── Publish pipeline state ──────────────────────────────────────────

const publish = { buildPassed: false, testPassed: false, distributePassed: false };

function publishConfig(ctx: { project?: { config: { publish?: PublishConfig }; path: string } }): {
	config: PublishConfig; projectPath: string;
} | null {
	if (!ctx.project) return null;
	return { config: ctx.project.config.publish ?? {}, projectPath: ctx.project.path };
}

// ── Journey selection ───────────────────────────────────────────────

async function selectAndRunJourney(projectPath: string, config: ReviewConfig, deps: PipelineDeps): Promise<void> {
	const journeysDir = config.journeysDir ?? "tests/e2e/journeys";
	const journeys = scanJourneys(projectPath, journeysDir, deps);
	if (journeys.length === 0) { deps.log(`\n  ${DIM}No journeys found.${RESET}\n`); return; }
	const runnerCmd = config.runner;
	if (!runnerCmd) { deps.log(`\n  ${YELLOW}No runner configured.${RESET}\n`); return; }
	const idx = await promptJourneyChoice(journeys, deps);
	if (idx < 0) return;
	const testVault = resolveTestVault(projectPath, config, deps);
	if (!ensureTestVault(testVault, deps)) return;
	const label = journeys[idx].meta.journey ?? journeys[idx].name;
	deps.shell.run(`${runnerCmd} --journey=${journeys[idx].name}`, { cwd: projectPath, label });
}

async function promptJourneyChoice(journeys: JourneyFile[], deps: Pick<CliDeps, "input" | "log">): Promise<number> {
	deps.log(`\n  ${BOLD}Select journey:${RESET}\n`);
	for (let i = 0; i < journeys.length; i++) {
		deps.log(`    ${i + 1}) ${journeys[i].meta.journey ?? journeys[i].name}`);
	}
	deps.log("");
	const choice = await deps.input.ask("Journey number");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= journeys.length) return -1;
	return idx;
}

// ── Registration ────────────────────────────────────────────────────

export function registerPipelineHandlers(registry: HandlerRegistry): void {
	// ── Review beforeRender ─────────────────────────────────────────

	registry.registerBeforeRender("review:banner", (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return;
		const { disk, paths, log } = ctx.deps;
		const journeysDir = r.config.journeysDir ?? "tests/e2e/journeys";
		const journeys = scanJourneys(r.projectPath, journeysDir, { disk, paths });
		const testVault = resolveTestVault(r.projectPath, r.config, { paths });
		const vaultExists = disk.existsSync(testVault);
		log(`    ${DIM}Journeys:${RESET}   ${journeys.length} found in ${journeysDir}`);
		log(`    ${DIM}Test vault:${RESET} ${vaultExists ? `${GREEN}exists${RESET}` : `${YELLOW}not created${RESET}`} ${DIM}(${testVault})${RESET}`);
		const buildIcon = review.buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = review.testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${DIM}○${RESET} E2E`);
		log("");
	});

	// ── Review action handlers ──────────────────────────────────────

	registry.registerAction("review:build", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { shell, input } = ctx.deps;
		const cmd = r.config.build ?? "npm run build";
		const code = shell.run(cmd, { cwd: r.projectPath, label: "Build" });
		review.buildPassed = code === 0;
		if (!review.buildPassed) review.testPassed = false;
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:test", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { shell, input, log } = ctx.deps;
		if (!review.buildPassed) { log(`\n  ${YELLOW}Build first (option 1).${RESET}\n`); await input.waitForEnter(); return undefined; }
		const cmd = r.config.test ?? "npm test";
		review.testPassed = shell.run(cmd, { cwd: r.projectPath, label: "Test" }) === 0;
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:e2e", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { shell, input, log, disk, paths } = ctx.deps;
		if (!review.testPassed) { log(`\n  ${YELLOW}Build and test first.${RESET}\n`); await input.waitForEnter(); return undefined; }
		const testVault = resolveTestVault(r.projectPath, r.config, { paths });
		if (!ensureTestVault(testVault, { disk, paths, log })) { await input.waitForEnter(); return undefined; }
		const cmd = r.config.runner ?? "npx vitest run tests/e2e/";
		shell.run(cmd, { cwd: r.projectPath, label: "E2E tests" });
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:journey", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { input, log } = ctx.deps;
		if (!review.testPassed) { log(`\n  ${YELLOW}Build and test first.${RESET}\n`); await input.waitForEnter(); return undefined; }
		await selectAndRunJourney(r.projectPath, r.config, ctx.deps);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:run-all", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { shell, input, log, disk, paths } = ctx.deps;
		const buildCmd = r.config.build ?? "npm run build";
		const testCmd = r.config.test ?? "npm test";
		log(`\n  ${CYAN}▸${RESET} Running full review pipeline...\n`);
		review.buildPassed = shell.run(buildCmd, { cwd: r.projectPath, label: "Step 1/3: Build" }) === 0;
		if (!review.buildPassed) { log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`); review.testPassed = false; await input.waitForEnter(); return undefined; }
		review.testPassed = shell.run(testCmd, { cwd: r.projectPath, label: "Step 2/3: Test" }) === 0;
		if (!review.testPassed) { log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`); await input.waitForEnter(); return undefined; }
		log(`\n  ${CYAN}▸${RESET} Step 3/3: E2E\n`);
		const testVault = resolveTestVault(r.projectPath, r.config, { paths });
		if (!ensureTestVault(testVault, { disk, paths, log })) { await input.waitForEnter(); return undefined; }
		const e2eCmd = r.config.runner ?? "npx vitest run tests/e2e/";
		shell.run(e2eCmd, { cwd: r.projectPath, label: "E2E tests" });
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:list-journeys", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { disk, paths, input, log } = ctx.deps;
		const journeysDir = r.config.journeysDir ?? "tests/e2e/journeys";
		const journeys = scanJourneys(r.projectPath, journeysDir, { disk, paths });
		if (journeys.length === 0) { log(`\n  ${DIM}No journeys found.${RESET}\n`); } else {
			log(`\n  ${BOLD}Journeys${RESET} ${DIM}(${journeysDir})${RESET}\n`);
			for (const j of journeys) {
				const title = j.meta.journey ?? j.name;
				const desc = j.meta.description ? `${DIM} — ${j.meta.description}${RESET}` : "";
				log(`    ${CYAN}${title}${RESET}${desc}`);
			}
			log("");
		}
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:new-journey", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { makeJourney } = await import("../menus/make-makers.js");
		await makeJourney(ctx.project.path, ctx.deps);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:vault-create", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { disk, paths, input, log } = ctx.deps;
		const testVault = resolveTestVault(r.projectPath, r.config, { paths });
		if (ensureTestVault(testVault, { disk, paths, log })) log(`  ${GREEN}✓${RESET} Test vault ready: ${testVault}\n`);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:vault-open", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { disk, paths, shell, input, log } = ctx.deps;
		const testVault = resolveTestVault(r.projectPath, r.config, { paths });
		if (ensureTestVault(testVault, { disk, paths, log })) shell.runSilent(`explorer "${testVault}"`);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:vault-teardown", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { shell, input, log } = ctx.deps;
		if (!r.config.teardown) { log(`\n  ${DIM}No teardown command configured.${RESET}\n`); await input.waitForEnter(); return undefined; }
		log(`\n  ${YELLOW}This will reset the test vault to a fresh state.${RESET}`);
		const confirm = await input.ask("Continue? (y/N)", "N");
		if (confirm.toLowerCase() === "y") {
			shell.run(r.config.teardown, { cwd: r.projectPath, label: "Teardown test vault" });
		}
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("review:vault-rebuild", async (ctx) => {
		const r = reviewConfig(ctx);
		if (!r) return undefined;
		const { shell, input, log } = ctx.deps;
		if (!r.config.rebuild) { log(`\n  ${DIM}No rebuild command configured.${RESET}\n`); await input.waitForEnter(); return undefined; }
		log(`\n  ${YELLOW}This will teardown and rebuild the test vault from scratch.${RESET}`);
		const confirm = await input.ask("Continue? (y/N)", "N");
		if (confirm.toLowerCase() === "y") {
			shell.run(r.config.rebuild, { cwd: r.projectPath, label: "Rebuild test vault" });
		}
		await input.waitForEnter();
		return undefined;
	});

	// ── Publish beforeRender ────────────────────────────────────────

	registry.registerBeforeRender("publish:banner", (ctx) => {
		const p = publishConfig(ctx);
		if (!p) return;
		const { log } = ctx.deps;
		const endpoints = p.config.endpoints ?? [];
		const buildIcon = publish.buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = publish.testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const distIcon = publish.distributePassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${distIcon} Distribute`);
		if (endpoints.length > 0) {
			log(`    ${DIM}Endpoints:${RESET} ${endpoints.map((e: PublishEndpoint) => e.name).join(", ")}`);
		} else {
			log(`    ${YELLOW}No endpoints configured${RESET}`);
		}
		log("");
	});

	// ── Publish action handlers ─────────────────────────────────────

	registry.registerAction("publish:build", async (ctx) => {
		const p = publishConfig(ctx);
		if (!p) return undefined;
		const { shell, input } = ctx.deps;
		const cmd = p.config.build ?? "npm run build";
		const code = shell.run(cmd, { cwd: p.projectPath, label: "Build" });
		publish.buildPassed = code === 0;
		if (!publish.buildPassed) { publish.testPassed = false; publish.distributePassed = false; }
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("publish:test", async (ctx) => {
		const p = publishConfig(ctx);
		if (!p) return undefined;
		const { shell, input, log } = ctx.deps;
		if (!publish.buildPassed) { log(`\n  ${YELLOW}Build first (option 1).${RESET}\n`); await input.waitForEnter(); return undefined; }
		const cmd = p.config.test ?? "npm test";
		publish.testPassed = shell.run(cmd, { cwd: p.projectPath, label: "Test" }) === 0;
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("publish:distribute", async (ctx) => {
		const p = publishConfig(ctx);
		if (!p) return undefined;
		const { disk, paths, input, log } = ctx.deps;
		if (!publish.testPassed) { log(`\n  ${YELLOW}Build and test first.${RESET}\n`); await input.waitForEnter(); return undefined; }
		publish.distributePassed = distribute(p.projectPath, p.config, { disk, paths, log }) === 0;
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("publish:run-all", async (ctx) => {
		const p = publishConfig(ctx);
		if (!p) return undefined;
		const { shell, input, log, disk, paths } = ctx.deps;
		const buildCmd = p.config.build ?? "npm run build";
		const testCmd = p.config.test ?? "npm test";
		log(`\n  ${CYAN}▸${RESET} Running full publish pipeline...\n`);
		publish.buildPassed = shell.run(buildCmd, { cwd: p.projectPath, label: "Step 1/3: Build" }) === 0;
		if (!publish.buildPassed) { log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`); publish.testPassed = false; await input.waitForEnter(); return undefined; }
		publish.testPassed = shell.run(testCmd, { cwd: p.projectPath, label: "Step 2/3: Test" }) === 0;
		if (!publish.testPassed) { log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`); await input.waitForEnter(); return undefined; }
		log(`\n  ${CYAN}▸${RESET} Step 3/3: Distribute\n`);
		publish.distributePassed = distribute(p.projectPath, p.config, { disk, paths, log }) === 0;
		await input.waitForEnter();
		return undefined;
	});
}
