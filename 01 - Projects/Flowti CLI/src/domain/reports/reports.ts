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

import { RESET, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import { runAllReports } from "./report-runner.js";
import { runAllDocs } from "./doc-runner.js";
import { runGenerator, hasGenerator } from "./generator-registry.js";
import { ReportService } from "./cli/report-service.js";
import { discoverArchiveCategories } from "./report-archive.js";
import { diffReports } from "./report-diff.js";
import { exportReportToHtml } from "./html-export.js";

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void | Promise<void>> = {
	reports: async (flags, _r, _c, p) => {
		const generators = p?.config.reports?.generators ?? [];
		if (generators.length === 0) {
			log(`\n  ${DIM}No report generators configured.${RESET}\n`);
			return;
		}
		await runAllReports(generators, p!.path, { parallel: !!flags.parallel });
	},
	"reports:audit": async (flags, _r, _c, p) => {
		const generators = p?.config.reports?.generators ?? [];
		if (generators.length === 0) {
			log(`\n  ${DIM}No report generators configured.${RESET}\n`);
			return;
		}
		const result = await runAllReports(generators, p!.path, { parallel: !!flags.parallel });
		log(`  ${GREEN}✓${RESET} Audit complete: ${result.passed} passed, ${result.failed} failed.\n`);
	},
	docs: async (_f, _r, _c, p) => {
		const configGenerators = p?.config.docs?.generators ?? [];
		await runAllDocs(configGenerators, p!.path);
	},
	"reports:diff": (flags, _r, _c, p) => {
		if (!p) {
			log(`\n  ${RED}No project selected.${RESET}\n`);
			return;
		}
		const svc = new ReportService(p.path);
		const categories = discoverArchiveCategories(svc.reportsDir);

		if (categories.length === 0) {
			log(`\n  ${DIM}No archived reports found. Run reports first.${RESET}\n`);
			return;
		}

		const format = resolveFormat(flags);
		const diffs: ReturnType<typeof diffReports>[] = [];

		for (const cat of categories) {
			if (cat.files.length < 2) continue;

			// files are sorted most-recent-first
			const currentFile = paths.join(svc.reportsDir, cat.subdir, cat.files[0]);
			const previousFile = paths.join(svc.reportsDir, cat.subdir, cat.files[1]);
			const currentContent = disk.readFileSync(currentFile, "utf-8");
			const previousContent = disk.readFileSync(previousFile, "utf-8");

			const diff = diffReports(cat.label, cat.files[1], previousContent, cat.files[0], currentContent);
			if (diff.deltas.length > 0) diffs.push(diff);
		}

		printOutput(format, diffs, () => {
			if (diffs.length === 0) {
				log(`\n  ${DIM}No metric changes between latest reports.${RESET}\n`);
				return;
			}

			log(`\n  ${CYAN}Report Diff${RESET}\n`);
			for (const diff of diffs) {
				log(`  ${GREEN}${diff.category}${RESET}  ${DIM}${diff.previousFile} → ${diff.currentFile}${RESET}`);
				for (const d of diff.deltas) {
					const color = d.delta > 0 ? GREEN : d.delta < 0 ? YELLOW : DIM;
					log(`    ${color}${d.formatted}${RESET}  ${d.key}  ${DIM}(${d.previous} → ${d.current})${RESET}`);
				}
				if (diff.unchanged.length > 0) {
					log(`    ${DIM}${diff.unchanged.length} unchanged metric${diff.unchanged.length === 1 ? "" : "s"}${RESET}`);
				}
				log();
			}
		});
	},
	"reports:html": (flags, _r, _c, p) => {
		if (!p) return;
		const svc = new ReportService(p.path);
		const outputDir = typeof flags.output === "string" ? flags.output : paths.join(svc.reportsDir, "html");

		// Find all stable report files (*.md) in the reports root
		const entries = disk.readdirSync(svc.reportsDir).filter((f: string) => f.endsWith(".md"));
		if (entries.length === 0) {
			log(`\n  ${DIM}No report files found. Run reports first.${RESET}\n`);
			return;
		}

		let exported = 0;
		for (const entry of entries) {
			const mdPath = paths.join(svc.reportsDir, entry);
			const result = exportReportToHtml(mdPath, outputDir);
			if (result) {
				log(`  ${GREEN}✓${RESET} ${result.title} → ${DIM}${result.outputPath}${RESET}`);
				exported++;
			}
		}
		log(`\n  ${exported} report${exported !== 1 ? "s" : ""} exported to ${DIM}${outputDir}${RESET}\n`);
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
