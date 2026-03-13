/**
 * reference-book.ts — Generates a Reference Book cover page.
 *
 * Consolidates all generated references into a single markdown document
 * with wikilinks, a summary table, and frontmatter metadata. Runs as a
 * post-pipeline step after all reference generators complete.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput, BookConfig } from "../../../infrastructure/types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface BookEntry {
	id: string;
	label: string;
	outputPath: string;
	metrics: Record<string, string | number>;
	success: boolean;
}

// ── Generator ────────────────────────────────────────────────────────

const DEFAULT_TITLE = "Reference Book";
const DEFAULT_FILENAME = "Reference Book.md";

export function generateReferenceBook(
	projectPath: string,
	deps: ReportDeps,
	entries: BookEntry[],
	config?: BookConfig,
): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const title = config?.title ?? DEFAULT_TITLE;
	const filename = config?.filename ?? DEFAULT_FILENAME;
	const successful = entries.filter((e) => e.success);

	const doc = Document.create(title)
		.mergeFrontmatter({
			type: "ReferenceBook",
			date: deps.clock.iso(),
			references: successful.length,
			total: entries.length,
			tags: ["reference", "book", "documentation"],
		})
		.addBlank()
		.heading(1, title)
		.addBlank()
		.text(`This book consolidates all ${successful.length} reference document(s) generated for this project.`)
		.addBlank();

	// Summary table
	if (entries.length > 0) {
		doc.heading(2, "References").addBlank();
		doc.table(
			["Reference", "Status", "Key Metric"],
			entries.map((e) => [
				e.success ? Document.wikilink(e.label) : e.label,
				e.success ? "✓" : "✗",
				formatTopMetric(e.metrics),
			]),
		).addBlank();
	}

	// Wikilink list for successful references
	if (successful.length > 0) {
		doc.heading(2, "Documents").addBlank();
		for (const entry of successful) {
			doc.text(`- ${Document.wikilink(entry.label)}`);
		}
		doc.addBlank();
	}

	// Failed references (if any)
	const failed = entries.filter((e) => !e.success);
	if (failed.length > 0) {
		doc.heading(2, "Failed").addBlank();
		for (const entry of failed) {
			doc.text(`- ${entry.label} — generation failed`);
		}
		doc.addBlank();
	}

	const outputPath = svc.saveReference(doc, filename);

	return {
		success: true,
		outputPath,
		metrics: {
			references: successful.length,
			failed: failed.length,
		},
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTopMetric(metrics: Record<string, string | number>): string {
	const keys = Object.keys(metrics);
	if (keys.length === 0) return "—";
	const key = keys[0];
	return `${String(metrics[key])} ${key.replace(/_/g, " ")}`;
}
