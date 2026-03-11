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

import type { CliDeps } from "../infrastructure/deps.js";
import { createDefaultDeps } from "../infrastructure/deps.js";
import { PLUGIN_ROOT } from "../infrastructure/config.js";
import { paths } from "../infrastructure/paths.js";
import { proc } from "../infrastructure/proc.js";
import { parseFrontmatter, applyFieldRule } from "../domain/devtools/frontmatter-utils.js";

// ── Interfaces ──────────────────────────────────────────────────────

export interface FrontmatterFixOpts {
	dryRun: boolean;
	docsRoot: string;
}

export interface FrontmatterFixResult {
	fixed: number;
	skipped: number;
	errors: number;
}

// ── Pure function ───────────────────────────────────────────────────

export function fixFrontmatter(
	opts: FrontmatterFixOpts,
	deps: Pick<CliDeps, "disk" | "paths" | "log">,
): FrontmatterFixResult {
	let fixed = 0;
	let skipped = 0;
	let errors = 0;

	/**
	 * Process a single file: check and fix frontmatter.
	 */
	function processFile(
		filePath: string,
		requiredFields: Array<{ field: string; value: string; action: string }>,
	): void {
		try {
			let content: string = deps.disk.readFileSync(filePath, "utf-8");
			const parsed = parseFrontmatter(content);
			if (!parsed) {
				deps.log(`  SKIP (no frontmatter): ${filePath}`);
				skipped++;
				return;
			}

			let modified = false;

			for (const rule of requiredFields) {
				const result = applyFieldRule(content, filePath, parsed.fields, rule);
				content = result.content;
				if (result.changed) {
					modified = true;
					if (result.message) deps.log(result.message);
				}
			}

			if (modified) {
				if (!opts.dryRun) deps.disk.writeFileSync(filePath, content, "utf-8");
				fixed++;
			} else {
				skipped++;
			}
		} catch (err) {
			deps.log(`  ERROR: ${filePath} — ${(err as Error).message}`);
			errors++;
		}
	}

	/**
	 * List all .md files in a directory (non-recursive).
	 */
	function listMdFiles(dir: string): string[] {
		try {
			return deps.disk
				.readdirSync(dir)
				.filter((f: string) => f.endsWith(".md"))
				.map((f: string) => deps.paths.join(dir, f));
		} catch {
			return [];
		}
	}

	// ── Fix 1: Add type: TechDebt to all TD files ────────────────────────

	deps.log("\n=== Fix 1: Add type: TechDebt to debt docs ===\n");
	const debtDir: string = deps.paths.join(opts.docsRoot, "debt");
	for (const file of listMdFiles(debtDir)) {
		processFile(file, [{ field: "type", value: "TechDebt", action: "add" }]);
	}

	// ── Fix 2: Add stage: idea to Automation PRD ─────────────────────────

	deps.log("\n=== Fix 2: Add missing stage: to PRDs ===\n");
	const automationPrd: string = deps.paths.join(
		opts.docsRoot,
		"features",
		"Automation",
		"Automation PRD.md",
	);
	processFile(automationPrd, [{ field: "stage", value: "idea", action: "add" }]);

	// ── Fix 3: Add stage: to Hubs PBI-003 and PBI-004 ──────────────────

	deps.log("\n=== Fix 3: Add missing stage: to PBIs ===\n");
	const hubsBacklog: string = deps.paths.join(opts.docsRoot, "features", "Hubs", "backlog");
	processFile(deps.paths.join(hubsBacklog, "PBI-003 Product Hub.md"), [
		{ field: "stage", value: "idea", action: "add" },
	]);
	processFile(deps.paths.join(hubsBacklog, "PBI-004 Project Hub.md"), [
		{ field: "stage", value: "idea", action: "add" },
	]);

	// ── Fix 4: Promote Feature Lifecycle PBIs from draft to planned ─────

	deps.log("\n=== Fix 4: Promote Feature Lifecycle PBIs to planned (TD-99) ===\n");
	const flBacklog: string = deps.paths.join(
		opts.docsRoot,
		"features",
		"Feature Lifecycle",
		"backlog",
	);
	for (const file of listMdFiles(flBacklog)) {
		processFile(file, [{ field: "stage", value: "planned", action: "replace" }]);
	}

	return { fixed, skipped, errors };
}

// ── Entry point ─────────────────────────────────────────────────────

if (
	process.argv[1]?.endsWith("fix-frontmatter.ts") ||
	process.argv[1]?.endsWith("fix-frontmatter.js")
) {
	const deps = createDefaultDeps();
	const docsRoot = paths.resolve(PLUGIN_ROOT, "docs");
	const dryRun = proc.argv().includes("--dry-run");
	const result = fixFrontmatter({ dryRun, docsRoot }, deps);
	deps.log(`\n=== Summary ===`);
	deps.log(`  Fixed: ${result.fixed}`);
	deps.log(`  Skipped: ${result.skipped}`);
	deps.log(`  Errors: ${result.errors}`);
	if (dryRun) deps.log(`  (DRY RUN — no files were modified)`);
}
