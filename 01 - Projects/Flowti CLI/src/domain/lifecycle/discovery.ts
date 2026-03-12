/**
 * discovery.ts — Discovery functions for Products and Features at the vault level.
 *
 * Mirrors the project discovery pattern in project.ts.
 */

import { PRODUCTS_DIR, FEATURES_DIR } from "../../infrastructure/config.js";
import type { CliDeps } from "../../infrastructure/deps.js";

/** List all product directory names under the products root. */
export function listProducts(deps: Pick<CliDeps, "disk">): string[] {
	try {
		return deps.disk.readdirSync(PRODUCTS_DIR, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** Resolve the full path for a product by name. */
export function getProductPath(name: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(PRODUCTS_DIR, name);
}

/** List all feature directory names under the features root. */
export function listFeatures(deps: Pick<CliDeps, "disk">): string[] {
	try {
		return deps.disk.readdirSync(FEATURES_DIR, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** Resolve the full path for a feature by name. */
export function getFeaturePath(name: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(FEATURES_DIR, name);
}
