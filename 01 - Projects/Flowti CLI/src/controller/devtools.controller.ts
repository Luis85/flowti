/**
 * devtools.controller.ts — Controller for developer utility commands.
 *
 * Most devtools commands call pure domain functions directly.
 * Shell-based commands use resolveDevCmd for configurable overrides.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { VAULT_ROOT, PLUGIN_ROOT, CLI_PROJECT } from "../infrastructure/config.js";
import { rebuildCli } from "../domain/devtools/self-update.js";
import { reloadPlugin } from "../domain/devtools/cli-reload.js";
import { fixFrontmatter } from "../domain/devtools/fix-frontmatter.js";
import { generateTestData } from "../domain/devtools/generate-test-data.js";
import type { TestDataOpts } from "../domain/devtools/generate-test-data.js";
import { runAnalysisPipeline } from "../domain/devtools/run-analysis.js";
import { renderShellCommand, renderSuccess, type ShellCommandModel, type SuccessModel } from "../ui/renderers/common-renderers.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolveDevCmd(p: ProjectContext | undefined, name: string, scriptName: string | null, fallback: string): string {
	const cmd = p?.config.devtools?.commands?.[name];
	if (cmd) return cmd;
	if (scriptName && p?.scripts[scriptName]) return `npm run ${scriptName}`;
	return fallback;
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"dev:reload": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		flags: {
			vault: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { shell, log, warn } = ctx.deps;
			const vault = (ctx.flags.vault as string) || undefined;
			const success = reloadPlugin(vault, { shell, log, warn });
			return { message: success ? "Plugin reloaded." : "Obsidian CLI not available — reload skipped." };
		},
		renderer: renderSuccess,
	}),

	"dev:console": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveDevCmd(ctx.project, "console", null, "obsidian dev:console");
			const result = shell.runCaptureStatus(cmd);
			let exitCode = result.exitCode;
			if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
				shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
				exitCode = shell.run(cmd, { label: "Opening dev console..." });
			}
			return { command: cmd, exitCode, label: "dev:console" };
		},
		renderer: renderShellCommand,
	}),

	"dev:errors": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveDevCmd(ctx.project, "errors", null, "obsidian dev:errors");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Opening error stream..." });
			return { command: cmd, exitCode, label: "dev:errors" };
		},
		renderer: renderShellCommand,
	}),

	"dev:debug:on": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = "obsidian dev:debug on";
			const exitCode = shell.run(cmd, { label: "Enabling debug mode..." });
			return { command: cmd, exitCode, label: "dev:debug:on" };
		},
		renderer: renderShellCommand,
	}),

	"dev:debug:off": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = "obsidian dev:debug off";
			const exitCode = shell.run(cmd, { label: "Disabling debug mode..." });
			return { command: cmd, exitCode, label: "dev:debug:off" };
		},
		renderer: renderShellCommand,
	}),

	"dev:check": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveDevCmd(ctx.project, "check", "check", "npx tsc --noEmit");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Running lint + tsc..." });
			return { command: cmd, exitCode, label: "dev:check" };
		},
		renderer: renderShellCommand,
	}),

	"dev:lint": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const cmd = resolveDevCmd(ctx.project, "lint", "lint", "npx eslint src/");
			const exitCode = shell.run(cmd, { cwd: ctx.project?.path, label: "Running ESLint..." });
			return { command: cmd, exitCode, label: "dev:lint" };
		},
		renderer: renderShellCommand,
	}),

	"dev:fix-frontmatter": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		flags: {
			"dry-run": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { disk, paths, log } = ctx.deps;
			const dryRun = ctx.flags["dry-run"] as boolean;
			const docsRoot = paths.resolve(PLUGIN_ROOT, "docs");
			const result = fixFrontmatter({ dryRun, docsRoot }, { disk, paths, log });
			return { message: `Fixed: ${result.fixed}, Skipped: ${result.skipped}, Errors: ${result.errors}${dryRun ? " (dry-run)" : ""}` };
		},
		renderer: renderSuccess,
	}),

	"dev:testdata": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		flags: {
			from: { type: "string", default: "2025-01" },
			to: { type: "string", default: "" },
			seed: { type: "string", default: "42" },
			out: { type: "string", default: "" },
			"dry-run": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { disk, paths, clock, log } = ctx.deps;
			const defaultOut = paths.join(VAULT_ROOT, "03 - Resources", "Test Data", "Analytics");
			const opts: TestDataOpts = {
				from: ctx.flags.from as string,
				to: (ctx.flags.to as string) || null,
				seed: Number(ctx.flags.seed),
				outDir: paths.resolve((ctx.flags.out as string) || defaultOut),
				dryRun: ctx.flags["dry-run"] as boolean,
			};
			const result = generateTestData(opts, { disk, paths, clock, log });
			return { message: `Generated ${result.totalRows} rows across ${result.filesWritten} files` };
		},
		renderer: renderSuccess,
	}),

	"dev:rebuild": adaptDescriptor<Record<string, unknown>, ShellCommandModel>({
		handler: (ctx) => {
			const { shell } = ctx.deps;
			const exitCode = rebuildCli(ctx.project?.path ?? "", shell);
			return { command: "npm run build", exitCode, label: "dev:rebuild" };
		},
		renderer: renderShellCommand,
	}),

	"dev:analysis": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		handler: (ctx) => {
			const { disk, shell, paths, clock, log } = ctx.deps;
			runAnalysisPipeline(CLI_PROJECT, { disk, shell, paths, clock, log });
			return { message: "Analysis pipeline complete." };
		},
		renderer: renderSuccess,
	}),
};
