/**
 * discovery.ts — Discovery functions for Products and Features at the vault level.
 *
 * Mirrors the project discovery pattern in project.ts.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

/** List all product directory names under the products root. */
export function listProducts(productsDir: string, deps: Pick<CliDeps, "disk">): string[] {
	try {
		return deps.disk.readdirSync(productsDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** Resolve the full path for a product by name. */
export function getProductPath(name: string, productsDir: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(productsDir, name);
}

/** List all feature directory names under the features root. */
export function listFeatures(featuresDir: string, deps: Pick<CliDeps, "disk">): string[] {
	try {
		return deps.disk.readdirSync(featuresDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** Resolve the full path for a feature by name. */
export function getFeaturePath(name: string, featuresDir: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(featuresDir, name);
}
