/**
 * e2e-runner.ts — E2E execution orchestration via the generic pipeline.
 *
 * All E2E workflows are composed as pipeline steps and executed through
 * the resilient pipeline runner. Individual operations (vitest, report
 * generation, plugin restore) remain as focused functions for reuse.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { runPipeline } from "../../infrastructure/pipeline/pipeline-runner.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { SessionConfig, JourneyEntry, PrerequisiteResults } from "./e2e-types.js";
import { resolveJourneyNames } from "./e2e-session.js";
import { printExecutionBanner } from "../../ui/e2e/e2e-formatters.js";
import { buildSessionPipeline } from "./pipelines/session-pipeline.js";

// ── Vitest execution ────────────────────────────────────────────────

export function runVitest(e2e: E2EPaths): number {
	return shell.run("npx vitest run --config tests/e2e/vitest.e2e.config.ts", { cwd: e2e.projectRoot });
}

// ── Report generation ───────────────────────────────────────────────

export function generateReport(e2e: E2EPaths): string | null {
	const output = shell.runSilent("node scripts/generate-e2e-report.mjs", { cwd: e2e.projectRoot });
	if (output !== null) {
		log(output);
		const match = output.match(/E2EReport written:\s*(.+)/);
		if (match) return paths.relative(e2e.testVault, match[1].trim()).replace(/\\/g, "/");
	}
	return null;
}

export function restorePluginState(e2e: E2EPaths): void {
	if (disk.existsSync(e2e.dataJsonPath)) {
		try {
			const data = JSON.parse(disk.readFileSync(e2e.dataJsonPath, "utf-8")) as Record<string, unknown>;
			if (data.installer && (data.installer as Record<string, unknown>).installed === false) {
				(data.installer as Record<string, unknown>).installed = true;
				disk.writeFileSync(e2e.dataJsonPath, JSON.stringify(data), "utf-8");
			}
		} catch {
			// best-effort
		}
	}
	shell.runSilent(`obsidian vault=${e2e.vaultName} eval code="app.plugins.enablePlugin('${e2e.pluginId}')"`);
	shell.runSilent(`obsidian vault=${e2e.vaultName} eval code="(() => { try { app.commands.executeCommandById('${e2e.pluginId}:flowti:open-event-log'); } catch(e) {} })()"`);
}

export function openReportInObsidian(reportVaultPath: string, e2e: E2EPaths): void {
	log("[e2e] Opening report in Obsidian...");
	shell.runSilent(`obsidian vault=${e2e.vaultName} open path="${reportVaultPath}"`);
	shell.runSilent(`obsidian vault=${e2e.vaultName} eval code="(() => { const existing = app.workspace.getLeavesOfType('outline')[0]; if (existing) { app.workspace.revealLeaf(existing); return; } const leaf = app.workspace.getRightLeaf(false); if (leaf) leaf.setViewState({ type: 'outline', active: true }); })()"`);
}

export function generateReportAndOpen(e2e: E2EPaths): void {
	log("\n[e2e] Generating E2E report (this may take a moment)...\n");
	const reportVaultPath = generateReport(e2e);
	if (reportVaultPath) {
		openReportInObsidian(reportVaultPath, e2e);
		restorePluginState(e2e);
	}
}

// ── Session execution (pipeline-based) ──────────────────────────────

export async function executeSession(config: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults, e2e: E2EPaths): Promise<number> {
	const selectedNames = resolveJourneyNames(config.selectedSlugs, entries);
	printExecutionBanner(config, selectedNames);

	const startTime = Date.now();
	const steps = buildSessionPipeline(e2e, {
		config,
		entries,
		prereqResults,
		startTime,
	});

	const result = await runPipeline(steps, e2e.projectRoot, {
		label: `E2E Session: ${config.sessionName}`,
	});

	return result.failed > 0 ? 1 : 0;
}
