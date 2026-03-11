/**
 * change-analysis.ts — Git-diff-based selective review.
 *
 * Analyzes git changes to suggest which reports/tests should be re-run
 * based on which files were modified.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ChangedFile {
	path: string;
	status: "A" | "M" | "D" | "R" | "C" | "U";
}

export interface ChangeImpact {
	affectedDomains: string[];
	suggestedActions: string[];
	changedFiles: ChangedFile[];
	summary: string;
}

// ── Domain mapping rules ────────────────────────────────────────────

interface DomainRule {
	pattern: RegExp;
	domain: string;
	actions: string[];
}

const RULES: DomainRule[] = [
	{ pattern: /^src\//, domain: "source", actions: ["build", "test", "report:codebase"] },
	{ pattern: /^tests\//, domain: "tests", actions: ["test", "report:test"] },
	{ pattern: /\.test\.(ts|js)$/, domain: "tests", actions: ["test"] },
	{ pattern: /^src\/domain\//, domain: "domain-logic", actions: ["test", "reports"] },
	{ pattern: /^src\/infrastructure\//, domain: "infrastructure", actions: ["test", "build"] },
	{ pattern: /^css\//, domain: "styles", actions: ["build"] },
	{ pattern: /^docs\//, domain: "documentation", actions: ["report:status"] },
	{ pattern: /^configs\//, domain: "configuration", actions: ["report:status"] },
	{ pattern: /^scripts\//, domain: "scripts", actions: ["build"] },
	{ pattern: /package\.json$/, domain: "dependencies", actions: ["build", "test", "health"] },
	{ pattern: /tsconfig\.json$/, domain: "typescript", actions: ["build", "dev:check"] },
	{ pattern: /eslint/, domain: "lint", actions: ["dev:lint"] },
	{ pattern: /\.md$/, domain: "documentation", actions: [] },
];

// ── Parsing ─────────────────────────────────────────────────────────

export function parseGitStatus(statusOutput: string): ChangedFile[] {
	return statusOutput
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const status = line.charAt(0) as ChangedFile["status"];
			const path = line.slice(2).trim().replace(/^"(.+)"$/, "$1");
			return { path, status };
		});
}

export function parseGitDiffNameStatus(diffOutput: string): ChangedFile[] {
	return diffOutput
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const parts = line.split("\t");
			const status = (parts[0]?.charAt(0) ?? "M") as ChangedFile["status"];
			const path = parts[1] ?? parts[0]?.slice(1).trim() ?? "";
			return { path, status };
		});
}

// ── Analysis ────────────────────────────────────────────────────────

export function analyzeChanges(changedFiles: ChangedFile[]): ChangeImpact {
	const domains = new Set<string>();
	const actions = new Set<string>();

	for (const file of changedFiles) {
		for (const rule of RULES) {
			if (rule.pattern.test(file.path)) {
				domains.add(rule.domain);
				for (const action of rule.actions) actions.add(action);
			}
		}
	}

	const affectedDomains = [...domains].sort();
	const suggestedActions = [...actions].sort();
	const summary = changedFiles.length === 0
		? "No changes detected."
		: `${changedFiles.length} file${changedFiles.length > 1 ? "s" : ""} changed across ${affectedDomains.length} domain${affectedDomains.length !== 1 ? "s" : ""}.`;

	return { affectedDomains, suggestedActions, changedFiles, summary };
}

/** Analyze uncommitted changes in a project directory. */
export function analyzeWorkingTree(projectPath: string, deps: Pick<CliDeps, "shell">): ChangeImpact {
	const output = deps.shell.runSilent(`git -C "${projectPath}" status --porcelain`);
	if (!output) return analyzeChanges([]);
	return analyzeChanges(parseGitStatus(output));
}

/** Analyze changes between a base branch and HEAD. */
export function analyzeBranchDiff(projectPath: string, deps: Pick<CliDeps, "shell">, baseBranch = "main"): ChangeImpact {
	const output = deps.shell.runSilent(`git -C "${projectPath}" diff --name-status ${baseBranch}...HEAD`);
	if (!output) return analyzeChanges([]);
	return analyzeChanges(parseGitDiffNameStatus(output));
}
