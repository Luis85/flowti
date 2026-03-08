/**
 * publish.ts — Non-interactive publish commands.
 *
 * Commands resolve scripts from the project's flowti.config.json publish section.
 * The interactive Publish menu lives in project-publish.ts.
 */

import { shell } from "../../infrastructure/shell.js";
import { proc } from "../../infrastructure/proc.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	publish: (_f, _r, _c, p) => {
		const cmd = p?.config.publish?.build ?? "npm run build";
		shell.run(cmd, { cwd: p?.path, label: "Publishing..." });
	},
	"publish:all": (_f, _r, _c, p) => {
		const buildCmd = p?.config.publish?.build ?? "npm run build";
		const testCmd = p?.config.publish?.test ?? "npm test";
		const b = shell.run(buildCmd, { cwd: p?.path, label: "Step 1/2: Building..." });
		if (b !== 0) proc.exit(b);
		const t = shell.run(testCmd, { cwd: p?.path, label: "Step 2/2: Testing..." });
		if (t !== 0) proc.exit(t);
	},
};
