/**
 * markdown-sitemap-import.ts — Pure domain functions for markdown-to-sitemap import.
 *
 * Validates parsed frontmatter records and generates a v2 UnifiedSitemap
 * from validated component definitions. No I/O — caller handles file scanning,
 * YAML parsing, and sitemap writing.
 */

import type { ComponentMarkdown, ValidationResult, ImportWarning, Strategy } from "./markdown-sitemap-types.js";
import { VALID_STATUSES } from "./markdown-sitemap-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function toKebab(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/^-+|-+$/g, "");
}

const STRING_FIELDS = ["name", "category", "description"] as const;
const ARRAY_FIELDS = ["props", "slots", "variants"] as const;

// ── Validation ───────────────────────────────────────────────────────

export function validateComponents(
	files: Record<string, Record<string, unknown>>,
	requiredFields: readonly string[],
): ValidationResult {
	const valid: ComponentMarkdown[] = [];
	const warnings: ImportWarning[] = [];

	for (const [file, fm] of Object.entries(files)) {
		const problem = checkRecord(fm, requiredFields);
		if (problem) {
			warnings.push({ file, reason: problem });
			continue;
		}

		// Always validate status if present (even when not in requiredFields)
		if ("status" in fm && !VALID_STATUSES.includes(fm.status as typeof VALID_STATUSES[number])) {
			warnings.push({ file, reason: `status must be one of: ${VALID_STATUSES.join(", ")}` });
			continue;
		}

		valid.push({
			name: fm.name as string,
			category: fm.category as string,
			description: (fm.description as string | undefined) ?? "",
			status: (fm.status as ComponentMarkdown["status"] | undefined) ?? "draft",
			props: asStringArray(fm.props),
			slots: asStringArray(fm.slots),
			variants: asStringArray(fm.variants),
		});
	}

	return { valid, warnings };
}

function checkRecord(fm: Record<string, unknown>, requiredFields: readonly string[]): string | null {
	for (const field of requiredFields) {
		if (!(field in fm)) return `missing required field: ${field}`;

		if (STRING_FIELDS.includes(field as typeof STRING_FIELDS[number])) {
			if (typeof fm[field] !== "string" || (fm[field] as string).trim() === "") {
				return `${field} must be a non-empty string`;
			}
		}

		if (ARRAY_FIELDS.includes(field as typeof ARRAY_FIELDS[number])) {
			if (!Array.isArray(fm[field])) {
				return `${field} must be an array`;
			}
		}

		if (field === "status") {
			if (!VALID_STATUSES.includes(fm[field] as typeof VALID_STATUSES[number])) {
				return `status must be one of: ${VALID_STATUSES.join(", ")}`;
			}
		}
	}
	return null;
}

function asStringArray(value: unknown): readonly string[] {
	if (!Array.isArray(value)) return [];
	return value.map(String);
}
