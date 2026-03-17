/**
 * traceTypes.ts
 *
 * Types for the traceability conformance checker and link enricher.
 * Used by build-time scripts only — not registered at runtime.
 */

export type TraceDocumentType = "inbox" | "pbi" | "cycle" | "prd" | "tech_debt";

export type TraceGapType =
	| "orphaned_pbi"
	| "unlinked_inbox"
	| "cycle_without_pbi_refs"
	| "delivered_without_cycle"
	| "resolved_debt_without_cycle";

export interface TraceGap {
	documentId: string;
	documentType: TraceDocumentType;
	gapType: TraceGapType;
	description: string;
}

export interface EnrichmentAction {
	documentId: string;
	property: string;
	value: string;
	reason: string;
}

export interface TraceConformanceReport {
	documents_scanned: number;
	gaps_found: number;
	gaps: TraceGap[];
}

export interface DocumentMeta {
	id: string;
	type: TraceDocumentType;
	frontmatter: Record<string, unknown>;
}
