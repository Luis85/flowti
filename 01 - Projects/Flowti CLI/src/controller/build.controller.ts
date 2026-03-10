/**
 * build.controller.ts — Controller for build and test commands.
 *
 * Most build commands are fire-and-forget shell runners with no response data.
 * build:check, build:auto, and build:record return typed data models.
 *
 * Returns typed data models; rendering is handled by ui/build-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { shell } from "../infrastructure/shell.js";
import { handleProjectCi } from "../domain/build/ci-generator.js";
import { checkFreshness, recordBuild, resolveBuildPaths } from "../domain/build/build-freshness.js";
import {
	renderFreshnessCheck, renderBuildAuto, renderBuildRecorded,
	type BuildAutoModel, type BuildRecordedModel,
} from "../ui/build-display.js";

// ── Command resolution ──────────────────────────────────────────────

function pick(p: ProjectContext | undefined, candidates: string[], fallback: string): string {
	if (p) {
		for (const name of candidates) {
			if (p.scripts[name]) return name === "test" ? "npm test" : `npm run ${name}`;
		}
	}
	return fallback;
}

function resolveBuildCommand(p: ProjectContext | undefined, mode: string, scriptCandidates: string[], fallback: string): string {
	const cmd = p?.config.build?.commands?.[mode];
	if (cmd) return cmd;
	return pick(p, scriptCandidates, fallback);
}

function resolveTestCommand(p: ProjectContext | undefined, mode: string, scriptCandidates: string[], fallback: string): string {
	const cmd = p?.config.test?.commands?.[mode];
	if (cmd) return cmd;
	return pick(p, scriptCandidates, fallback);
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"build": (req) => {
		shell.run(resolveBuildCommand(req.project, "fast", ["build"], "npm run build"), { cwd: req.project?.path, label: "Building..." });
	},
	"build:increment": (req) => {
		shell.run(resolveBuildCommand(req.project, "increment", ["build:increment", "build"], "npm run build"), { cwd: req.project?.path, label: "Building increment..." });
	},
	"build:full": (req) => {
		shell.run(resolveBuildCommand(req.project, "full", ["build:full", "build"], "npm run build"), { cwd: req.project?.path, label: "Building full..." });
	},
	"build:watch": (req) => {
		const resolved = resolveBuildCommand(req.project, "watch", ["build:dev", "build:watch"], "npm run build -- --watch");
		const reloadFlag = req.flags.reload ? " --reload" : "";
		shell.run(`${resolved}${reloadFlag}`, { cwd: req.project?.path, label: "Watch mode..." });
	},
	"build:distribute": (req) => {
		shell.run(resolveBuildCommand(req.project, "distribute", ["build:distribute", "build"], "npm run build"), { cwd: req.project?.path, label: "Distributing build..." });
	},
	"test": (req) => {
		shell.run(resolveTestCommand(req.project, "unit", ["test"], "npm test"), { cwd: req.project?.path, label: "Running tests..." });
	},
	"test:increment": (req) => {
		shell.run(resolveTestCommand(req.project, "increment", ["test:increment", "test"], "npm test"), { cwd: req.project?.path, label: "Running increment tests..." });
	},
	"test:e2e": (req) => {
		shell.run(resolveTestCommand(req.project, "e2e", ["test:e2e", "test"], "npm test"), { cwd: req.project?.path, label: "Running E2E tests..." });
	},
	"build:check": (req) => {
		if (!req.project) return;
		const { srcDir, binDir } = resolveBuildPaths(req.project.path);
		const check = checkFreshness(srcDir, binDir);

		return dataResponse(check, renderFreshnessCheck);
	},
	"build:auto": (req) => {
		if (!req.project) return;
		const { srcDir, binDir } = resolveBuildPaths(req.project.path);
		const check = checkFreshness(srcDir, binDir);

		if (!check.needsRebuild) {
			const model: BuildAutoModel = { check, buildRan: false, manifest: null };
			return dataResponse(model, renderBuildAuto);
		}

		const exitCode = shell.run(pick(req.project, ["build"], "npm run build"), { cwd: req.project.path, label: "Rebuilding..." });
		const manifest = exitCode === 0 ? recordBuild(srcDir, binDir) : null;
		const model: BuildAutoModel = { check, buildRan: exitCode === 0, manifest };

		return dataResponse(model, renderBuildAuto);
	},
	"build:record": (req) => {
		if (!req.project) return;
		const { srcDir, binDir } = resolveBuildPaths(req.project.path);
		const manifest = recordBuild(srcDir, binDir);
		const model: BuildRecordedModel = { fileCount: manifest.fileCount, hashPrefix: manifest.sourceHash.slice(0, 12) };

		return dataResponse(model, renderBuildRecorded);
	},
	"project:ci": (req) => {
		handleProjectCi(req.flags, req.rawArgs, req.command, req.project);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
