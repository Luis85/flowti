/**
 * publish.ts — Non-interactive publish commands.
 *
 * Commands resolve scripts from the project's flowti.config.json publish section.
 * The interactive Publish menu lives in project-publish.ts.
 */

import { shell } from "../../infrastructure/shell.js";
import { proc } from "../../infrastructure/proc.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolvePublishCommands(p: ProjectContext | undefined): { buildCmd: string; testCmd: string; cwd: string | undefined } {
	return {
		buildCmd: p?.config.publish?.build ?? "npm run build",
		testCmd: p?.config.publish?.test ?? "npm test",
		cwd: p?.path,
	};
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	publish: (_f, _r, _c, p) => {
		const { buildCmd, cwd } = resolvePublishCommands(p);
		shell.run(buildCmd, { cwd, label: "Publishing..." });
	},
	"publish:all": (_f, _r, _c, p) => {
		const { buildCmd, testCmd, cwd } = resolvePublishCommands(p);
		const b = shell.run(buildCmd, { cwd, label: "Step 1/2: Building..." });
		if (b !== 0) proc.exit(b);
		const t = shell.run(testCmd, { cwd, label: "Step 2/2: Testing..." });
		if (t !== 0) proc.exit(t);
	},
};
