/**
 * generate-trace-report.ts
 *
 * Scans vault documents for traceability gaps and generates a
 * Trace Conformance Report with queryable YAML frontmatter.
 *
 * Usage: npm run reports (part of reports pipeline)
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { VAULT_ROOT, PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

import { proc } from "../../../infrastructure/proc.js";
import { clock } from "../../../infrastructure/clock.js";
import { parseFrontmatterContent } from "../../../infrastructure/frontmatter.js";

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

const OUTPUT_DIR: string = paths.join(PLUGIN_ROOT, "docs", "reports", "traceability");
const DOCS_DIR: string = paths.join(PLUGIN_ROOT, "docs");

// Vault inbox is relative to the git root
const VAULT_INBOX: string = paths.join(VAULT_ROOT, "00 - Connectivity", "inbox");

function scanDir(dir: string, docType: string): ScanResult[] {
	const results: ScanResult[] = [];
	if (!disk.existsSync(dir)) return results;

	const files: string[] = disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	for (const file of files) {
		const content: string = disk.readFileSync(paths.join(dir, file), "utf-8");
		const fm: Record<string, unknown> | null = parseFrontmatterContent(content);
		if (!fm) continue;
		results.push({ id: file.replace(/\.md$/, ""), type: docType, frontmatter: fm });
	}
	return results;
}

function collectDocuments(): ScanResult[] {
	const docs: ScanResult[] = [
		...scanDir(paths.join(DOCS_DIR, "inbox"), "inbox"),
		...scanDir(VAULT_INBOX, "inbox"),
		...scanDir(DOCS_DIR, "pbi").filter((d) => d.id.startsWith("PBI-")),
		...scanDir(paths.join(DOCS_DIR, "cycles"), "cycle"),
		...scanDir(paths.join(DOCS_DIR, "debt"), "tech_debt"),
	];

	const topDocs = scanDir(DOCS_DIR, "pbi").filter((d) => d.id.startsWith("PBI-"));
	for (const td of topDocs) {
		if (!docs.some((d) => d.id === td.id)) docs.push(td);
	}
	return docs;
}

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

function buildTraceReportDoc(docs: ScanResult[], gaps: TraceGap[]): Document {
	const gapsByType: Record<string, TraceGap[]> = {};
	for (const gap of gaps) {
		if (!gapsByType[gap.gapType]) gapsByType[gap.gapType] = [];
		gapsByType[gap.gapType].push(gap);
	}

	const coverage = docs.length > 0 ? Math.round(((docs.length - gaps.length) / docs.length) * 10000) / 100 : 100;

	const reportDoc = Document.create("Trace Conformance Report")
		.mergeFrontmatter({ type: "TraceConformanceReport", date: clock.iso(), documents_scanned: docs.length, gaps_found: gaps.length, coverage_pct: coverage })
		.addBlank()
		.heading(1, "Trace Conformance Report")
		.addBlank()
		.callout("info", "Summary", [`Documents scanned: ${docs.length} | Gaps found: ${gaps.length}`, `Coverage: ${coverage}%`])
		.addBlank();

	if (gaps.length > 0) {
		reportDoc.heading(2, "Gaps by Category").addBlank();
		reportDoc.table(["Gap Type", "Count", "Documents"], Object.entries(gapsByType).map(([gapType, items]) => [gapType, String(items.length), items.map((g) => Document.wikilink(g.documentId)).join(", ")]));
		reportDoc.addBlank();
		reportDoc.heading(2, "Gap Details").addBlank();
		reportDoc.list(gaps.map((gap) => `**${Document.wikilink(gap.documentId)}** (${gap.documentType}): ${gap.description}`));
		reportDoc.addBlank();
	} else {
		reportDoc.callout("success", "All documents have complete traceability links.").addBlank();
	}

	return reportDoc;
}

function main(): void {
	const dryRun = proc.argv().includes("--dry-run");
	const docs = collectDocuments();
	const gaps = findGaps(docs);
	const reportDoc = buildTraceReportDoc(docs, gaps);

	if (dryRun) {
		return;
	}

	const safeTimestamp = clock.safeIso();
	const outputPath = paths.join(OUTPUT_DIR, `${safeTimestamp}-trace-conformance-report.md`);
	reportDoc.save(outputPath);
}

main();
