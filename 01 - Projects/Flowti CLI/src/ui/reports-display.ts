/**
 * reports-display.ts — Console display helpers for report commands.
 *
 * Pure renderers used as dataResponse callbacks by reports.controller.ts.
 */

import { log } from "../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW } from "../infrastructure/ui.js";
import type { ReportDiff } from "../domain/reports/export/report-diff.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ReportRunModel {
	passed: number;
	failed: number;
	totalDurationMs: number;
}

export interface NoGeneratorsModel {
	message: string;
}

export interface AuditResultModel {
	passed: number;
	failed: number;
}

export interface HtmlExportModel {
	exported: Array<{ title: string; outputPath: string }>;
	outputDir: string;
}

export interface UnknownReportModel {
	reportId: string;
	available: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderReportRun(data: ReportRunModel): void {
	const icon = data.failed === 0 ? `${GREEN}✓${RESET}` : `${YELLOW}⚠${RESET}`;
	log(`  ${icon} Reports complete: ${data.passed} passed, ${data.failed} failed (${data.totalDurationMs}ms).\n`);
}

export function renderNoGenerators(data: NoGeneratorsModel): void {
	log(`\n  ${DIM}${data.message}${RESET}\n`);
}

export function renderAuditResult(data: AuditResultModel): void {
	log(`  ${GREEN}✓${RESET} Audit complete: ${data.passed} passed, ${data.failed} failed.\n`);
}

export function renderReportDiff(data: ReportDiff[]): void {
	if (data.length === 0) {
		log(`\n  ${DIM}No metric changes between latest reports.${RESET}\n`);
		return;
	}
	log(`\n  ${CYAN}Report Diff${RESET}\n`);
	for (const diff of data) {
		log(`  ${GREEN}${diff.category}${RESET}  ${DIM}${diff.previousFile} → ${diff.currentFile}${RESET}`);
		for (const d of diff.deltas) {
			const color = d.delta > 0 ? GREEN : d.delta < 0 ? YELLOW : DIM;
			log(`    ${color}${d.formatted}${RESET}  ${d.key}  ${DIM}(${d.previous} → ${d.current})${RESET}`);
		}
		if (diff.unchanged.length > 0) log(`    ${DIM}${diff.unchanged.length} unchanged metric${diff.unchanged.length === 1 ? "" : "s"}${RESET}`);
		log();
	}
}

export function renderHtmlExport(data: HtmlExportModel): void {
	for (const entry of data.exported) {
		log(`  ${GREEN}✓${RESET} ${entry.title} → ${DIM}${entry.outputPath}${RESET}`);
	}
	const count = data.exported.length;
	log(`\n  ${count} report${count !== 1 ? "s" : ""} exported to ${DIM}${data.outputDir}${RESET}\n`);
}

export function renderUnknownReport(data: UnknownReportModel): void {
	log(`\n  ${RED}Unknown report: ${data.reportId}${RESET}`);
	log(`  ${DIM}Available: ${data.available}${RESET}\n`);
}
