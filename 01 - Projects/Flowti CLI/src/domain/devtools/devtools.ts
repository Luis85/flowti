/**
 * devtools.ts — Non-interactive developer utility commands.
 *
 * Commands run in the selected project's directory.
 */

import { shell } from "../../infrastructure/shell.js";
import { rebuildCli } from "./self-update.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	"dev:reload": (_f, _r, _c, p) => {
		shell.run("node scripts/cli-reload.mjs", { cwd: p?.path, label: "Reloading plugin..." });
	},
	"dev:console": () => {
		const result = shell.runCaptureStatus("obsidian dev:console");
		if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
			shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
			shell.run("obsidian dev:console", { label: "Opening dev console..." });
		}
	},
	"dev:errors": () => {
		shell.run("obsidian dev:errors", { label: "Opening error stream..." });
	},
	"dev:debug:on": () => {
		shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
	},
	"dev:debug:off": () => {
		shell.run("obsidian dev:debug off", { label: "Disabling debug mode..." });
	},
	"dev:check": (_f, _r, _c, p) => {
		const cmd = p?.scripts["check"] ? "npm run check" : "npx tsc --noEmit";
		shell.run(cmd, { cwd: p?.path, label: "Running lint + tsc..." });
	},
	"dev:lint": (_f, _r, _c, p) => {
		const cmd = p?.scripts["lint"] ? "npm run lint" : "npx eslint src/";
		shell.run(cmd, { cwd: p?.path, label: "Running ESLint..." });
	},
	"dev:fix-frontmatter": (flags, _r, _c, p) => {
		const dryRun = flags["dry-run"] ? " --dry-run" : "";
		shell.run(`node scripts/fix-frontmatter.mjs${dryRun}`, { cwd: p?.path, label: `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...` });
	},
	"dev:testdata": (_f, _r, _c, p) => {
		shell.run("node scripts/generate-test-data.mjs", { cwd: p?.path, label: "Generating test data CSVs..." });
	},
	"dev:rebuild": (_f, _r, _c, p) => {
		rebuildCli(p?.path ?? "", shell);
	},
};
