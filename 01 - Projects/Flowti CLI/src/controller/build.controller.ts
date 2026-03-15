/**
 * build.controller.ts — Controller for build and test commands.
 *
 * Most build commands are fire-and-forget shell runners with no response data.
 * build:check, build:auto, and build:record return typed data models.
 *
 * Returns typed data models; rendering is handled by ui/build-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { runProjectCi, type CiResult } from "../domain/build/ci-generator.js";
import { checkFreshness, recordBuild, resolveBuildPaths } from "../domain/build/build-freshness.js";

import {
	renderFreshnessCheck, renderBuildAuto, renderBuildRecorded,
	renderCiResult,
	type BuildAutoModel, type BuildRecordedModel,
} from "../ui/displays/build-display.js";
import { renderShellCommand, type ShellCommandModel } from "../ui/renderers/common-renderers.js";

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

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"build": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell, disk, paths, clock } = ctx.deps;
			const cmd = resolveBuildCommand(ctx.project, "fast", ["build"], "npm run build");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Building..." });
			if (exitCode === 0 && ctx.project) {
				const { srcDir, binDir } = resolveBuildPaths(ctx.project.path, { paths });
				recordBuild(srcDir, binDir, { disk, paths, clock });
			}
			return { command: cmd, exitCode, label: "build" };
		},
		renderer: renderShellCommand,
	}),

	"build:increment": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveBuildCommand(ctx.project, "increment", ["build:increment", "build"], "npm run build");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Building increment..." });
			return { command: cmd, exitCode, label: "build:increment" };
		},
		renderer: renderShellCommand,
	}),

	"build:full": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell, disk, paths, clock } = ctx.deps;
			const cmd = resolveBuildCommand(ctx.project, "full", ["build:full", "build"], "npm run build");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Building full..." });
			if (exitCode === 0 && ctx.project) {
				const { srcDir, binDir } = resolveBuildPaths(ctx.project.path, { paths });
				recordBuild(srcDir, binDir, { disk, paths, clock });
			}
			return { command: cmd, exitCode, label: "build:full" };
		},
		renderer: renderShellCommand,
	}),

	"build:watch": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		flags: {
			reload: { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const resolved = resolveBuildCommand(ctx.project, "watch", ["build:dev", "build:watch"], "npm run build -- --watch");
			const reloadFlag = ctx.flags.reload ? " --reload" : "";
			const cmd = `${resolved}${reloadFlag}`;
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Watch mode..." });
			return { command: cmd, exitCode, label: "build:watch" };
		},
		renderer: renderShellCommand,
	}),

	"build:distribute": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveBuildCommand(ctx.project, "distribute", ["build:distribute", "build"], "npm run build");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Distributing build..." });
			return { command: cmd, exitCode, label: "build:distribute" };
		},
		renderer: renderShellCommand,
	}),

	"test": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveTestCommand(ctx.project, "unit", ["test"], "npm test");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Running tests..." });
			return { command: cmd, exitCode, label: "test" };
		},
		renderer: renderShellCommand,
	}),

	"test:increment": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveTestCommand(ctx.project, "increment", ["test:increment", "test"], "npm test");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Running increment tests..." });
			return { command: cmd, exitCode, label: "test:increment" };
		},
		renderer: renderShellCommand,
	}),

	"test:e2e": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveTestCommand(ctx.project, "e2e", ["test:e2e", "test"], "npm test");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Running E2E tests..." });
			return { command: cmd, exitCode, label: "test:e2e" };
		},
		renderer: renderShellCommand,
	}),

	"build:check": adaptDescriptor({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const { srcDir, binDir } = resolveBuildPaths(ctx.project!.path, { paths });
			return checkFreshness(srcDir, binDir, { disk, paths });
		},
		renderer: renderFreshnessCheck,
	}),

	"build:auto": adaptDescriptor<Record<string, unknown>, BuildAutoModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell, clock } = ctx.deps;
			const { srcDir, binDir } = resolveBuildPaths(ctx.project!.path, { paths });
			const check = checkFreshness(srcDir, binDir, { disk, paths });

			if (!check.needsRebuild) {
				return { check, buildRan: false, manifest: null };
			}

			const exitCode = shell.run(pick(ctx.project, ["build"], "npm run build"), { cwd: ctx.project!.path, label: "Rebuilding..." });
			const manifest = exitCode === 0 ? recordBuild(srcDir, binDir, { disk, paths, clock }) : null;
			return { check, buildRan: exitCode === 0, manifest };
		},
		renderer: renderBuildAuto,
	}),

	"build:record": adaptDescriptor<Record<string, unknown>, BuildRecordedModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, clock } = ctx.deps;
			const { srcDir, binDir } = resolveBuildPaths(ctx.project!.path, { paths });
			const manifest = recordBuild(srcDir, binDir, { disk, paths, clock });
			return { fileCount: manifest.fileCount, hashPrefix: manifest.sourceHash.slice(0, 12) };
		},
		renderer: renderBuildRecorded,
	}),

	"project:ci": adaptDescriptor<Record<string, unknown>, CiResult>({
		requires: "project",
		flags: {
			"dry-run": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			return runProjectCi(ctx.project!, ctx.flags["dry-run"] as boolean, { disk, paths });
		},
		renderer: renderCiResult,
	}),
};
