/**
 * fix-frontmatter.ts — Idempotent frontmatter conformance fixer.
 *
 * Adds missing `type:` and `stage:` fields to documentation files
 * per ADR-030 Frontmatter Type Conformance Standard.
 *
 * Pure function — all I/O injected via deps.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import { splitFrontmatter, applyFieldRule } from "../../infrastructure/frontmatter.js";

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
			const parsed = splitFrontmatter(content);
			if (!parsed) {
				deps.log(`  SKIP (no frontmatter): ${filePath}`);
				skipped++;
				return;
			}

			const fields = parsed.frontmatter;
			let modified = false;

			for (const rule of requiredFields) {
				const result = applyFieldRule(content, filePath, fields, rule);
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
