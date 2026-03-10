import { describe, it, expect } from "vitest";
import {
	parseGitStatus,
	parseGitDiffNameStatus,
	analyzeChanges,
	type ChangedFile,
} from "../../../src/domain/review/change-analysis.js";

// ── parseGitStatus ──────────────────────────────────────────────────

describe("parseGitStatus", () => {
	it("parses modified files", () => {
		const result = parseGitStatus("M src/main.ts\nM src/utils.ts");
		expect(result).toEqual([
			{ path: "src/main.ts", status: "M" },
			{ path: "src/utils.ts", status: "M" },
		]);
	});

	it("parses added files", () => {
		const result = parseGitStatus("A src/new-file.ts");
		expect(result).toEqual([{ path: "src/new-file.ts", status: "A" }]);
	});

	it("parses deleted files", () => {
		const result = parseGitStatus("D old-file.ts");
		expect(result).toEqual([{ path: "old-file.ts", status: "D" }]);
	});

	it("parses mixed statuses", () => {
		const result = parseGitStatus("A src/new.ts\nM src/old.ts\nD removed.ts");
		expect(result).toHaveLength(3);
		expect(result[0].status).toBe("A");
		expect(result[1].status).toBe("M");
		expect(result[2].status).toBe("D");
	});

	it("handles quoted paths", () => {
		const result = parseGitStatus('M "src/path with spaces/file.ts"');
		expect(result[0].path).toBe("src/path with spaces/file.ts");
	});

	it("skips empty lines", () => {
		const result = parseGitStatus("M src/a.ts\n\n\nM src/b.ts\n");
		expect(result).toHaveLength(2);
	});

	it("returns empty array for empty input", () => {
		expect(parseGitStatus("")).toEqual([]);
	});

	it("trims whitespace", () => {
		const result = parseGitStatus("  M src/file.ts  ");
		expect(result[0].path).toBe("src/file.ts");
	});
});

// ── parseGitDiffNameStatus ──────────────────────────────────────────

describe("parseGitDiffNameStatus", () => {
	it("parses tab-separated diff output", () => {
		const result = parseGitDiffNameStatus("M\tsrc/main.ts\nA\tsrc/new.ts");
		expect(result).toEqual([
			{ path: "src/main.ts", status: "M" },
			{ path: "src/new.ts", status: "A" },
		]);
	});

	it("parses renamed files", () => {
		const result = parseGitDiffNameStatus("R\tsrc/renamed.ts");
		expect(result[0].status).toBe("R");
	});

	it("skips empty lines", () => {
		const result = parseGitDiffNameStatus("M\tsrc/a.ts\n\nA\tsrc/b.ts");
		expect(result).toHaveLength(2);
	});

	it("returns empty array for empty input", () => {
		expect(parseGitDiffNameStatus("")).toEqual([]);
	});

	it("handles deleted files", () => {
		const result = parseGitDiffNameStatus("D\tsrc/old.ts");
		expect(result[0].status).toBe("D");
	});
});

// ── analyzeChanges ──────────────────────────────────────────────────

describe("analyzeChanges", () => {
	it("returns empty impact for no changes", () => {
		const result = analyzeChanges([]);
		expect(result.affectedDomains).toEqual([]);
		expect(result.suggestedActions).toEqual([]);
		expect(result.changedFiles).toEqual([]);
		expect(result.summary).toBe("No changes detected.");
	});

	it("detects source domain", () => {
		const files: ChangedFile[] = [{ path: "src/main.ts", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("source");
		expect(result.suggestedActions).toContain("build");
		expect(result.suggestedActions).toContain("test");
	});

	it("detects tests domain from tests/ directory", () => {
		const files: ChangedFile[] = [{ path: "tests/unit/foo.test.ts", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("tests");
		expect(result.suggestedActions).toContain("test");
	});

	it("detects tests domain from .test.ts extension", () => {
		const files: ChangedFile[] = [{ path: "src/domain/foo.test.ts", status: "A" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("tests");
	});

	it("detects domain-logic for src/domain/ files", () => {
		const files: ChangedFile[] = [{ path: "src/domain/health/health.ts", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("domain-logic");
		expect(result.affectedDomains).toContain("source");
	});

	it("detects infrastructure domain", () => {
		const files: ChangedFile[] = [{ path: "src/infrastructure/shell.ts", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("infrastructure");
		expect(result.affectedDomains).toContain("source");
	});

	it("detects documentation domain", () => {
		const files: ChangedFile[] = [{ path: "docs/readme.md", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("documentation");
	});

	it("detects configuration domain", () => {
		const files: ChangedFile[] = [{ path: "configs/flowti.config.json", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("configuration");
	});

	it("detects styles domain", () => {
		const files: ChangedFile[] = [{ path: "css/theme.css", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("styles");
	});

	it("detects dependencies domain for package.json", () => {
		const files: ChangedFile[] = [{ path: "package.json", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("dependencies");
		expect(result.suggestedActions).toContain("health");
	});

	it("detects typescript domain for tsconfig.json", () => {
		const files: ChangedFile[] = [{ path: "tsconfig.json", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("typescript");
		expect(result.suggestedActions).toContain("dev:check");
	});

	it("detects lint domain for eslint config", () => {
		const files: ChangedFile[] = [{ path: ".eslintrc.json", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("lint");
		expect(result.suggestedActions).toContain("dev:lint");
	});

	it("detects multiple domains from multiple files", () => {
		const files: ChangedFile[] = [
			{ path: "src/main.ts", status: "M" },
			{ path: "tests/unit/main.test.ts", status: "M" },
			{ path: "docs/api.md", status: "A" },
		];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toContain("source");
		expect(result.affectedDomains).toContain("tests");
		expect(result.affectedDomains).toContain("documentation");
	});

	it("deduplicates domains and actions", () => {
		const files: ChangedFile[] = [
			{ path: "src/a.ts", status: "M" },
			{ path: "src/b.ts", status: "M" },
		];
		const result = analyzeChanges(files);
		const sourceCount = result.affectedDomains.filter((d) => d === "source").length;
		expect(sourceCount).toBe(1);
	});

	it("sorts domains and actions alphabetically", () => {
		const files: ChangedFile[] = [
			{ path: "tests/foo.test.ts", status: "M" },
			{ path: "src/main.ts", status: "M" },
			{ path: "docs/readme.md", status: "M" },
		];
		const result = analyzeChanges(files);
		const sorted = [...result.affectedDomains].sort();
		expect(result.affectedDomains).toEqual(sorted);
		const sortedActions = [...result.suggestedActions].sort();
		expect(result.suggestedActions).toEqual(sortedActions);
	});

	it("generates singular summary for one file", () => {
		const files: ChangedFile[] = [{ path: "src/main.ts", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.summary).toContain("1 file changed");
	});

	it("generates plural summary for multiple files", () => {
		const files: ChangedFile[] = [
			{ path: "src/a.ts", status: "M" },
			{ path: "src/b.ts", status: "M" },
		];
		const result = analyzeChanges(files);
		expect(result.summary).toContain("2 files changed");
	});

	it("includes changed files in result", () => {
		const files: ChangedFile[] = [{ path: "src/main.ts", status: "M" }];
		const result = analyzeChanges(files);
		expect(result.changedFiles).toEqual(files);
	});

	it("handles files matching no rules", () => {
		const files: ChangedFile[] = [{ path: "random-file.xyz", status: "A" }];
		const result = analyzeChanges(files);
		expect(result.affectedDomains).toEqual([]);
		expect(result.suggestedActions).toEqual([]);
		expect(result.changedFiles).toHaveLength(1);
	});
});
