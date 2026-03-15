/**
 * reports.controller.ts — Controller for report and documentation commands.
 *
 * Returns typed data models; rendering is handled by ui/reports-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
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

// ── Union model types & renderers ────────────────────────────────────

type ReportsResult = ReportRunModel | NoGeneratorsModel;
type AuditResult = AuditResultModel | NoGeneratorsModel;
type DiffResult = ReturnType<typeof diffReports>[] | NoGeneratorsModel;
type HtmlResult = HtmlExportModel | NoGeneratorsModel;
type ReportStarResult = SuccessModel | ShellCommandModel | UnknownReportModel;

function isNoGenerators(m: unknown): m is NoGeneratorsModel {
	return typeof m === "object" && m !== null && "message" in m && !("command" in m) && !("passed" in m) && !("exported" in m) && !("reportId" in m);
}

function renderReportsResult(data: ReportsResult, log: LogFn): void {
	if (isNoGenerators(data)) { renderNoGenerators(data, log); return; }
	renderReportRun(data as ReportRunModel, log);
}

function renderAuditResult2(data: AuditResult, log: LogFn): void {
	if (isNoGenerators(data)) { renderNoGenerators(data, log); return; }
	renderAuditResult(data as AuditResultModel, log);
}

function renderDiffResult(data: DiffResult, log: LogFn): void {
	if (isNoGenerators(data)) { renderNoGenerators(data, log); return; }
	renderReportDiff(data as ReturnType<typeof diffReports>[], log);
}

function renderHtmlResult(data: HtmlResult, log: LogFn): void {
	if (isNoGenerators(data)) { renderNoGenerators(data, log); return; }
	renderHtmlExport(data as HtmlExportModel, log);
}

function renderReportStarResult(data: ReportStarResult, log: LogFn): void {
	if ("reportId" in data) { renderUnknownReport(data as UnknownReportModel, log); return; }
	if ("exitCode" in data) { renderShellCommand(data as ShellCommandModel, log); return; }
	renderSuccess(data as SuccessModel, log);
}

// ── report:* helpers ─────────────────────────────────────────────────

function runInternalGenerator(reportId: string, projectPath: string, deps: CliDeps): SuccessModel {
	const output = runGenerator(reportId, projectPath, deps);
	return { message: output?.success ? `Generated ${reportId} → ${output.outputPath}` : `Generator ${reportId} failed.` };
}

function runExternalGenerator(gen: { command?: string; label: string }, projectPath: string | undefined, shell: CliDeps["shell"]): ShellCommandModel {
	const exitCode = shell.run(gen.command!, { cwd: projectPath, label: `Generating ${gen.label}...` });
	return { command: gen.command!, exitCode, label: gen.label };
}

function unknownReport(reportId: string, generators: Array<{ id?: string; label: string }>): UnknownReportModel {
	return {
		reportId,
		available: generators.map((g) => g.id ?? g.label).join(", ") || "(none configured)",
	};
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	reports: adaptDescriptor<Record<string, unknown>, ReportsResult>({
		flags: {
			parallel: { type: "boolean", default: false },
		},
		handler: async (ctx) => {
			const generators = ctx.project?.config.reports?.generators ?? [];
			if (generators.length === 0) return { message: "No report generators configured." } as NoGeneratorsModel;
			const { log } = ctx.deps;
			const result = await runAllReports(generators, ctx.project!.path, ctx.deps, { parallel: ctx.flags.parallel as boolean, log });
			return { passed: result.passed, failed: result.failed, totalDurationMs: result.totalDurationMs } as ReportRunModel;
		},
		renderer: renderReportsResult,
	}),

	"reports:audit": adaptDescriptor<Record<string, unknown>, AuditResult>({
		flags: {
			parallel: { type: "boolean", default: false },
		},
		handler: async (ctx) => {
			const generators = ctx.project?.config.reports?.generators ?? [];
			if (generators.length === 0) return { message: "No report generators configured." } as NoGeneratorsModel;
			const { log } = ctx.deps;
			const result = await runAllReports(generators, ctx.project!.path, ctx.deps, { parallel: ctx.flags.parallel as boolean, log });
			return { passed: result.passed, failed: result.failed } as AuditResultModel;
		},
		renderer: renderAuditResult2,
	}),

	docs: adaptDescriptor<Record<string, unknown>, ReportRunModel>({
		requires: "project",
		handler: async (ctx) => {
			const configGenerators = ctx.project!.config.docs?.generators ?? [];
			const references = ctx.project!.config.docs?.references ?? [];
			const bookConfig = ctx.project!.config.docs?.book;
			const result = await runAllDocs(configGenerators, references, ctx.project!.path, ctx.deps, bookConfig);
			return { passed: result.passed, failed: result.failed, totalDurationMs: result.totalDurationMs };
		},
		renderer: renderReportRun,
	}),

	"reports:diff": adaptDescriptor<Record<string, unknown>, DiffResult>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const svc = new ReportService(ctx.project!.path, ctx.deps);
			const categories = discoverArchiveCategories(svc.reportsDir, { disk, paths });
			if (categories.length === 0) {
				return { message: "No archived reports found. Run reports first." } as NoGeneratorsModel;
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

			return diffs;
		},
		renderer: renderDiffResult,
	}),

	"reports:html": adaptDescriptor<Record<string, unknown>, HtmlResult>({
		requires: "project",
		flags: {
			output: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const svc = new ReportService(ctx.project!.path, ctx.deps);
			const outputDir = (ctx.flags.output as string) || paths.join(svc.reportsDir, "html");
			const entries = disk.readdirSync(svc.reportsDir).filter((f: string) => f.endsWith(".md"));
			if (entries.length === 0) {
				return { message: "No report files found. Run reports first." } as NoGeneratorsModel;
			}
			const exported: HtmlExportModel["exported"] = [];
			for (const entry of entries) {
				const mdPath = paths.join(svc.reportsDir, entry);
				const result = exportReportToHtml(mdPath, outputDir, ctx.deps);
				if (result) exported.push({ title: result.title, outputPath: result.outputPath });
			}
			return { exported, outputDir };
		},
		renderer: renderHtmlResult,
	}),

	"report:*": adaptDescriptor<Record<string, unknown>, ReportStarResult>({
		requires: "project",
		wildcardPrefix: "report:",
		handler: (ctx) => {
			const reportId = ctx.wildcard!;
			const generators = ctx.project!.config.reports?.generators ?? [];
			if (hasGenerator(reportId)) return runInternalGenerator(reportId, ctx.project!.path, ctx.deps);
			const gen = generators.find((g) => g.id === reportId || g.label.toLowerCase().replace(/\s+/g, "-") === reportId);
			if (gen?.command) return runExternalGenerator(gen, ctx.project!.path, ctx.deps.shell);
			return unknownReport(reportId, generators);
		},
		renderer: renderReportStarResult,
	}),
};
