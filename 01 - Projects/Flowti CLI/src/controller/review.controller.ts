/**
 * review.controller.ts — Controller for review commands.
 *
 * Returns typed data models; rendering is handled by ui/review-display.ts.
 * Extended with Review Platform commands: gates, traceability, evidence, audit, coverage.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext, IShell, IPaths } from "../infrastructure/types.js";
import { VAULT_ROOT } from "../infrastructure/config.js";
import { resolveTestVaultRoot } from "../infrastructure/test-vault.js";
import { analyzeWorkingTree, analyzeBranchDiff } from "../domain/review/change-analysis.js";
import {
	renderChangeAnalysis, renderReviewClean, renderPipelineResult,
	renderGateResult, renderTraceabilityMatrix, renderCoverageReport, renderEvidenceList,
	type ChangeAnalysisModel, type ReviewCleanModel, type PipelineResultModel,
	type GateResultModel, type TraceabilityModel, type CoverageModel, type EvidenceListModel,
} from "../ui/review-display.js";
import { startInteractiveSession, runE2ESuite } from "../domain/review/run-e2e.js";
import { interactiveSession } from "../ui/e2e/e2e-interactive.js";
import { renderShellCommand, renderInteractiveOnly, type ShellCommandModel, type InteractiveOnlyModel } from "../ui/common-renderers.js";
import { buildTraceabilityMatrix, detectGaps, validateTraceabilityLinks, coverageByCategory } from "../domain/review/traceability.js";
import { evaluateGates } from "../domain/review/quality-gates.js";
import { listRuns } from "../domain/review/evidence.js";
import { loadAllJourneys } from "../domain/e2e/journey/journey-loader.js";
import { listRequirements, listUseCases, listUserStories } from "../domain/requirements/requirement-store.js";

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

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	review: (req) => {
		const { shell } = req.deps;
		const cmd = req.project?.config.review?.runner ?? "npm test";
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Starting review session..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "review" };
		return dataResponse(model, renderShellCommand);
	},
	"review:all": (req) => {
		if (!req.project) return;
		const { shell } = req.deps;
		const model = runGatedPipeline(req.project, shell);
		return dataResponse(model, renderPipelineResult);
	},
	"review:clean": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const vaultPath = resolveTestVault(req.project, paths);
		const exists = disk.existsSync(vaultPath);

		if (exists) {
			disk.rmSync(vaultPath, { recursive: true, force: true });
		}

		const model: ReviewCleanModel = { removed: exists, vaultPath };
		return dataResponse(model, renderReviewClean);
	},
	"review:e2e": async (req) => {
		if (req.format === "json") {
			const model: InteractiveOnlyModel = { command: "review:e2e", error: "E2E suite is interactive and cannot produce JSON output." };
			return dataResponse(model, renderInteractiveOnly);
		}
		const { disk, shell, paths, proc, log } = req.deps;
		const journeyFilter = typeof req.flags.journey === "string" ? req.flags.journey : undefined;
		await runE2ESuite({ disk, shell, paths, proc, log }, journeyFilter);
	},
	"review:e2e:list": async (req) => {
		if (req.format === "json") {
			const model: InteractiveOnlyModel = { command: "review:e2e:list", error: "Interactive session list cannot produce JSON output." };
			return dataResponse(model, renderInteractiveOnly);
		}
		const { disk, paths, proc } = req.deps;
		await startInteractiveSession(interactiveSession, { disk, paths, proc });
	},
	"review:changes": (req) => {
		if (!req.project) return;
		const { shell, paths } = req.deps;
		const baseBranch = typeof req.flags.base === "string" ? req.flags.base : undefined;
		const impact = baseBranch
			? analyzeBranchDiff(req.project.path, { shell }, baseBranch)
			: analyzeWorkingTree(req.project.path, { shell });
		const projectLabel = req.project.config.name ?? paths.basename(req.project.path);
		const model: ChangeAnalysisModel = { projectLabel, impact };

		return dataResponse(model, renderChangeAnalysis);
	},

	// ── New Review Platform commands ─────────────────────────────

	"review:traceability": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const journeysDir = resolveJourneysDir(req.project, paths);
		const readFile = (p: string) => disk.readFileSync(p, "utf-8");
		const listFiles = (d: string) => disk.existsSync(d) ? disk.readdirSync(d) : [];

		const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
		const reqs = listRequirements({ disk, paths }, req.project.path, req.project.config.management?.requirements);
		const ucs = listUseCases({ disk, paths }, req.project.path, req.project.config.management?.requirements);
		const uss = listUserStories({ disk, paths }, req.project.path, req.project.config.management?.requirements);

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

		const model: TraceabilityModel = { matrix, validation, projectLabel: req.project.config.name ?? "" };
		return dataResponse(model, renderTraceabilityMatrix);
	},

	"review:coverage": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const journeysDir = resolveJourneysDir(req.project, paths);
		const readFile = (p: string) => disk.readFileSync(p, "utf-8");
		const listFiles = (d: string) => disk.existsSync(d) ? disk.readdirSync(d) : [];

		const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
		const reqs = listRequirements({ disk, paths }, req.project.path, req.project.config.management?.requirements);

		const matrix = buildTraceabilityMatrix(
			journeys,
			reqs.map((r) => ({ id: r.id, name: r.name, status: r.status })),
		);

		const gaps = detectGaps(matrix);
		const byCategory = coverageByCategory(matrix);

		const model: CoverageModel = { matrix, gaps, byCategory, projectLabel: req.project.config.name ?? "" };
		return dataResponse(model, renderCoverageReport);
	},

	"review:gates": (req) => {
		if (!req.project) return;
		const gateConfig = req.project.config.review?.gates;
		if (!gateConfig) {
			const model: GateResultModel = { evaluation: null, projectLabel: req.project.config.name ?? "", message: "No quality gates configured in review.gates" };
			return dataResponse(model, renderGateResult);
		}

		// Gates require run results — for now evaluate against empty results (dry-run mode)
		const evaluation = evaluateGates(gateConfig, []);
		const model: GateResultModel = { evaluation, projectLabel: req.project.config.name ?? "" };
		return dataResponse(model, renderGateResult);
	},

	"review:evidence": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const runs = listRuns({ disk, paths }, req.project.path, req.project.config.review?.evidenceDir);
		const model: EvidenceListModel = { runs, projectLabel: req.project.config.name ?? "" };
		return dataResponse(model, renderEvidenceList);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
