/**
 * review.controller.ts — Controller for review commands.
 *
 * Returns typed data models; rendering is handled by ui/review-display.ts.
 * Extended with Review Platform commands: gates, traceability, evidence, audit, coverage.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ProjectContext, IShell, IPaths } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { VAULT_ROOT, PLUGIN_ROOT } from "../infrastructure/config.js";
import { resolveTestVaultRoot } from "../infrastructure/test-vault.js";
import { analyzeWorkingTree, analyzeBranchDiff } from "../domain/review/change-analysis.js";
import {
	renderChangeAnalysis, renderReviewClean, renderPipelineResult,
	renderGateResult, renderTraceabilityMatrix, renderCoverageReport, renderEvidenceList,
	type ChangeAnalysisModel, type ReviewCleanModel, type PipelineResultModel,
	type GateResultModel, type TraceabilityModel, type CoverageModel, type EvidenceListModel,
} from "../ui/displays/review-display.js";
import { startInteractiveSession, runE2ESuite } from "../domain/review/run-e2e.js";
import { interactiveSession } from "../ui/e2e/e2e-interactive.js";
import { renderShellCommand, renderInteractiveOnly, type ShellCommandModel, type InteractiveOnlyModel } from "../ui/renderers/common-renderers.js";
import { buildTraceabilityMatrix, detectGaps, validateTraceabilityLinks, coverageByCategory } from "../domain/review/traceability.js";
import { evaluateGates } from "../domain/review/quality-gates.js";
import { listRuns } from "../domain/review/evidence.js";
import { loadAllJourneys } from "../domain/e2e/journey/journey-loader.js";
import { requirementStore, useCaseStore, userStoryStore } from "../domain/requirements/requirement-store.js";

const REQ_DEFAULT_DIR = "docs/requirements";

// ── Helpers ─────────────────────────────────────────────────────────

function resolveTestVault(p: ProjectContext, pathsPort: IPaths): string {
	const config = p.config.review ?? {};
	if (config.testVault) return resolveTestVaultRoot(config.testVault, VAULT_ROOT);
	const projectName = pathsPort.basename(p.path);
	return resolveTestVaultRoot(`${projectName}-e2e`, VAULT_ROOT);
}

function runGatedPipeline(p: ProjectContext, shell: IShell): PipelineResultModel {
	const review = p.config.review ?? {};
	const buildCmd = review.build ?? "npm run build";
	const testCmd = review.test ?? "npm test";
	const e2eCmd = review.runner ?? "npx vitest run tests/e2e/";
	const buildCode = shell.run(buildCmd, { cwd: p.path, label: "Step 1/3: Build" });
	if (buildCode !== 0) return { stoppedAt: "build", reason: "build failed" };
	const testCode = shell.run(testCmd, { cwd: p.path, label: "Step 2/3: Test" });
	if (testCode !== 0) return { stoppedAt: "test", reason: "tests failed" };
	const e2eCode = shell.run(e2eCmd, { cwd: p.path, label: "Step 3/3: E2E" });
	return { stoppedAt: null, reason: e2eCode === 0 ? null : "e2e failed" };
}

function resolveJourneysDir(p: ProjectContext, pathsPort: IPaths): string {
	return pathsPort.join(p.path, p.config.review?.journeysDir ?? "tests/e2e/journeys");
}

// ── Union model types for interactive-only commands ──────────────────

interface InteractiveDoneModel {
	done: true;
}

type E2EResult = InteractiveOnlyModel | InteractiveDoneModel;

function renderE2EResult(data: E2EResult, _log: LogFn): void {
	if ("error" in data) { renderInteractiveOnly(data as InteractiveOnlyModel, _log); return; }
	// Interactive session already produced its own output — nothing to render.
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	review: adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = ctx.project?.config.review?.runner ?? "npm test";
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Starting review session..." });
			return { command: cmd, exitCode, label: "review" };
		},
		renderer: renderShellCommand,
	}),

	"review:all": adaptDescriptor<Record<string, unknown>, PipelineResultModel>({
		requires: "project",
		handler: (ctx) => {
			const { shell } = ctx.deps;
			return runGatedPipeline(ctx.project!, shell);
		},
		renderer: renderPipelineResult,
	}),

	"review:clean": adaptDescriptor<Record<string, unknown>, ReviewCleanModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const vaultPath = resolveTestVault(ctx.project!, paths);
			const exists = disk.existsSync(vaultPath);
			if (exists) {
				disk.rmSync(vaultPath, { recursive: true, force: true });
			}
			return { removed: exists, vaultPath };
		},
		renderer: renderReviewClean,
	}),

	"review:e2e": adaptDescriptor<Record<string, unknown>, E2EResult>({
		flags: {
			format: { type: "string", default: "" },
			journey: { type: "string", default: "" },
		},
		handler: async (ctx) => {
			if (ctx.flags.format === "json") {
				return { command: "review:e2e", error: "E2E suite is interactive and cannot produce JSON output." } as InteractiveOnlyModel;
			}
			const { disk, shell, paths, proc, log } = ctx.deps;
			const journeyFilter = (ctx.flags.journey as string) || undefined;
			await runE2ESuite(PLUGIN_ROOT, VAULT_ROOT, { disk, shell, paths, proc, log }, journeyFilter);
			return { done: true } as InteractiveDoneModel;
		},
		renderer: renderE2EResult,
	}),

	"review:e2e:list": adaptDescriptor<Record<string, unknown>, E2EResult>({
		flags: {
			format: { type: "string", default: "" },
		},
		handler: async (ctx) => {
			if (ctx.flags.format === "json") {
				return { command: "review:e2e:list", error: "Interactive session list cannot produce JSON output." } as InteractiveOnlyModel;
			}
			const { disk, paths, proc } = ctx.deps;
			await startInteractiveSession((e2e) => interactiveSession(e2e, ctx.deps), PLUGIN_ROOT, VAULT_ROOT, { disk, paths, proc });
			return { done: true } as InteractiveDoneModel;
		},
		renderer: renderE2EResult,
	}),

	"review:changes": adaptDescriptor<Record<string, unknown>, ChangeAnalysisModel>({
		requires: "project",
		flags: {
			base: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { shell, paths } = ctx.deps;
			const baseBranch = (ctx.flags.base as string) || undefined;
			const impact = baseBranch
				? analyzeBranchDiff(ctx.project!.path, { shell }, baseBranch)
				: analyzeWorkingTree(ctx.project!.path, { shell });
			const projectLabel = ctx.project!.config.name ?? paths.basename(ctx.project!.path);
			return { projectLabel, impact };
		},
		renderer: renderChangeAnalysis,
	}),

	"review:traceability": adaptDescriptor<Record<string, unknown>, TraceabilityModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const journeysDir = resolveJourneysDir(ctx.project!, paths);
			const readFile = (p: string) => disk.readFileSync(p, "utf-8");
			const listFiles = (d: string) => disk.existsSync(d) ? disk.readdirSync(d) : [];

			const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
			const reqConfig = ctx.project!.config.management?.requirements;
			const reqBaseDir = reqConfig?.dir ?? REQ_DEFAULT_DIR;
			const reqs = requirementStore.list({ disk, paths }, ctx.project!.path, reqConfig ? { dir: reqConfig.dir } : undefined);
			const ucs = useCaseStore.list({ disk, paths }, ctx.project!.path, { dir: `${reqBaseDir}/use-cases` });
			const uss = userStoryStore.list({ disk, paths }, ctx.project!.path, { dir: `${reqBaseDir}/user-stories` });

			const validation = validateTraceabilityLinks(
				journeys,
				reqs.map((r) => r.id),
				ucs.map((u) => u.id),
				uss.map((u) => u.id),
			);

			const matrix = buildTraceabilityMatrix(
				journeys,
				reqs.map((r) => ({ id: r.id, name: r.name, status: r.status })),
			);

			return { matrix, validation, projectLabel: ctx.project!.config.name ?? "" };
		},
		renderer: renderTraceabilityMatrix,
	}),

	"review:coverage": adaptDescriptor<Record<string, unknown>, CoverageModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const journeysDir = resolveJourneysDir(ctx.project!, paths);
			const readFile = (p: string) => disk.readFileSync(p, "utf-8");
			const listFiles = (d: string) => disk.existsSync(d) ? disk.readdirSync(d) : [];

			const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
			const reqs = requirementStore.list({ disk, paths }, ctx.project!.path, ctx.project!.config.management?.requirements ? { dir: ctx.project!.config.management.requirements.dir } : undefined);

			const matrix = buildTraceabilityMatrix(
				journeys,
				reqs.map((r) => ({ id: r.id, name: r.name, status: r.status })),
			);

			const gaps = detectGaps(matrix);
			const byCategory = coverageByCategory(matrix);

			return { matrix, gaps, byCategory, projectLabel: ctx.project!.config.name ?? "" };
		},
		renderer: renderCoverageReport,
	}),

	"review:gates": adaptDescriptor<Record<string, unknown>, GateResultModel>({
		requires: "project",
		handler: (ctx) => {
			const gateConfig = ctx.project!.config.review?.gates;
			if (!gateConfig) {
				return { evaluation: null, projectLabel: ctx.project!.config.name ?? "", message: "No quality gates configured in review.gates" };
			}
			const evaluation = evaluateGates(gateConfig, []);
			return { evaluation, projectLabel: ctx.project!.config.name ?? "" };
		},
		renderer: renderGateResult,
	}),

	"review:evidence": adaptDescriptor<Record<string, unknown>, EvidenceListModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const runs = listRuns({ disk, paths }, ctx.project!.path, ctx.project!.config.review?.evidenceDir);
			return { runs, projectLabel: ctx.project!.config.name ?? "" };
		},
		renderer: renderEvidenceList,
	}),
};
