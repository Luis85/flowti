/**
 * build.ts — Build commands (non-interactive).
 *
 * Commands resolve scripts from the project's package.json and run
 * them in the project directory. The interactive Build menu lives
 * in the Project Detail Menu (mainMenu.ts).
 */

import { shell } from "../../infrastructure/shell.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

/** Pick the first available npm script, or fall back to a default. */
function pick(p: ProjectContext | undefined, candidates: string[], fallback: string): string {
	if (p) {
		for (const name of candidates) {
			if (p.scripts[name]) return name === "test" ? "npm test" : `npm run ${name}`;
		}
	}
	return fallback;
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	"build": (_f, _r, _c, p) => {
		shell.run(pick(p, ["build"], "npm run build"), { cwd: p?.path, label: "Building..." });
	},
	"build:increment": (_f, _r, _c, p) => {
		shell.run(pick(p, ["build:increment", "build"], "npm run build"), { cwd: p?.path, label: "Building increment..." });
	},
	"build:full": (_f, _r, _c, p) => {
		shell.run(pick(p, ["build:full", "build"], "npm run build"), { cwd: p?.path, label: "Building full..." });
	},
	"build:watch": (flags, _r, _c, p) => {
		const reloadFlag = flags.reload ? " --reload" : "";
		shell.run(`${pick(p, ["build:dev", "build:watch"], "npm run build -- --watch")}${reloadFlag}`, { cwd: p?.path, label: "Watch mode..." });
	},
	"build:distribute": (_f, _r, _c, p) => {
		shell.run(pick(p, ["build:distribute", "build"], "npm run build"), { cwd: p?.path, label: "Distributing build..." });
	},
	"test": (_f, _r, _c, p) => {
		shell.run(pick(p, ["test"], "npm test"), { cwd: p?.path, label: "Running tests..." });
	},
	"test:increment": (_f, _r, _c, p) => {
		shell.run(pick(p, ["test:increment", "test"], "npm test"), { cwd: p?.path, label: "Running increment tests..." });
	},
	"test:e2e": (_f, _r, _c, p) => {
		shell.run(pick(p, ["test:e2e", "test"], "npm test"), { cwd: p?.path, label: "Running E2E tests..." });
	},
};
