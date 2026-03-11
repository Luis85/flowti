/**
 * review.controller.ts — Controller for review commands.
 *
 * Returns typed data models; rendering is handled by ui/review-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { shell } from "../infrastructure/shell.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { VAULT_ROOT } from "../infrastructure/config.js";
import { resolveTestVaultRoot } from "../infrastructure/test-vault.js";
import { analyzeWorkingTree, analyzeBranchDiff } from "../domain/review/change-analysis.js";
import { renderChangeAnalysis, renderReviewClean, renderPipelineResult, type ChangeAnalysisModel, type ReviewCleanModel, type PipelineResultModel } from "../ui/review-display.js";
import { startInteractiveSession, runE2ESuite } from "../domain/review/run-e2e.js";
import { interactiveSession } from "../ui/e2e/e2e-interactive.js";
import { renderShellCommand, renderInteractiveOnly, type ShellCommandModel, type InteractiveOnlyModel } from "../ui/common-renderers.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolveTestVault(p: ProjectContext): string {
	const config = p.config.review ?? {};
	if (config.testVault) return resolveTestVaultRoot(config.testVault, VAULT_ROOT);
	const projectName = paths.basename(p.path);
	return resolveTestVaultRoot(`${projectName}-e2e`, VAULT_ROOT);
}

function runGatedPipeline(p: ProjectContext): PipelineResultModel {
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

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	review: (req) => {
		const cmd = req.project?.config.review?.runner ?? "npm test";
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Starting review session..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "review" };
		return dataResponse(model, renderShellCommand);
	},
	"review:all": (req) => {
		if (!req.project) return;
		const model = runGatedPipeline(req.project);
		return dataResponse(model, renderPipelineResult);
	},
	"review:clean": (req) => {
		if (!req.project) return;
		const vaultPath = resolveTestVault(req.project);
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
		const journeyFilter = typeof req.flags.journey === "string" ? req.flags.journey : undefined;
		await runE2ESuite(journeyFilter);
	},
	"review:e2e:list": async (req) => {
		if (req.format === "json") {
			const model: InteractiveOnlyModel = { command: "review:e2e:list", error: "Interactive session list cannot produce JSON output." };
			return dataResponse(model, renderInteractiveOnly);
		}
		await startInteractiveSession(interactiveSession);
	},
	"review:changes": (req) => {
		if (!req.project) return;
		const baseBranch = typeof req.flags.base === "string" ? req.flags.base : undefined;
		const impact = baseBranch
			? analyzeBranchDiff(req.project.path, baseBranch)
			: analyzeWorkingTree(req.project.path);
		const projectLabel = req.project.config.name ?? paths.basename(req.project.path);
		const model: ChangeAnalysisModel = { projectLabel, impact };

		return dataResponse(model, renderChangeAnalysis);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
