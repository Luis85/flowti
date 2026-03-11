/**
 * generate-trace-report.ts — CLI project trace conformance report generator.
 *
 * Scans vault documents for traceability gaps and generates a
 * TraceConformanceReport with queryable YAML frontmatter.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { clock } from "../../../infrastructure/clock.js";
import { PLUGIN_ROOT, VAULT_ROOT } from "../../../infrastructure/config.js";
import { scanDir } from "../generators/trace-report.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Types ────────────────────────────────────────────────────────────

interface ScanResult {
	id: string;
	type: string;
	frontmatter: Record<string, unknown>;
}

interface TraceGap {
	documentId: string;
	documentType: string;
	gapType: string;
	description: string;
}

// ── Gap checkers ─────────────────────────────────────────────────────

function checkInbox(doc: ScanResult, stage: string): TraceGap[] {
	if (!doc.frontmatter.parent && stage !== "backlog") {
		return [{ documentId: doc.id, documentType: "inbox", gapType: "unlinked_inbox", description: `Inbox item missing parent link (stage: ${stage || "unknown"})` }];
	}
	return [];
}

function checkPbi(doc: ScanResult, stage: string): TraceGap[] {
	const gaps: TraceGap[] = [];
	if (stage === "delivered" && !doc.frontmatter.delivered_in) {
		gaps.push({ documentId: doc.id, documentType: "pbi", gapType: "delivered_without_cycle", description: "PBI is delivered but missing delivered_in link to cycle" });
	}
	if (!doc.frontmatter.feature) {
		gaps.push({ documentId: doc.id, documentType: "pbi", gapType: "orphaned_pbi", description: "PBI missing feature link to PRD" });
	}
	return gaps;
}

function checkCycle(doc: ScanResult, stage: string): TraceGap[] {
	if (stage === "done" && (!Array.isArray(doc.frontmatter.pbis) || doc.frontmatter.pbis.length === 0)) {
		return [{ documentId: doc.id, documentType: "cycle", gapType: "cycle_without_pbi_refs", description: "Completed cycle has no PBI references" }];
	}
	return [];
}

function checkTechDebt(doc: ScanResult): TraceGap[] {
	const status = String(doc.frontmatter.status ?? doc.frontmatter.stage ?? "");
	if (status === "resolved" && !doc.frontmatter.resolved_in) {
		return [{ documentId: doc.id, documentType: "tech_debt", gapType: "resolved_debt_without_cycle", description: "Tech debt is resolved but missing resolved_in link to cycle" }];
	}
	return [];
}

// ── Document collection and gap finding ──────────────────────────────

function collectDocuments(docsDir: string): ScanResult[] {
	const vaultInbox = paths.join(VAULT_ROOT, "00 - Connectivity", "inbox");

	const docs: ScanResult[] = [
		...scanDir(paths.join(docsDir, "inbox"), "inbox"),
		...scanDir(vaultInbox, "inbox"),
		...scanDir(docsDir, "pbi").filter((d) => d.id.startsWith("PBI-")),
		...scanDir(paths.join(docsDir, "cycles"), "cycle"),
		...scanDir(paths.join(docsDir, "debt"), "tech_debt"),
	];

	const topDocs = scanDir(docsDir, "pbi").filter((d) => d.id.startsWith("PBI-"));
	for (const td of topDocs) {
		if (!docs.some((d) => d.id === td.id)) docs.push(td);
	}
	return docs;
}

function findGaps(docs: ScanResult[]): TraceGap[] {
	const checkers: Record<string, (doc: ScanResult, stage: string) => TraceGap[]> = {
		inbox: checkInbox,
		pbi: checkPbi,
		cycle: checkCycle,
		tech_debt: (d) => checkTechDebt(d),
	};
	const gaps: TraceGap[] = [];
	for (const doc of docs) {
		const stage = String(doc.frontmatter.stage ?? "");
		const checker = checkers[doc.type];
		if (checker) gaps.push(...checker(doc, stage));
	}
	return gaps;
}

// ── Document builder ─────────────────────────────────────────────────

function buildTraceReportDoc(docs: ScanResult[], gaps: TraceGap[]): Document {
	const gapsByType: Record<string, TraceGap[]> = {};
	for (const gap of gaps) {
		if (!gapsByType[gap.gapType]) gapsByType[gap.gapType] = [];
		gapsByType[gap.gapType].push(gap);
	}

	const coverage = docs.length > 0 ? Math.round(((docs.length - gaps.length) / docs.length) * 10000) / 100 : 100;

	const reportDoc = Document.create("Trace Conformance Report")
		.mergeFrontmatter({
			type: "TraceConformanceReport",
			project: "flowti-cli",
			date: clock.iso(),
			documents_scanned: docs.length,
			gaps_found: gaps.length,
			coverage_pct: coverage,
		})
		.addBlank()
		.heading(1, "Trace Conformance Report")
		.addBlank()
		.callout("info", "Summary", [
			`Documents scanned: ${docs.length} | Gaps found: ${gaps.length}`,
			`Coverage: ${coverage}%`,
		])
		.addBlank();

	if (gaps.length > 0) {
		reportDoc.heading(2, "Gaps by Category").addBlank();
		reportDoc.table(
			["Gap Type", "Count", "Documents"],
			Object.entries(gapsByType).map(([gapType, items]) => [
				gapType,
				String(items.length),
				items.map((g) => Document.wikilink(g.documentId)).join(", "),
			]),
		);
		reportDoc.addBlank();

		reportDoc.heading(2, "Gap Details").addBlank();
		reportDoc.list(gaps.map((gap) => `**${Document.wikilink(gap.documentId)}** (${gap.documentType}): ${gap.description}`));
		reportDoc.addBlank();
	} else {
		reportDoc.callout("success", "All documents have complete traceability links.").addBlank();
	}

	return reportDoc;
}

// ── Generator ────────────────────────────────────────────────────────

export function generateTraceReport(projectPath: string, ctx?: PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath);
	const docsDir = paths.join(PLUGIN_ROOT, "docs");

	const docs = collectDocuments(docsDir);
	const gaps = findGaps(docs);
	const reportDoc = buildTraceReportDoc(docs, gaps);

	const outputPath = svc.save(reportDoc, {
		subdir: "traceability",
		slug: "trace-conformance-report",
		stableFilename: "Trace Conformance Report.md",
	});

	const coverage = docs.length > 0 ? Math.round(((docs.length - gaps.length) / docs.length) * 10000) / 100 : 100;

	log(`[cli-report] Trace Conformance Report`);
	log(`  Documents: ${docs.length} | Gaps: ${gaps.length} | Coverage: ${coverage}%`);
	log(`  Written: ${outputPath}`);

	const warnings: string[] = [];
	if (gaps.length > 0) warnings.push(`${gaps.length} traceability gap(s) found`);

	return {
		success: true,
		outputPath,
		metrics: { documents_scanned: docs.length, gaps_found: gaps.length, coverage_pct: coverage },
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}
