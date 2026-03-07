/**
 * generate-trace-report.mjs
 *
 * Scans vault documents for traceability gaps and generates a
 * Trace Conformance Report with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-trace-report.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { VAULT_ROOT, ROOT } from "../src/infrastructure/config.mjs";
import { Document } from "../src/infrastructure/document.mjs";

const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "traceability");
const DOCS_DIR = path.join(ROOT, "docs");

// Vault inbox is relative to the git root
const VAULT_INBOX = path.join(VAULT_ROOT, "00 - Connectivity", "inbox");

function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const fm = {};
	const lines = match[1].split(/\r?\n/);
	let currentKey = null;
	let inArray = false;

	for (const line of lines) {
		if (inArray && /^\s+-\s+/.test(line)) {
			const value = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
			fm[currentKey].push(value);
			continue;
		}

		const kvMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) {
			inArray = false;
			continue;
		}

		const key = kvMatch[1];
		const rawValue = kvMatch[2].trim();

		if (rawValue === "" || rawValue === "[]") {
			currentKey = key;
			fm[key] = rawValue === "[]" ? [] : [];
			inArray = rawValue === "";
			continue;
		}

		inArray = false;
		currentKey = null;

		if (rawValue === "true") fm[key] = true;
		else if (rawValue === "false") fm[key] = false;
		else if (/^-?\d+$/.test(rawValue)) fm[key] = parseInt(rawValue, 10);
		else if (/^-?\d+\.\d+$/.test(rawValue)) fm[key] = parseFloat(rawValue);
		else fm[key] = rawValue.replace(/^["']|["']$/g, "");
	}

	return fm;
}

function scanDir(dir, docType) {
	const results = [];
	if (!fs.existsSync(dir)) return results;

	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		const content = fs.readFileSync(path.join(dir, file), "utf-8");
		const fm = parseFrontmatter(content);
		if (!fm) continue;
		results.push({ id: file.replace(/\.md$/, ""), type: docType, frontmatter: fm });
	}
	return results;
}

function main() {
	const dryRun = process.argv.includes("--dry-run");

	// Collect documents
	const docs = [
		...scanDir(path.join(DOCS_DIR, "inbox"), "inbox"),
		...scanDir(VAULT_INBOX, "inbox"),
		...scanDir(DOCS_DIR, "pbi").filter((d) => d.id.startsWith("PBI-")),
		...scanDir(path.join(DOCS_DIR, "cycles"), "cycle"),
		...scanDir(path.join(DOCS_DIR, "debt"), "tech_debt"),
	];

	// Also scan top-level docs for PBIs that might not be in a subfolder
	const topDocs = scanDir(DOCS_DIR, "pbi").filter((d) => d.id.startsWith("PBI-"));
	for (const td of topDocs) {
		if (!docs.some((d) => d.id === td.id)) docs.push(td);
	}

	// Run conformance checks inline (avoid importing TS from Node)
	const gaps = [];

	for (const doc of docs) {
		const fm = doc.frontmatter;
		const stage = String(fm.stage ?? "");

		if (doc.type === "inbox") {
			if (!fm.parent && stage !== "backlog") {
				gaps.push({
					documentId: doc.id,
					documentType: "inbox",
					gapType: "unlinked_inbox",
					description: `Inbox item missing parent link (stage: ${stage || "unknown"})`,
				});
			}
		}

		if (doc.type === "pbi") {
			if (stage === "delivered" && !fm.delivered_in) {
				gaps.push({
					documentId: doc.id,
					documentType: "pbi",
					gapType: "delivered_without_cycle",
					description: "PBI is delivered but missing delivered_in link to cycle",
				});
			}
			if (!fm.feature) {
				gaps.push({
					documentId: doc.id,
					documentType: "pbi",
					gapType: "orphaned_pbi",
					description: "PBI missing feature link to PRD",
				});
			}
		}

		if (doc.type === "cycle") {
			if (stage === "done" && (!Array.isArray(fm.pbis) || fm.pbis.length === 0)) {
				gaps.push({
					documentId: doc.id,
					documentType: "cycle",
					gapType: "cycle_without_pbi_refs",
					description: "Completed cycle has no PBI references",
				});
			}
		}

		if (doc.type === "tech_debt") {
			const status = String(fm.status ?? fm.stage ?? "");
			if (status === "resolved" && !fm.resolved_in) {
				gaps.push({
					documentId: doc.id,
					documentType: "tech_debt",
					gapType: "resolved_debt_without_cycle",
					description: "Tech debt is resolved but missing resolved_in link to cycle",
				});
			}
		}
	}

	// Build report
	const now = new Date();
	const gapsByType = {};
	for (const gap of gaps) {
		const key = gap.gapType;
		if (!gapsByType[key]) gapsByType[key] = [];
		gapsByType[key].push(gap);
	}

	const coverage = docs.length > 0 ? Math.round(((docs.length - gaps.length) / docs.length) * 10000) / 100 : 100;

	const doc = Document.create("Trace Conformance Report")
		.mergeFrontmatter({
			type: "TraceConformanceReport",
			date: now.toISOString(),
			documents_scanned: docs.length,
			gaps_found: gaps.length,
			coverage_pct: coverage,
		})
		.addBlank()
		.heading(1, "Trace Conformance Report")
		.addBlank()
		.callout("info", "Summary", [
			`Documents scanned: ${docs.length} | Gaps found: ${gaps.length}`,
			`Coverage: ${coverage}%`,
		])
		.addBlank();

	if (gaps.length > 0) {
		doc.heading(2, "Gaps by Category").addBlank();
		doc.table(
			["Gap Type", "Count", "Documents"],
			Object.entries(gapsByType).map(([gapType, items]) => [
				gapType,
				String(items.length),
				items.map((g) => Document.wikilink(g.documentId)).join(", "),
			]),
		);
		doc.addBlank();

		doc.heading(2, "Gap Details").addBlank();
		doc.list(
			gaps.map((gap) => `**${Document.wikilink(gap.documentId)}** (${gap.documentType}): ${gap.description}`),
		);
		doc.addBlank();
	} else {
		doc.callout("success", "All documents have complete traceability links.").addBlank();
	}

	if (dryRun) {
		console.log("[trace] DRY RUN — would generate:");
		console.log(doc.toString());
		return;
	}

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-trace-conformance-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);
	doc.save(outputPath);
	console.log(`[report] TraceConformanceReport written: ${outputPath}`);
}

main();
