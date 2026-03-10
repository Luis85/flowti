/**
 * devtools.controller.ts — Controller for developer utility commands.
 *
 * All devtools commands are shell runners — no data/display split needed.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { shell } from "../infrastructure/shell.js";
import { rebuildCli } from "../domain/devtools/self-update.js";

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
		shell.run(resolveDevCmd(req.project, "reload", null, "node scripts/cli-reload.mjs"), { cwd: req.project?.path, label: "Reloading plugin..." });
	},
	"dev:console": (req) => {
		const cmd = resolveDevCmd(req.project, "console", null, "obsidian dev:console");
		const result = shell.runCaptureStatus(cmd);
		if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
			shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
			shell.run(cmd, { label: "Opening dev console..." });
		}
	},
	"dev:errors": (req) => {
		shell.run(resolveDevCmd(req.project, "errors", null, "obsidian dev:errors"), { cwd: req.project?.path, label: "Opening error stream..." });
	},
	"dev:debug:on": () => {
		shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
	},
	"dev:debug:off": () => {
		shell.run("obsidian dev:debug off", { label: "Disabling debug mode..." });
	},
	"dev:check": (req) => {
		const cmd = resolveDevCmd(req.project, "check", "check", "npx tsc --noEmit");
		shell.run(cmd, { cwd: req.project?.path, label: "Running lint + tsc..." });
	},
	"dev:lint": (req) => {
		const cmd = resolveDevCmd(req.project, "lint", "lint", "npx eslint src/");
		shell.run(cmd, { cwd: req.project?.path, label: "Running ESLint..." });
	},
	"dev:fix-frontmatter": (req) => {
		const resolved = resolveDevCmd(req.project, "fixFrontmatter", null, "node scripts/fix-frontmatter.mjs");
		const dryRun = req.flags["dry-run"] ? " --dry-run" : "";
		shell.run(`${resolved}${dryRun}`, { cwd: req.project?.path, label: `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...` });
	},
	"dev:testdata": (req) => {
		shell.run(resolveDevCmd(req.project, "testdata", null, "node scripts/generate-test-data.mjs"), { cwd: req.project?.path, label: "Generating test data CSVs..." });
	},
	"dev:rebuild": (req) => {
		rebuildCli(req.project?.path ?? "", shell);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
