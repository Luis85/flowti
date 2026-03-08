/**
 * review.ts — Non-interactive review commands.
 *
 * Commands resolve scripts from the project's flowti.config.json review section.
 * The interactive Review menu lives in project-review.ts.
 */

import { shell } from "../../infrastructure/shell.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	review: (_f, _r, _c, p) => {
		const cmd = p?.config.review?.runner ?? "npm test";
		shell.run(cmd, { cwd: p?.path, label: "Starting review session..." });
	},
};
