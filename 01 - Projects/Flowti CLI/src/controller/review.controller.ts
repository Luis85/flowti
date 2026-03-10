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
import { log } from "../infrastructure/logger.js";
import { resolveTestVaultRoot } from "../infrastructure/test-vault.js";
import { analyzeWorkingTree, analyzeBranchDiff } from "../domain/review/change-analysis.js";
import { renderChangeAnalysis, renderReviewClean, type ChangeAnalysisModel, type ReviewCleanModel } from "../ui/review-display.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolveTestVault(p: ProjectContext): string {
	const config = p.config.review ?? {};
	if (config.testVault) return resolveTestVaultRoot(config.testVault, VAULT_ROOT);
	const projectName = paths.basename(p.path);
	return resolveTestVaultRoot(`${projectName}-e2e`, VAULT_ROOT);
}

function runGatedPipeline(p: ProjectContext): void {
	const review = p.config.review ?? {};
	const buildCmd = review.build ?? "npm run build";
	const testCmd = review.test ?? "npm test";
	const e2eCmd = review.runner ?? "npx vitest run tests/e2e/";
	const buildCode = shell.run(buildCmd, { cwd: p.path, label: "Step 1/3: Build" });
	if (buildCode !== 0) { log("Pipeline stopped — build failed."); return; }
	const testCode = shell.run(testCmd, { cwd: p.path, label: "Step 2/3: Test" });
	if (testCode !== 0) { log("Pipeline stopped — tests failed."); return; }
	shell.run(e2eCmd, { cwd: p.path, label: "Step 3/3: E2E" });
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	review: (req) => {
		const cmd = req.project?.config.review?.runner ?? "npm test";
		shell.run(cmd, { cwd: req.project?.path, label: "Starting review session..." });
	},
	"review:all": (req) => {
		if (!req.project) return;
		runGatedPipeline(req.project);
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
