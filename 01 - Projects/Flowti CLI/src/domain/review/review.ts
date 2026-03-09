/**
 * review.ts — Non-interactive review commands.
 *
 * Commands resolve scripts from the project's flowti.config.json review section.
 * The interactive Review menu lives in project-review.ts.
 */

import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Non-interactive commands ────────────────────────────────────────

function runGatedPipeline(p: ProjectContext): void {
	const review = p.config.review ?? {};
	const buildCmd = review.build ?? "npm run build";
	const testCmd = review.test ?? "npm test";
	const e2eCmd = review.runner ?? "npx vitest run tests/e2e/";

	const buildCode = shell.run(buildCmd, { cwd: p.path, label: "Step 1/3: Build" });
	if (buildCode !== 0) { log("Pipeline stopped — build failed."); return; }

	const testCode = shell.run(testCmd, { cwd: p.path, label: "Step 2/3: Test" });
	if (testCode !== 0) { log("Pipeline stopped — tests failed."); return; }

	shell.run(e2eCmd, { cwd: p.path, label: "Step 3/3: E2E" });
}

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	review: (_f, _r, _c, p) => {
		const cmd = p?.config.review?.runner ?? "npm test";
		shell.run(cmd, { cwd: p?.path, label: "Starting review session..." });
	},
	"review:all": (_f, _r, _c, p) => {
		if (!p) return;
		runGatedPipeline(p);
	},
};
