/**
 * reports.ts — Non-interactive report and documentation commands.
 *
 * Commands resolve generator IDs from the project's flowti.config.json.
 * The interactive Reports menu lives in mainMenu.ts.
 *
 * The "reports" command runs all generators resiliently — a failed report
 * does not stop the run. Use "report:{id}" for individual generators.
 *
 * The "docs" command runs config-defined doc generators + built-in
 * reference generators (CLI Reference, Entity Reference).
 */

import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";
import { runAllReports } from "./report-runner.js";
import { runGenerator, hasGenerator } from "./generator-registry.js";
import { runReference, listReferenceIds } from "./reference-registry.js";

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	reports: (_f, _r, _c, p) => {
		const generators = p?.config.reports?.generators ?? [];
		if (generators.length === 0) {
			log(`\n  ${DIM}No report generators configured.${RESET}\n`);
			return;
		}
		runAllReports(generators, p!.path);
	},
	"reports:audit": (_f, _r, _c, p) => {
		const generators = p?.config.reports?.generators ?? [];
		if (generators.length === 0) {
			log(`\n  ${DIM}No report generators configured.${RESET}\n`);
			return;
		}
		const result = runAllReports(generators, p!.path);
		log(`  ${GREEN}✓${RESET} Audit complete: ${result.passed} passed, ${result.failed} failed.\n`);
	},
	docs: (_f, _r, _c, p) => {
		const docsConfig = p?.config.docs;
		const configGenerators = docsConfig?.generators ?? [];

		log(`\n  ${DIM}Updating documentation...${RESET}\n`);

		// Run config-defined generators (e.g. TypeDoc)
		for (const gen of configGenerators) {
			log(`  ${DIM}▸${RESET} ${gen.label}`);
			const { exitCode } = shell.runCaptureStatus(gen.command, { cwd: p?.path });
			if (exitCode === 0) {
				log(`  ${GREEN}✓${RESET} ${gen.label}`);
			} else {
				log(`  ${RED}✗${RESET} ${gen.label} (exit ${exitCode})`);
			}
		}

		// Run built-in reference generators
		for (const refId of listReferenceIds()) {
			const label = refId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
			const result = runReference(refId, p!.path);
			if (result && result.success) {
				log(`  ${GREEN}✓${RESET} ${label}`);
			} else {
				log(`  ${RED}✗${RESET} ${label}`);
			}
		}

		log();
	},
	"report:*": (_flags, _rawArgs, command, p) => {
		const reportId = command!.substring("report:".length);
		const generators = p?.config.reports?.generators ?? [];

		// Internal generator takes priority
		if (hasGenerator(reportId)) {
			runGenerator(reportId, p!.path);
			return;
		}

		// Fallback: match by ID or label in config, run via command
		const gen = generators.find((g) => g.id === reportId || g.label.toLowerCase().replace(/\s+/g, "-") === reportId);
		if (gen?.command) {
			shell.run(gen.command, { cwd: p?.path, label: `Generating ${gen.label}...` });
			return;
		}

		log(`\n  ${RED}Unknown report: ${reportId}${RESET}`);
		log(`  ${DIM}Available: ${generators.map((g) => g.id ?? g.label).join(", ") || "(none configured)"}${RESET}\n`);
	},
};
