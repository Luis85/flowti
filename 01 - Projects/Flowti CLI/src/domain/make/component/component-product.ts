/**
 * component-product.ts — Product management views for components.
 *
 * Provides functions to aggregate components into product views,
 * feature lists, and MoSCoW-prioritized groupings.
 */

import type { ProjectComponent, MoSCoWPriority } from "./component-types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ProductView {
	product: ProjectComponent;
	features: ProjectComponent[];
	featuresByPriority: Record<MoSCoWPriority, ProjectComponent[]>;
	completionRate: number;
}

// ── Public API ───────────────────────────────────────────────────────

/** Build product views from all components. Products are role="product". */
export function buildProductViews(components: ProjectComponent[]): ProductView[] {
	const products = components.filter((c) => c.role === "product");

	return products.map((product) => {
		const features = findProductFeatures(product, components);
		const featuresByPriority = groupByPriority(features);
		const completionRate = computeCompletionRate(features);

		return { product, features, featuresByPriority, completionRate };
	});
}

/** Find all features belonging to a product. */
export function findProductFeatures(product: ProjectComponent, all: ProjectComponent[]): ProjectComponent[] {
	return all.filter(
		(c) => c.role === "feature" && c.containedBy === product.name
			|| (c.features?.length && c.containedBy === product.name),
	);
}

/** Build a flat feature list with optional filters. */
export function buildFeatureList(
	components: ProjectComponent[],
	filters?: { priority?: MoSCoWPriority; status?: string },
): ProjectComponent[] {
	let features = components.filter((c) => c.role === "feature");
	if (filters?.priority) features = features.filter((f) => f.priority === filters.priority);
	if (filters?.status) features = features.filter((f) => f.status === filters.status);
	return features;
}

// ── Helpers ──────────────────────────────────────────────────────────

function groupByPriority(features: ProjectComponent[]): Record<MoSCoWPriority, ProjectComponent[]> {
	const groups: Record<MoSCoWPriority, ProjectComponent[]> = {
		must: [], should: [], could: [], wont: [],
	};
	for (const feature of features) {
		const priority = feature.priority ?? "could";
		groups[priority].push(feature);
	}
	return groups;
}

function computeCompletionRate(features: ProjectComponent[]): number {
	if (features.length === 0) return 0;
	const done = features.filter((f) => f.status === "active" || f.status === "released").length;
	return Math.round((done / features.length) * 100);
}
