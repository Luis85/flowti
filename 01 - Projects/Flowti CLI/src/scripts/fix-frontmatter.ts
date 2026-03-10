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
 *
 * NOTE: This is a standalone CLI script. It uses log() directly for
 * console output. Domain modules should not import from this file.
 */

import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../infrastructure/config.js";
import { log } from "../infrastructure/logger.js";
import { proc } from "../infrastructure/proc.js";
import { parseFrontmatter, applyFieldRule } from "../domain/devtools/frontmatter-utils.js";

const DOCS_ROOT: string = paths.resolve(PLUGIN_ROOT, "docs");
const DRY_RUN: boolean = proc.argv().includes("--dry-run");

let fixed: number = 0;
let skipped: number = 0;
let errors: number = 0;

/**
 * Process a single file: check and fix frontmatter.
 */
function processFile(filePath: string, requiredFields: Array<{ field: string; value: string; action: string }>): void {
	try {
		let content: string = disk.readFileSync(filePath, "utf-8");
		const parsed = parseFrontmatter(content);
		if (!parsed) {
			log(`  SKIP (no frontmatter): ${filePath}`);
			skipped++;
			return;
		}

		let modified: boolean = false;

		for (const rule of requiredFields) {
			const result = applyFieldRule(content, filePath, parsed.fields, rule);
			content = result.content;
			if (result.changed) {
				modified = true;
				if (result.message) log(result.message);
			}
		}

		if (modified) {
			if (!DRY_RUN) disk.writeFileSync(filePath, content, "utf-8");
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
		return disk.readdirSync(dir)
			.filter((f: string) => f.endsWith(".md"))
			.map((f: string) => paths.join(dir, f));
	} catch {
		return [];
	}
}

// ── Fix 1: Add type: TechDebt to all TD files ────────────────────────

log("\n=== Fix 1: Add type: TechDebt to debt docs ===\n");
const debtDir: string = paths.join(DOCS_ROOT, "debt");
for (const file of listMdFiles(debtDir)) {
	processFile(file, [{ field: "type", value: "TechDebt", action: "add" }]);
}

// ── Fix 2: Add stage: idea to Automation PRD ─────────────────────────

log("\n=== Fix 2: Add missing stage: to PRDs ===\n");
const automationPrd: string = paths.join(DOCS_ROOT, "features", "Automation", "Automation PRD.md");
processFile(automationPrd, [{ field: "stage", value: "idea", action: "add" }]);

// ── Fix 3: Add stage: to Hubs PBI-003 and PBI-004 ──────────────────

log("\n=== Fix 3: Add missing stage: to PBIs ===\n");
const hubsBacklog: string = paths.join(DOCS_ROOT, "features", "Hubs", "backlog");
processFile(paths.join(hubsBacklog, "PBI-003 Product Hub.md"), [
	{ field: "stage", value: "idea", action: "add" },
]);
processFile(paths.join(hubsBacklog, "PBI-004 Project Hub.md"), [
	{ field: "stage", value: "idea", action: "add" },
]);

// ── Fix 4: Promote Feature Lifecycle PBIs from draft to planned ─────

log("\n=== Fix 4: Promote Feature Lifecycle PBIs to planned (TD-99) ===\n");
const flBacklog: string = paths.join(DOCS_ROOT, "features", "Feature Lifecycle", "backlog");
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
