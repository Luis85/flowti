#!/usr/bin/env node

/**
 * fix-frontmatter.ts — Idempotent frontmatter conformance script
 *
 * Adds missing `type:` and `stage:` fields to documentation files
 * per ADR-030 Frontmatter Type Conformance Standard.
 *
 * Usage: node scripts/fix-frontmatter.ts [--dry-run]
 *
 * Safe to re-run — skips files that already have the required fields.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { PLUGIN_ROOT } from "../../infrastructure/config.js";

const DOCS_ROOT: string = resolve(PLUGIN_ROOT, "docs");
const DRY_RUN: boolean = process.argv.includes("--dry-run");

let fixed: number = 0;
let skipped: number = 0;
let errors: number = 0;

function log(msg: string): void {
	console.log(msg);
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter: string, body: string, fields: Record<string, string> }
 */
function parseFrontmatter(content: string): { frontmatterRaw: string; body: string; fields: Record<string, string>; fullMatch: string } | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const frontmatterRaw: string = match[1];
	const body: string = content.slice(match[0].length);
	const fields: Record<string, string> = {};

	for (const line of frontmatterRaw.split(/\r?\n/)) {
		const fieldMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
		if (fieldMatch) {
			fields[fieldMatch[1]] = fieldMatch[2].trim();
		}
	}

	return { frontmatterRaw, body, fields, fullMatch: match[0] };
}

/**
 * Insert a field after the opening --- line in frontmatter.
 */
function insertField(content: string, fieldName: string, fieldValue: string): string {
	return content.replace(/^---\r?\n/, `---\n${fieldName}: ${fieldValue}\n`);
}

/**
 * Replace a field value in frontmatter.
 */
function replaceField(content: string, fieldName: string, newValue: string): string {
	const regex = new RegExp(`^(${fieldName}:\\s*)(.*)$`, "m");
	return content.replace(regex, `$1${newValue}`);
}

/**
 * Process a single file: check and fix frontmatter.
 */
function processFile(filePath: string, requiredFields: Array<{ field: string; value: string; action: string }>): void {
	try {
		let content: string = readFileSync(filePath, "utf-8");
		const parsed = parseFrontmatter(content);
		if (!parsed) {
			log(`  SKIP (no frontmatter): ${filePath}`);
			skipped++;
			return;
		}

		let modified: boolean = false;

		for (const { field, value, action } of requiredFields) {
			if (action === "add" && !parsed.fields[field]) {
				content = insertField(content, field, value);
				log(`  ADD ${field}: ${value} → ${filePath}`);
				modified = true;
			} else if (action === "replace" && parsed.fields[field] !== value) {
				content = replaceField(content, field, value);
				log(`  REPLACE ${field}: ${parsed.fields[field]} → ${value} in ${filePath}`);
				modified = true;
			} else if (action === "add" && parsed.fields[field]) {
				// Already has the field — skip
			}
		}

		if (modified) {
			if (!DRY_RUN) {
				writeFileSync(filePath, content, "utf-8");
			}
			fixed++;
		} else {
			skipped++;
		}
	} catch (err) {
		log(`  ERROR: ${filePath} — ${(err as Error).message}`);
		errors++;
	}
}

/**
 * List all .md files in a directory (non-recursive).
 */
function listMdFiles(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((f: string) => f.endsWith(".md"))
			.map((f: string) => join(dir, f));
	} catch {
		return [];
	}
}

// ── Fix 1: Add type: TechDebt to all TD files ────────────────────────

log("\n=== Fix 1: Add type: TechDebt to debt docs ===\n");
const debtDir: string = join(DOCS_ROOT, "debt");
for (const file of listMdFiles(debtDir)) {
	processFile(file, [{ field: "type", value: "TechDebt", action: "add" }]);
}

// ── Fix 2: Add stage: idea to Automation PRD ─────────────────────────

log("\n=== Fix 2: Add missing stage: to PRDs ===\n");
const automationPrd: string = join(DOCS_ROOT, "features", "Automation", "Automation PRD.md");
processFile(automationPrd, [{ field: "stage", value: "idea", action: "add" }]);

// ── Fix 3: Add stage: to Hubs PBI-003 and PBI-004 ──────────────────

log("\n=== Fix 3: Add missing stage: to PBIs ===\n");
const hubsBacklog: string = join(DOCS_ROOT, "features", "Hubs", "backlog");
processFile(join(hubsBacklog, "PBI-003 Product Hub.md"), [
	{ field: "stage", value: "idea", action: "add" },
]);
processFile(join(hubsBacklog, "PBI-004 Project Hub.md"), [
	{ field: "stage", value: "idea", action: "add" },
]);

// ── Fix 4: Promote Feature Lifecycle PBIs from draft to planned ─────

log("\n=== Fix 4: Promote Feature Lifecycle PBIs to planned (TD-99) ===\n");
const flBacklog: string = join(DOCS_ROOT, "features", "Feature Lifecycle", "backlog");
for (const file of listMdFiles(flBacklog)) {
	processFile(file, [{ field: "stage", value: "planned", action: "replace" }]);
}

// ── Summary ─────────────────────────────────────────────────────────

log(`\n=== Summary ===`);
log(`  Fixed: ${fixed}`);
log(`  Skipped (already conformant): ${skipped}`);
log(`  Errors: ${errors}`);
if (DRY_RUN) {
	log(`  (DRY RUN — no files were modified)`);
}
