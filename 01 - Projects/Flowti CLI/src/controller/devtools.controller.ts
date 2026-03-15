/**
 * devtools.controller.ts — Controller for developer utility commands.
 *
 * Most devtools commands call pure domain functions directly.
 * Shell-based commands use resolveDevCmd for configurable overrides.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
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

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"dev:reload": (req) => {
		const { shell, log, warn } = req.deps;
		const vault = typeof req.flags.vault === "string" ? req.flags.vault : undefined;
		const success = reloadPlugin(vault, { shell, log, warn });
		const model: SuccessModel = { message: success ? "Plugin reloaded." : "Obsidian CLI not available — reload skipped." };
		return dataResponse(model, (d) => renderSuccess(d, req.deps.log));
	},
	"dev:console": (req) => {
		const { shell } = req.deps;
		const cmd = resolveDevCmd(req.project, "console", null, "obsidian dev:console");
		const result = shell.runCaptureStatus(cmd);
		let exitCode = result.exitCode;
		if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
			shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
			exitCode = shell.run(cmd, { label: "Opening dev console..." });
		}
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:console" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:errors": (req) => {
		const { shell } = req.deps;
		const cmd = resolveDevCmd(req.project, "errors", null, "obsidian dev:errors");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Opening error stream..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:errors" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:debug:on": (req) => {
		const { shell } = req.deps;
		const cmd = "obsidian dev:debug on";
		const exitCode = shell.run(cmd, { label: "Enabling debug mode..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:debug:on" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:debug:off": (req) => {
		const { shell } = req.deps;
		const cmd = "obsidian dev:debug off";
		const exitCode = shell.run(cmd, { label: "Disabling debug mode..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:debug:off" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:check": (req) => {
		const { shell } = req.deps;
		const cmd = resolveDevCmd(req.project, "check", "check", "npx tsc --noEmit");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running lint + tsc..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:check" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:lint": (req) => {
		const { shell } = req.deps;
		const cmd = resolveDevCmd(req.project, "lint", "lint", "npx eslint src/");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running ESLint..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:lint" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:fix-frontmatter": (req) => {
		const { disk, paths, log } = req.deps;
		const dryRun = !!req.flags["dry-run"];
		const docsRoot = paths.resolve(PLUGIN_ROOT, "docs");
		const result = fixFrontmatter({ dryRun, docsRoot }, { disk, paths, log });
		const model: SuccessModel = { message: `Fixed: ${result.fixed}, Skipped: ${result.skipped}, Errors: ${result.errors}${dryRun ? " (dry-run)" : ""}` };
		return dataResponse(model, (d) => renderSuccess(d, req.deps.log));
	},
	"dev:testdata": (req) => {
		const { disk, paths, clock, log } = req.deps;
		const defaultOut = paths.join(VAULT_ROOT, "03 - Resources", "Test Data", "Analytics");
		const opts: TestDataOpts = {
			from: typeof req.flags.from === "string" ? req.flags.from : "2025-01",
			to: typeof req.flags.to === "string" ? req.flags.to : null,
			seed: typeof req.flags.seed === "string" ? Number(req.flags.seed) : 42,
			outDir: paths.resolve(typeof req.flags.out === "string" ? req.flags.out : defaultOut),
			dryRun: !!req.flags["dry-run"],
		};
		const result = generateTestData(opts, { disk, paths, clock, log });
		const model: SuccessModel = { message: `Generated ${result.totalRows} rows across ${result.filesWritten} files` };
		return dataResponse(model, (d) => renderSuccess(d, req.deps.log));
	},
	"dev:rebuild": (req) => {
		const { shell } = req.deps;
		const exitCode = rebuildCli(req.project?.path ?? "", shell);
		const model: ShellCommandModel = { command: "npm run build", exitCode, label: "dev:rebuild" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},
	"dev:analysis": (req) => {
		const { disk, shell, paths, clock, log } = req.deps;
		runAnalysisPipeline(CLI_PROJECT, { disk, shell, paths, clock, log });
		const model: SuccessModel = { message: "Analysis pipeline complete." };
		return dataResponse(model, (d) => renderSuccess(d, req.deps.log));
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
