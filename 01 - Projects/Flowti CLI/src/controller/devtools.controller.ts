/**
 * devtools.controller.ts — Controller for developer utility commands.
 *
 * All devtools commands are shell runners — no data/display split needed.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { shell } from "../infrastructure/shell.js";
import { rebuildCli } from "../domain/devtools/self-update.js";
import { reloadPlugin } from "../scripts/cli-reload.js";
import { renderShellCommand, renderSuccess, type ShellCommandModel, type SuccessModel } from "../ui/common-renderers.js";

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
		const vault = typeof req.flags.vault === "string" ? req.flags.vault : undefined;
		const success = reloadPlugin(vault);
		const model: SuccessModel = { message: success ? "Plugin reloaded." : "Obsidian CLI not available — reload skipped." };
		return dataResponse(model, renderSuccess);
	},
	"dev:console": (req) => {
		const cmd = resolveDevCmd(req.project, "console", null, "obsidian dev:console");
		const result = shell.runCaptureStatus(cmd);
		let exitCode = result.exitCode;
		if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
			shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
			exitCode = shell.run(cmd, { label: "Opening dev console..." });
		}
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:console" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:errors": (req) => {
		const cmd = resolveDevCmd(req.project, "errors", null, "obsidian dev:errors");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Opening error stream..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:errors" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:debug:on": () => {
		const cmd = "obsidian dev:debug on";
		const exitCode = shell.run(cmd, { label: "Enabling debug mode..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:debug:on" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:debug:off": () => {
		const cmd = "obsidian dev:debug off";
		const exitCode = shell.run(cmd, { label: "Disabling debug mode..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:debug:off" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:check": (req) => {
		const cmd = resolveDevCmd(req.project, "check", "check", "npx tsc --noEmit");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running lint + tsc..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:check" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:lint": (req) => {
		const cmd = resolveDevCmd(req.project, "lint", "lint", "npx eslint src/");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running ESLint..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:lint" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:fix-frontmatter": (req) => {
		const resolved = resolveDevCmd(req.project, "fixFrontmatter", null, "node scripts/fix-frontmatter.mjs");
		const dryRun = req.flags["dry-run"] ? " --dry-run" : "";
		const cmd = `${resolved}${dryRun}`;
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...` });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:fix-frontmatter" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:testdata": (req) => {
		const cmd = resolveDevCmd(req.project, "testdata", null, "node scripts/generate-test-data.mjs");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Generating test data CSVs..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:testdata" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:rebuild": (req) => {
		const exitCode = rebuildCli(req.project?.path ?? "", shell);
		const model: ShellCommandModel = { command: "npm run build", exitCode, label: "dev:rebuild" };
		return dataResponse(model, renderShellCommand);
	},
	"dev:analysis": (req) => {
		const cmd = resolveDevCmd(req.project, "analysis", "analysis", "npx tsx src/scripts/run-analysis.ts");
		const exitCode = shell.run(cmd, { cwd: req.project?.path, label: "Running analysis pipeline..." });
		const model: ShellCommandModel = { command: cmd, exitCode, label: "dev:analysis" };
		return dataResponse(model, renderShellCommand);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
