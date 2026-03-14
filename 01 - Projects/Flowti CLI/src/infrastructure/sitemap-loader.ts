/**
 * sitemap-loader.ts — Parse and validate configs/sitemap.json (v2 format).
 *
 * Reads the sitemap file, validates its structure against the v2 PageObject
 * schema, and returns a typed Sitemap object. Reports clear error messages
 * for malformed definitions.
 */

import type { IFileSystem } from "./types.js";
import type { Sitemap } from "./sitemap-types.js";
import { validateUnifiedSitemap } from "../domain/sitemap/page-schema.js";

// ── Public API ──────────────────────────────────────────────────────

export interface LoadResult {
	readonly ok: boolean;
	readonly sitemap?: Sitemap;
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
}

/** Load and validate sitemap from a file path. */
export function loadSitemap(sitemapPath: string, fs: IFileSystem): LoadResult {
	if (!fs.existsSync(sitemapPath)) {
		return { ok: false, errors: [`Sitemap file not found: ${sitemapPath}`], warnings: [] };
	}

	let raw: unknown;
	try {
		const content = fs.readFileSync(sitemapPath, "utf-8");
		raw = JSON.parse(content);
	} catch (err) {
		return { ok: false, errors: [`Failed to parse sitemap JSON: ${(err as Error).message}`], warnings: [] };
	}

	return validateSitemap(raw);
}

/** Validate a parsed JSON value as a v2 Sitemap. */
export function validateSitemap(raw: unknown): LoadResult {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return { ok: false, errors: ["Sitemap must be a JSON object"], warnings: [] };
	}

	const result = validateUnifiedSitemap(raw);

	if (result.errors.length > 0) {
		return { ok: false, errors: result.errors, warnings: result.warnings };
	}

	return {
		ok: true,
		sitemap: raw as Sitemap,
		errors: [],
		warnings: result.warnings,
	};
}
