/**
 * reports.controller.ts — Controller for report and documentation commands.
 *
 * Returns typed data models; rendering is handled by ui/reports-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { renderShellCommand, renderSuccess, type ShellCommandModel, type SuccessModel } from "../ui/renderers/common-renderers.js";
import { runAllReports } from "../domain/reports/pipeline/report-runner.js";
import { runAllDocs } from "../domain/reports/pipeline/doc-runner.js";
import { runGenerator, hasGenerator } from "../domain/reports/generator-registry.js";
import { ReportService } from "../domain/reports/cli/report-service.js";
import { discoverArchiveCategories } from "../domain/reports/export/report-archive.js";
import { diffReports } from "../domain/reports/export/report-diff.js";
import { exportReportToHtml } from "../domain/reports/export/html-export.js";
import {
	renderNoGenerators, renderAuditResult, renderReportDiff,
	renderHtmlExport, renderUnknownReport, renderReportRun,
	type NoGeneratorsModel, type AuditResultModel, type HtmlExportModel, type UnknownReportModel, type ReportRunModel,
} from "../ui/displays/reports-display.js";
import { renderNoProject, type NoProjectModel } from "../ui/renderers/common-renderers.js";

// ── Helpers ─────────────────────────────────────────────────────────

function noProjectResponse(log: CliDeps["log"], command: string) {
	return dataResponse<NoProjectModel>({ command }, (d) => renderNoProject(d, log));
}

function noGeneratorsResponse(log: CliDeps["log"]) {
	const model: NoGeneratorsModel = { message: "No report generators configured." };
	return dataResponse(model, (d) => renderNoGenerators(d, log));
}

// ── report:* helpers ─────────────────────────────────────────────────

function runInternalGenerator(reportId: string, projectPath: string, deps: CliDeps) {
	const output = runGenerator(reportId, projectPath, deps);
	const model: SuccessModel = { message: output?.success ? `Generated ${reportId} → ${output.outputPath}` : `Generator ${reportId} failed.` };
	return dataResponse(model, (d) => renderSuccess(d, deps.log));
}

function runExternalGenerator(gen: { command?: string; label: string }, projectPath: string | undefined, shell: CliDeps["shell"], log: CliDeps["log"]) {
	const exitCode = shell.run(gen.command!, { cwd: projectPath, label: `Generating ${gen.label}...` });
	const model: ShellCommandModel = { command: gen.command!, exitCode, label: gen.label };
	return dataResponse(model, (d) => renderShellCommand(d, log));
}

function unknownReportResponse(reportId: string, generators: Array<{ id?: string; label: string }>, log: CliDeps["log"]) {
	const model: UnknownReportModel = {
		reportId,
		available: generators.map((g) => g.id ?? g.label).join(", ") || "(none configured)",
	};
	return dataResponse(model, (d) => renderUnknownReport(d, log));
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	reports: async (req) => {
		const generators = req.project?.config.reports?.generators ?? [];
		if (generators.length === 0) return noGeneratorsResponse(req.deps.log);
		const { log } = req.deps;
		const result = await runAllReports(generators, req.project!.path, req.deps, { parallel: !!req.flags.parallel, log });
		const model: ReportRunModel = { passed: result.passed, failed: result.failed, totalDurationMs: result.totalDurationMs };
		return dataResponse(model, (d) => renderReportRun(d, log));
	},

	"reports:audit": async (req) => {
		const generators = req.project?.config.reports?.generators ?? [];
		if (generators.length === 0) return noGeneratorsResponse(req.deps.log);
		const { log } = req.deps;
		const result = await runAllReports(generators, req.project!.path, req.deps, { parallel: !!req.flags.parallel, log });
		const model: AuditResultModel = { passed: result.passed, failed: result.failed };
		return dataResponse(model, (d) => renderAuditResult(d, log));
	},

	docs: async (req) => {
		const configGenerators = req.project?.config.docs?.generators ?? [];
		const references = req.project?.config.docs?.references ?? [];
		const bookConfig = req.project?.config.docs?.book;
		const result = await runAllDocs(configGenerators, references, req.project!.path, req.deps, bookConfig);
		const model: ReportRunModel = { passed: result.passed, failed: result.failed, totalDurationMs: result.totalDurationMs };
		return dataResponse(model, (d) => renderReportRun(d, req.deps.log));
	},

	"reports:diff": (req) => {
		if (!req.project) return noProjectResponse(req.deps.log, "reports:diff");
		const { disk, paths } = req.deps;
		const svc = new ReportService(req.project.path, req.deps);
		const categories = discoverArchiveCategories(svc.reportsDir, { disk, paths });
		if (categories.length === 0) {
			const model: NoGeneratorsModel = { message: "No archived reports found. Run reports first." };
			return dataResponse(model, (d) => renderNoGenerators(d, req.deps.log));
		}

		const diffs: ReturnType<typeof diffReports>[] = [];
		for (const cat of categories) {
			if (cat.files.length < 2) continue;
			const currentFile = paths.join(svc.reportsDir, cat.subdir, cat.files[0]);
			const previousFile = paths.join(svc.reportsDir, cat.subdir, cat.files[1]);
			const currentContent = disk.readFileSync(currentFile, "utf-8");
			const previousContent = disk.readFileSync(previousFile, "utf-8");
			const diff = diffReports(cat.label, cat.files[1], previousContent, cat.files[0], currentContent);
			if (diff.deltas.length > 0) diffs.push(diff);
		}

		return dataResponse(diffs, (d) => renderReportDiff(d, req.deps.log));
	},

	"reports:html": (req) => {
		if (!req.project) return noProjectResponse(req.deps.log, "reports:html");
		const { disk, paths } = req.deps;
		const svc = new ReportService(req.project.path, req.deps);
		const outputDir = typeof req.flags.output === "string" ? req.flags.output : paths.join(svc.reportsDir, "html");
		const entries = disk.readdirSync(svc.reportsDir).filter((f: string) => f.endsWith(".md"));
		if (entries.length === 0) {
			const model: NoGeneratorsModel = { message: "No report files found. Run reports first." };
			return dataResponse(model, (d) => renderNoGenerators(d, req.deps.log));
		}
		const exported: HtmlExportModel["exported"] = [];
		for (const entry of entries) {
			const mdPath = paths.join(svc.reportsDir, entry);
			const result = exportReportToHtml(mdPath, outputDir, req.deps);
			if (result) exported.push({ title: result.title, outputPath: result.outputPath });
		}
		const model: HtmlExportModel = { exported, outputDir };
		return dataResponse(model, (d) => renderHtmlExport(d, req.deps.log));
	},

	"report:*": (req) => {
		const reportId = req.command.substring("report:".length);
		const generators = req.project?.config.reports?.generators ?? [];
		if (hasGenerator(reportId)) return runInternalGenerator(reportId, req.project!.path, req.deps);
		const gen = generators.find((g) => g.id === reportId || g.label.toLowerCase().replace(/\s+/g, "-") === reportId);
		if (gen?.command) return runExternalGenerator(gen, req.project?.path, req.deps.shell, req.deps.log);
		return unknownReportResponse(reportId, generators, req.deps.log);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
