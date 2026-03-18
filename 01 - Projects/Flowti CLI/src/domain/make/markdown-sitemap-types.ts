/**
 * markdown-sitemap-types.ts — Types for markdown-to-sitemap import pipeline.
 *
 * Defines the shape of parsed component markdown, validation results,
 * import results, and the config contract for markdownSource.
 */

import type { UnifiedSitemap } from "../sitemap/unified-page.js";
import type { CliDeps } from "../../infrastructure/deps.js";

export type Strategy = "category" | "flat" | "hierarchical";

export const STRATEGIES: readonly Strategy[] = ["category", "flat", "hierarchical"] as const;

export const VALID_STATUSES = ["draft", "ready", "deprecated"] as const;
export type ComponentStatus = typeof VALID_STATUSES[number];

export interface ComponentMarkdown {
	readonly name: string;
	readonly category: string;
	readonly description: string;
	readonly status: ComponentStatus;
	readonly props: readonly string[];
	readonly slots: readonly string[];
	readonly variants: readonly string[];
}

export interface ImportWarning {
	readonly file: string;
	readonly reason: string;
}

export interface ValidationResult {
	readonly valid: readonly ComponentMarkdown[];
	readonly warnings: readonly ImportWarning[];
}

export interface ImportResult {
	readonly sitemap: UnifiedSitemap;
	readonly componentCount: number;
	readonly skippedCount: number;
	readonly warnings: readonly ImportWarning[];
}

export interface MarkdownSourceConfig {
	readonly path: string;
	readonly strategy: Strategy;
	readonly requiredFields: readonly string[];
}

export type ImportDeps = Pick<CliDeps, "disk" | "paths">;
