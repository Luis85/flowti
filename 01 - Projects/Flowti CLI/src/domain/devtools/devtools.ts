/**
 * devtools.ts — Non-interactive developer utility commands.
 *
 * Commands run in the selected project's directory.
 */

import { shell } from "../../infrastructure/shell.js";
import { rebuildCli } from "./self-update.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

/** Resolve a devtools command: config.devtools.commands[name] → script → fallback. */
function resolveDevCmd(p: ProjectContext | undefined, name: string, scriptName: string | null, fallback: string): string {
	const cmd = p?.config.devtools?.commands?.[name];
	if (cmd) return cmd;
	if (scriptName && p?.scripts[scriptName]) return `npm run ${scriptName}`;
	return fallback;
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	"dev:reload": (_f, _r, _c, p) => {
		shell.run(resolveDevCmd(p, "reload", null, "node scripts/cli-reload.mjs"), { cwd: p?.path, label: "Reloading plugin..." });
	},
	"dev:console": (_f, _r, _c, p) => {
		const cmd = resolveDevCmd(p, "console", null, "obsidian dev:console");
		const result = shell.runCaptureStatus(cmd);
		if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
			shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
			shell.run(cmd, { label: "Opening dev console..." });
		}
	},
	"dev:errors": (_f, _r, _c, p) => {
		shell.run(resolveDevCmd(p, "errors", null, "obsidian dev:errors"), { cwd: p?.path, label: "Opening error stream..." });
	},
	"dev:debug:on": () => {
		shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
	},
	"dev:debug:off": () => {
		shell.run("obsidian dev:debug off", { label: "Disabling debug mode..." });
	},
	"dev:check": (_f, _r, _c, p) => {
		const cmd = resolveDevCmd(p, "check", "check", "npx tsc --noEmit");
		shell.run(cmd, { cwd: p?.path, label: "Running lint + tsc..." });
	},
	"dev:lint": (_f, _r, _c, p) => {
		const cmd = resolveDevCmd(p, "lint", "lint", "npx eslint src/");
		shell.run(cmd, { cwd: p?.path, label: "Running ESLint..." });
	},
	"dev:fix-frontmatter": (flags, _r, _c, p) => {
		const resolved = resolveDevCmd(p, "fixFrontmatter", null, "node scripts/fix-frontmatter.mjs");
		const dryRun = flags["dry-run"] ? " --dry-run" : "";
		shell.run(`${resolved}${dryRun}`, { cwd: p?.path, label: `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...` });
	},
	"dev:testdata": (_f, _r, _c, p) => {
		shell.run(resolveDevCmd(p, "testdata", null, "node scripts/generate-test-data.mjs"), { cwd: p?.path, label: "Generating test data CSVs..." });
	},
	"dev:rebuild": (_f, _r, _c, p) => {
		rebuildCli(p?.path ?? "", shell);
	},
};
