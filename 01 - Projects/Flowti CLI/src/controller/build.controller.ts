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
import { runProjectCi, type CiResult } from "../domain/build/ci-generator.js";
import { checkFreshness, recordBuild, resolveBuildPaths } from "../domain/build/build-freshness.js";

import {
	renderFreshnessCheck, renderBuildAuto, renderBuildRecorded,
	renderCiResult,
	type BuildAutoModel, type BuildRecordedModel,
} from "../ui/build-display.js";
import { renderShellCommand, type ShellCommandModel } from "../ui/common-renderers.js";

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
		const { shell } = req.deps;
		const cmd = resolveBuildCommand(req.project, "fast", ["build"], "npm run build");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Building..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "build" };
		return dataResponse(model, renderShellCommand);
	},
	"build:increment": (req) => {
		const { shell } = req.deps;
		const cmd = resolveBuildCommand(req.project, "increment", ["build:increment", "build"], "npm run build");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Building increment..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "build:increment" };
		return dataResponse(model, renderShellCommand);
	},
	"build:full": (req) => {
		const { shell } = req.deps;
		const cmd = resolveBuildCommand(req.project, "full", ["build:full", "build"], "npm run build");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Building full..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "build:full" };
		return dataResponse(model, renderShellCommand);
	},
	"build:watch": (req) => {
		const { shell } = req.deps;
		const resolved = resolveBuildCommand(req.project, "watch", ["build:dev", "build:watch"], "npm run build -- --watch");
		const reloadFlag = req.flags.reload ? " --reload" : "";
		const cmd = `${resolved}${reloadFlag}`;
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Watch mode..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "build:watch" };
		return dataResponse(model, renderShellCommand);
	},
	"build:distribute": (req) => {
		const { shell } = req.deps;
		const cmd = resolveBuildCommand(req.project, "distribute", ["build:distribute", "build"], "npm run build");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Distributing build..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "build:distribute" };
		return dataResponse(model, renderShellCommand);
	},
	"test": (req) => {
		const { shell } = req.deps;
		const cmd = resolveTestCommand(req.project, "unit", ["test"], "npm test");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running tests..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "test" };
		return dataResponse(model, renderShellCommand);
	},
	"test:increment": (req) => {
		const { shell } = req.deps;
		const cmd = resolveTestCommand(req.project, "increment", ["test:increment", "test"], "npm test");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running increment tests..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "test:increment" };
		return dataResponse(model, renderShellCommand);
	},
	"test:e2e": (req) => {
		const { shell } = req.deps;
		const cmd = resolveTestCommand(req.project, "e2e", ["test:e2e", "test"], "npm test");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running E2E tests..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "test:e2e" };
		return dataResponse(model, renderShellCommand);
	},
	"build:check": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const { srcDir, binDir } = resolveBuildPaths(req.project.path, { paths });
		const check = checkFreshness(srcDir, binDir, { disk, paths });

		return dataResponse(check, renderFreshnessCheck);
	},
	"build:auto": (req) => {
		if (!req.project) return;
		const { disk, paths, shell, clock } = req.deps;
		const { srcDir, binDir } = resolveBuildPaths(req.project.path, { paths });
		const check = checkFreshness(srcDir, binDir, { disk, paths });

		if (!check.needsRebuild) {
			const model: BuildAutoModel = { check, buildRan: false, manifest: null };
			return dataResponse(model, renderBuildAuto);
		}

		const exitCode = shell.run(pick(req.project, ["build"], "npm run build"), { cwd: req.project.path, label: "Rebuilding..." });
		const manifest = exitCode === 0 ? recordBuild(srcDir, binDir, { disk, paths, clock }) : null;
		const model: BuildAutoModel = { check, buildRan: exitCode === 0, manifest };

		return dataResponse(model, renderBuildAuto);
	},
	"build:record": (req) => {
		if (!req.project) return;
		const { disk, paths, clock } = req.deps;
		const { srcDir, binDir } = resolveBuildPaths(req.project.path, { paths });
		const manifest = recordBuild(srcDir, binDir, { disk, paths, clock });
		const model: BuildRecordedModel = { fileCount: manifest.fileCount, hashPrefix: manifest.sourceHash.slice(0, 12) };

		return dataResponse(model, renderBuildRecorded);
	},
	"project:ci": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const result = runProjectCi(req.project, req.flags["dry-run"] === true, { disk, paths });
		return dataResponse<CiResult>(result, renderCiResult);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
