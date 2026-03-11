/**
 * generate-codebase-report.ts
 *
 * Pure helper functions for codebase report generation.
 */

export interface TypeDocNode {
	kind?: number;
	children?: TypeDocNode[];
	schemaVersion?: string;
}

export function countByKind(node: TypeDocNode): Record<number, number> {
	const counts: Record<number, number> = {};

	function walk(n: TypeDocNode): void {
		if (n.kind != null) {
			counts[n.kind] = (counts[n.kind] || 0) + 1;
		}
		for (const child of n.children || []) {
			walk(child);
		}
	}

	walk(node);
	return counts;
}

