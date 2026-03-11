/**
 * reports.controller.ts — Controller for report and documentation commands.
 *
 * Returns typed data models; rendering is handled by ui/reports-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { shell } from "../infrastructure/shell.js";
import { renderShellCommand, renderSuccess, type ShellCommandModel, type SuccessModel } from "../ui/common-renderers.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { log } from "../infrastructure/logger.js";
import { createDefaultDeps } from "../infrastructure/deps.js";
import { runAllReports } from "../domain/reports/report-runner.js";
import { runAllDocs } from "../domain/reports/doc-runner.js";
import { runGenerator, hasGenerator } from "../domain/reports/generator-registry.js";
import { ReportService } from "../domain/reports/cli/report-service.js";
import { discoverArchiveCategories } from "../domain/reports/report-archive.js";
import { diffReports } from "../domain/reports/report-diff.js";
import { exportReportToHtml } from "../domain/reports/html-export.js";
import {
	renderNoGenerators, renderAuditResult, renderReportDiff,
	renderHtmlExport, renderUnknownReport, renderReportRun,
	type NoGeneratorsModel, type AuditResultModel, type HtmlExportModel, type UnknownReportModel, type ReportRunModel,
} from "../ui/reports-display.js";
import { renderNoProject, type NoProjectModel } from "../ui/common-renderers.js";

// ── Helpers ─────────────────────────────────────────────────────────

function noProjectResponse(command: string) {
	return dataResponse<NoProjectModel>({ command }, renderNoProject);
}

function noGeneratorsResponse() {
	const model: NoGeneratorsModel = { message: "No report generators configured." };
	return dataResponse(model, renderNoGenerators);
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	reports: async (req) => {
		const generators = req.project?.config.reports?.generators ?? [];
		if (generators.length === 0) return noGeneratorsResponse();
		const result = await runAllReports(generators, req.project!.path, { parallel: !!req.flags.parallel, log });
		const model: ReportRunModel = { passed: result.passed, failed: result.failed, totalDurationMs: result.totalDurationMs };
		return dataResponse(model, renderReportRun);
	},

	"reports:audit": async (req) => {
		const generators = req.project?.config.reports?.generators ?? [];
		if (generators.length === 0) return noGeneratorsResponse();
		const result = await runAllReports(generators, req.project!.path, { parallel: !!req.flags.parallel, log });
		const model: AuditResultModel = { passed: result.passed, failed: result.failed };
		return dataResponse(model, renderAuditResult);
	},

	docs: async (req) => {
		const configGenerators = req.project?.config.docs?.generators ?? [];
		const result = await runAllDocs(configGenerators, req.project!.path);
		const model: ReportRunModel = { passed: result.passed, failed: result.failed, totalDurationMs: result.totalDurationMs };
		return dataResponse(model, renderReportRun);
	},

	"reports:diff": (req) => {
		if (!req.project) return noProjectResponse("reports:diff");
		const svc = new ReportService(req.project.path, createDefaultDeps());
		const categories = discoverArchiveCategories(svc.reportsDir);
		if (categories.length === 0) {
			const model: NoGeneratorsModel = { message: "No archived reports found. Run reports first." };
			return dataResponse(model, renderNoGenerators);
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

		return dataResponse(diffs, renderReportDiff);
	},

	"reports:html": (req) => {
		if (!req.project) return noProjectResponse("reports:html");
		const svc = new ReportService(req.project.path, createDefaultDeps());
		const outputDir = typeof req.flags.output === "string" ? req.flags.output : paths.join(svc.reportsDir, "html");
		const entries = disk.readdirSync(svc.reportsDir).filter((f: string) => f.endsWith(".md"));
		if (entries.length === 0) {
			const model: NoGeneratorsModel = { message: "No report files found. Run reports first." };
			return dataResponse(model, renderNoGenerators);
		}
		const exported: HtmlExportModel["exported"] = [];
		for (const entry of entries) {
			const mdPath = paths.join(svc.reportsDir, entry);
			const result = exportReportToHtml(mdPath, outputDir);
			if (result) exported.push({ title: result.title, outputPath: result.outputPath });
		}
		const model: HtmlExportModel = { exported, outputDir };
		return dataResponse(model, renderHtmlExport);
	},

	"report:*": (req) => {
		const reportId = req.command.substring("report:".length);
		const generators = req.project?.config.reports?.generators ?? [];
		if (hasGenerator(reportId)) {
			const output = runGenerator(reportId, req.project!.path, createDefaultDeps());
			const model: SuccessModel = { message: output?.success ? `Generated ${reportId} → ${output.outputPath}` : `Generator ${reportId} failed.` };
			return dataResponse(model, renderSuccess);
		}
		const gen = generators.find((g) => g.id === reportId || g.label.toLowerCase().replace(/\s+/g, "-") === reportId);
		if (gen?.command) {
			const exitCode = shell.run(gen.command, { cwd: req.project?.path, label: `Generating ${gen.label}...` });
			const model: ShellCommandModel = { command: gen.command, exitCode, label: gen.label };
			return dataResponse(model, renderShellCommand);
		}
		const model: UnknownReportModel = {
			reportId,
			available: generators.map((g) => g.id ?? g.label).join(", ") || "(none configured)",
		};
		return dataResponse(model, renderUnknownReport);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
