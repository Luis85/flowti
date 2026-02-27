/**
 * traceLinkEnricher.ts
 *
 * Pure functions that determine what frontmatter properties can be
 * deterministically added to vault documents to improve traceability.
 * Enrichment is additive-only — never removes existing properties.
 */

import type { DocumentMeta, EnrichmentAction } from "./traceTypes";

/**
 * Build a map of PBI ID → cycle ID from cycle documents.
 * Cycle pbis arrays contain strings like "PBI-ONB-016: Command Catalog".
 * We extract the PBI ID prefix (e.g., "PBI-ONB-016").
 */
function buildCyclePbiMap(docs: DocumentMeta[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const doc of docs) {
		if (doc.type !== "cycle") continue;
		const pbis = doc.frontmatter.pbis;
		if (!Array.isArray(pbis)) continue;
		for (const pbi of pbis) {
			const pbiStr = String(pbi);
			const pbiId = pbiStr.split(":")[0].trim();
			if (pbiId) map.set(pbiId, doc.id);
		}
	}
	return map;
}

/**
 * Build a map of TD ID → cycle ID from cycle tech_debt arrays.
 */
function buildCycleDebtMap(docs: DocumentMeta[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const doc of docs) {
		if (doc.type !== "cycle") continue;
		const debts = doc.frontmatter.tech_debt;
		if (!Array.isArray(debts)) continue;
		for (const td of debts) {
			const tdStr = String(td);
			// Handle both "TD-87" and just "87" (numeric) formats
			const tdId = tdStr.startsWith("TD-") ? tdStr : `TD-${tdStr}`;
			map.set(tdId, doc.id);
		}
	}
	return map;
}

/**
 * Extract PBI ID from document id (filename).
 * E.g., "PBI-ONB-016 Command Catalog" → "PBI-ONB-016"
 */
function extractPbiId(docId: string): string | null {
	const match = docId.match(/^(PBI-[A-Z]+-\d+)/);
	return match ? match[1] : null;
}

/**
 * Extract TD ID from document id (filename).
 * E.g., "TD-87 Knowledge base expansion" → "TD-87"
 */
function extractTdId(docId: string): string | null {
	const match = docId.match(/^(TD-\d+)/);
	return match ? match[1] : null;
}

/**
 * Compute enrichment actions for a set of documents.
 * Returns actions that would add missing traceability properties.
 * Does NOT write anything — caller decides whether to apply.
 */
export function computeEnrichments(docs: DocumentMeta[]): EnrichmentAction[] {
	const actions: EnrichmentAction[] = [];
	const cyclePbiMap = buildCyclePbiMap(docs);
	const cycleDebtMap = buildCycleDebtMap(docs);

	for (const doc of docs) {
		if (doc.type === "pbi") {
			const pbiId = extractPbiId(doc.id);
			if (!pbiId) continue;

			// Add planned_in if missing but PBI appears in a cycle's pbis array
			if (!doc.frontmatter.planned_in) {
				const cycleId = cyclePbiMap.get(pbiId);
				if (cycleId) {
					actions.push({
						documentId: doc.id,
						property: "planned_in",
						value: cycleId,
						reason: `PBI ${pbiId} appears in ${cycleId}'s pbis array`,
					});
				}
			}
		}

		if (doc.type === "tech_debt") {
			const tdId = extractTdId(doc.id);
			if (!tdId) continue;
			const status = String(doc.frontmatter.status ?? doc.frontmatter.stage ?? "");

			// Add resolved_in if missing but TD appears in a cycle's tech_debt array and is resolved
			if (status === "resolved" && !doc.frontmatter.resolved_in) {
				const cycleId = cycleDebtMap.get(tdId);
				if (cycleId) {
					actions.push({
						documentId: doc.id,
						property: "resolved_in",
						value: cycleId,
						reason: `${tdId} appears in ${cycleId}'s tech_debt array and status is resolved`,
					});
				}
			}
		}
	}

	return actions;
}
