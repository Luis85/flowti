/**
 * traceConformanceChecker.ts
 *
 * Pure functions that audit vault documents for missing traceability links.
 * Identifies gaps that prevent Obsidian's graph view from showing the
 * full idea → PBI → cycle → delivery chain.
 */

import type { DocumentMeta, TraceGap, TraceConformanceReport } from "./traceTypes";

/**
 * Check inbox items for required traceability links.
 * - Delivered items must have a parent link (to PRD or PBI).
 */
function checkInboxItems(docs: DocumentMeta[]): TraceGap[] {
	const gaps: TraceGap[] = [];
	for (const doc of docs) {
		if (doc.type !== "inbox") continue;
		const fm = doc.frontmatter;
		const stage = String(fm.stage ?? "");
		const parent = fm.parent;

		if (!parent && stage !== "backlog") {
			gaps.push({
				documentId: doc.id,
				documentType: "inbox",
				gapType: "unlinked_inbox",
				description: `Inbox item missing parent link (stage: ${stage || "unknown"})`,
			});
		}
	}
	return gaps;
}

/**
 * Check PBIs for required traceability links.
 * - Delivered PBIs must have delivered_in linking to a cycle.
 */
function checkPBIs(docs: DocumentMeta[]): TraceGap[] {
	const gaps: TraceGap[] = [];
	for (const doc of docs) {
		if (doc.type !== "pbi") continue;
		const fm = doc.frontmatter;
		const stage = String(fm.stage ?? "");
		const deliveredIn = fm.delivered_in;

		if (stage === "delivered" && !deliveredIn) {
			gaps.push({
				documentId: doc.id,
				documentType: "pbi",
				gapType: "delivered_without_cycle",
				description: "PBI is delivered but missing delivered_in link to cycle",
			});
		}

		if (!fm.feature) {
			gaps.push({
				documentId: doc.id,
				documentType: "pbi",
				gapType: "orphaned_pbi",
				description: "PBI missing feature link to PRD",
			});
		}
	}
	return gaps;
}

/**
 * Check cycle documents for required traceability links.
 * - Done cycles must have a non-empty pbis array.
 */
function checkCycles(docs: DocumentMeta[]): TraceGap[] {
	const gaps: TraceGap[] = [];
	for (const doc of docs) {
		if (doc.type !== "cycle") continue;
		const fm = doc.frontmatter;
		const stage = String(fm.stage ?? "");
		const pbis = fm.pbis;

		if (stage === "done" && (!Array.isArray(pbis) || pbis.length === 0)) {
			gaps.push({
				documentId: doc.id,
				documentType: "cycle",
				gapType: "cycle_without_pbi_refs",
				description: "Completed cycle has no PBI references",
			});
		}
	}
	return gaps;
}

/**
 * Check tech debt documents for required traceability links.
 * - Resolved TDs must have resolved_in linking to a cycle.
 */
function checkTechDebt(docs: DocumentMeta[]): TraceGap[] {
	const gaps: TraceGap[] = [];
	for (const doc of docs) {
		if (doc.type !== "tech_debt") continue;
		const fm = doc.frontmatter;
		const status = String(fm.status ?? fm.stage ?? "");
		const resolvedIn = fm.resolved_in;

		if (status === "resolved" && !resolvedIn) {
			gaps.push({
				documentId: doc.id,
				documentType: "tech_debt",
				gapType: "resolved_debt_without_cycle",
				description: "Tech debt is resolved but missing resolved_in link to cycle",
			});
		}
	}
	return gaps;
}

/**
 * Run all conformance checks on a set of documents.
 * Returns a report with all identified traceability gaps.
 */
export function checkConformance(docs: DocumentMeta[]): TraceConformanceReport {
	const gaps = [
		...checkInboxItems(docs),
		...checkPBIs(docs),
		...checkCycles(docs),
		...checkTechDebt(docs),
	];

	return {
		documents_scanned: docs.length,
		gaps_found: gaps.length,
		gaps,
	};
}
