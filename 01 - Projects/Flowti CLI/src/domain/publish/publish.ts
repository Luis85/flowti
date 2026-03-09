/**
 * publish.ts — Non-interactive publish commands.
 *
 * Commands resolve scripts from the project's flowti.config.json publish section.
 * The interactive Publish menu lives in project-publish.ts.
 */

import { shell } from "../../infrastructure/shell.js";
import { proc } from "../../infrastructure/proc.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, CYAN } from "../../infrastructure/ui.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolvePublishCommands(p: ProjectContext | undefined): { buildCmd: string; testCmd: string; cwd: string | undefined } {
	return {
		buildCmd: p?.config.publish?.build ?? "npm run build",
		testCmd: p?.config.publish?.test ?? "npm test",
		cwd: p?.path,
	};
}

function resolvePublishConfig(p: ProjectContext | undefined) {
	const pub = p?.config.publish;
	return {
		...resolvePublishCommands(p),
		endpoints: pub?.endpoints ?? [],
		outDir: pub?.outDir ?? "(not configured)",
		artifacts: pub?.artifacts ?? [],
	};
}

function displayDryRun(p: ProjectContext | undefined): void {
	const cfg = resolvePublishConfig(p);

	log(`\n  ${CYAN}Dry run — publish preview${RESET}\n`);
	log(`  ${DIM}Build command:${RESET}  ${cfg.buildCmd}`);
	log(`  ${DIM}Test command:${RESET}   ${cfg.testCmd}`);
	log(`  ${DIM}Output dir:${RESET}     ${cfg.outDir}`);

	if (cfg.artifacts.length > 0) {
		log(`  ${DIM}Artifacts:${RESET}      ${cfg.artifacts.join(", ")}`);
	}

	if (cfg.endpoints.length > 0) {
		log(`\n  ${DIM}Endpoints:${RESET}`);
		for (const ep of cfg.endpoints) {
			log(`    ${DIM}•${RESET} ${ep.name} → ${ep.path}`);
		}
	} else {
		log(`\n  ${DIM}No endpoints configured.${RESET}`);
	}
	log();
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	publish: (flags, _r, _c, p) => {
		if (flags["dry-run"]) {
			displayDryRun(p);
			return;
		}
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
