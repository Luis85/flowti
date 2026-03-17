// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect } from "vitest";
import {
	validateCsvDocFrontmatter,
	validateTypeDocFrontmatter,
	validateDocFrontmatter,
	renderFrontmatterAlert,
	renderScanIssuesBanner,
} from "../../../src/ui/hub/helpers";
import type { FrontmatterIssue } from "../../../src/ui/hub/types";

// ── Fixtures ──────────────────────────────────────────────

function makeCsvDocFm(overrides?: Record<string, unknown>): Record<string, unknown> {
	return {
		type: "CsvDoc",
		csvFile: "[[data.csv]]",
		filePath: "folder/data.csv",
		headers: ["name", "age"],
		columns: 2,
		rows: 10,
		...overrides,
	};
}

function makeTypeDocFm(overrides?: Record<string, unknown>): Record<string, unknown> {
	return {
		type: "TypeDoc",
		name: "Event",
		properties: ["title", "date"],
		...overrides,
	};
}

// ── validateCsvDocFrontmatter ─────────────────────────────

describe("validateCsvDocFrontmatter", () => {
	it("should return no issues for valid CsvDoc frontmatter", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm());
		expect(issues).toEqual([]);
	});

	it("should report wrong type", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ type: "NoteDoc" }));
		expect(issues).toHaveLength(1);
		expect(issues[0]).toContain("NoteDoc");
	});

	it("should report missing type", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ type: undefined }));
		expect(issues).toHaveLength(1);
		expect(issues[0]).toContain("missing");
	});

	it("should report missing csvFile and filePath", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({
			csvFile: undefined,
			filePath: undefined,
		}));
		expect(issues.some((i) => i.includes("csvFile"))).toBe(true);
	});

	it("should accept csvFile without filePath", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ filePath: undefined }));
		expect(issues.filter((i) => i.includes("csvFile"))).toHaveLength(0);
	});

	it("should accept filePath without csvFile", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ csvFile: undefined }));
		expect(issues.filter((i) => i.includes("csvFile"))).toHaveLength(0);
	});

	it("should report missing headers", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ headers: undefined }));
		expect(issues.some((i) => i.includes("headers"))).toBe(true);
	});

	it("should report non-array headers", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ headers: "name,age" }));
		expect(issues.some((i) => i.includes("array"))).toBe(true);
	});

	it("should report empty headers array", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ headers: [] }));
		expect(issues.some((i) => i.includes("empty"))).toBe(true);
	});

	it("should report non-number columns", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ columns: "two" }));
		expect(issues.some((i) => i.includes("columns"))).toBe(true);
	});

	it("should report non-number rows", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({ rows: "ten" }));
		expect(issues.some((i) => i.includes("rows"))).toBe(true);
	});

	it("should allow missing columns and rows (optional)", () => {
		const issues = validateCsvDocFrontmatter(makeCsvDocFm({
			columns: undefined,
			rows: undefined,
		}));
		expect(issues).toEqual([]);
	});

	it("should accumulate multiple issues", () => {
		const issues = validateCsvDocFrontmatter({
			type: "Wrong",
			// no csvFile, no filePath, no headers
		});
		expect(issues.length).toBeGreaterThanOrEqual(3);
	});
});

// ── validateTypeDocFrontmatter ────────────────────────────

describe("validateTypeDocFrontmatter", () => {
	it("should return no issues for valid TypeDoc frontmatter", () => {
		const issues = validateTypeDocFrontmatter(makeTypeDocFm());
		expect(issues).toEqual([]);
	});

	it("should report wrong type", () => {
		const issues = validateTypeDocFrontmatter(makeTypeDocFm({ type: "CsvDoc" }));
		expect(issues.some((i) => i.includes("CsvDoc"))).toBe(true);
	});

	it("should report missing name", () => {
		const issues = validateTypeDocFrontmatter(makeTypeDocFm({ name: undefined }));
		expect(issues.some((i) => i.includes("name"))).toBe(true);
	});

	it("should report non-string name", () => {
		const issues = validateTypeDocFrontmatter(makeTypeDocFm({ name: 42 }));
		expect(issues.some((i) => i.includes("name"))).toBe(true);
	});

	it("should report non-array properties", () => {
		const issues = validateTypeDocFrontmatter(makeTypeDocFm({ properties: "title" }));
		expect(issues.some((i) => i.includes("properties"))).toBe(true);
	});

	it("should allow missing properties (optional)", () => {
		const issues = validateTypeDocFrontmatter(makeTypeDocFm({ properties: undefined }));
		expect(issues).toEqual([]);
	});
});

// ── validateDocFrontmatter ────────────────────────────────

describe("validateDocFrontmatter", () => {
	it("should return null for valid frontmatter with correct type", () => {
		const result = validateDocFrontmatter(
			{ type: "CsvDoc" },
			"CsvDoc",
			"Reports/CSV - data.md",
		);
		expect(result).toBeNull();
	});

	it("should return issue when frontmatter is undefined", () => {
		const result = validateDocFrontmatter(
			undefined,
			"CsvDoc",
			"Reports/CSV - data.md",
		);
		expect(result).not.toBeNull();
		expect(result!.fileName).toBe("CSV - data.md");
		expect(result!.issues[0]).toContain("No frontmatter");
	});

	it("should return issue when type mismatches", () => {
		const result = validateDocFrontmatter(
			{ type: "NoteDoc" },
			"CsvDoc",
			"Reports/CSV - data.md",
		);
		expect(result).not.toBeNull();
		expect(result!.issues[0]).toContain("NoteDoc");
	});

	it("should extract fileName from path", () => {
		const result = validateDocFrontmatter(
			undefined,
			"TypeDoc",
			"deeply/nested/Type - Event.md",
		);
		expect(result!.fileName).toBe("Type - Event.md");
	});

	it("should handle root-level file paths", () => {
		const result = validateDocFrontmatter(undefined, "CsvDoc", "report.md");
		expect(result!.fileName).toBe("report.md");
	});
});

// ── renderFrontmatterAlert ────────────────────────────────

describe("renderFrontmatterAlert", () => {
	it("should render nothing when no issues", () => {
		const container = document.createElement("div");
		renderFrontmatterAlert(container, []);
		expect(container.children.length).toBe(0);
	});

	it("should render alert with issues list", () => {
		const container = document.createElement("div");
		renderFrontmatterAlert(container, [
			"Missing headers",
			"Wrong type",
		]);
		expect(container.children.length).toBe(1);
		const alert = container.children[0] as HTMLElement;
		expect(alert.classList.contains("ft-alert-warning")).toBe(true);

		const listItems = alert.querySelectorAll("li");
		expect(listItems.length).toBe(2);
		expect(listItems[0].textContent).toBe("Missing headers");
		expect(listItems[1].textContent).toBe("Wrong type");
	});

	it("should include Frontmatter Issues heading", () => {
		const container = document.createElement("div");
		renderFrontmatterAlert(container, ["Test issue"]);
		const strong = container.querySelector("strong");
		expect(strong?.textContent).toBe("Frontmatter issues");
	});
});

// ── renderScanIssuesBanner ────────────────────────────────

describe("renderScanIssuesBanner", () => {
	it("should render nothing when no issues", () => {
		const container = document.createElement("div");
		renderScanIssuesBanner(container, []);
		expect(container.children.length).toBe(0);
	});

	it("should render banner with file count", () => {
		const container = document.createElement("div");
		const issues: FrontmatterIssue[] = [
			{ filePath: "Reports/CSV - a.md", fileName: "CSV - a.md", issues: ["No frontmatter"] },
			{ filePath: "Reports/CSV - b.md", fileName: "CSV - b.md", issues: ["Wrong type"] },
		];
		renderScanIssuesBanner(container, issues);
		expect(container.children.length).toBe(1);
		const alert = container.children[0] as HTMLElement;
		expect(alert.classList.contains("ft-alert-warning")).toBe(true);
		expect(alert.textContent).toContain("2 files skipped");
	});

	it("should use singular for single file", () => {
		const container = document.createElement("div");
		const issues: FrontmatterIssue[] = [
			{ filePath: "Reports/CSV - a.md", fileName: "CSV - a.md", issues: ["No frontmatter"] },
		];
		renderScanIssuesBanner(container, issues);
		expect(container.textContent).toContain("1 file skipped");
		expect(container.textContent).not.toContain("files");
	});

	it("should include collapsible details section", () => {
		const container = document.createElement("div");
		const issues: FrontmatterIssue[] = [
			{ filePath: "Reports/CSV - a.md", fileName: "CSV - a", issues: ["No frontmatter found"] },
		];
		renderScanIssuesBanner(container, issues);
		const details = container.querySelector("details");
		expect(details).not.toBeNull();
		const summary = details?.querySelector("summary");
		expect(summary?.textContent).toBe("Show details");
	});

	it("should list file names with issues in details", () => {
		const container = document.createElement("div");
		const issues: FrontmatterIssue[] = [
			{ filePath: "Reports/CSV - data.md", fileName: "CSV - data", issues: ["Missing type", "No headers"] },
		];
		renderScanIssuesBanner(container, issues);
		const li = container.querySelector("li");
		expect(li?.textContent).toContain("CSV - data");
		expect(li?.textContent).toContain("Missing type");
		expect(li?.textContent).toContain("No headers");
	});
});

// ── displayName disambiguation ────────────────────────────

describe("displayName disambiguation", () => {
	// Tests the logic extracted from DataExchangeHubView.scanCsvFiles()
	// to verify name collision detection and parent-folder appending.

	interface MinimalEntry { path: string; name: string; displayName: string }

	function computeDisplayNames(entries: MinimalEntry[]): void {
		const nameCount = new Map<string, number>();
		for (const entry of entries) {
			nameCount.set(entry.name, (nameCount.get(entry.name) ?? 0) + 1);
		}
		for (const entry of entries) {
			if ((nameCount.get(entry.name) ?? 0) > 1) {
				const lastSlash = entry.path.lastIndexOf("/");
				const parentFolder = lastSlash > 0
					? entry.path.substring(0, lastSlash).split("/").pop() ?? ""
					: "";
				entry.displayName = parentFolder
					? `${entry.name} (${parentFolder})`
					: entry.name;
			}
		}
	}

	it("should keep displayName as name when no collisions", () => {
		const entries: MinimalEntry[] = [
			{ path: "HR/employees.csv", name: "employees.csv", displayName: "employees.csv" },
			{ path: "Finance/budget.csv", name: "budget.csv", displayName: "budget.csv" },
		];
		computeDisplayNames(entries);
		expect(entries[0].displayName).toBe("employees.csv");
		expect(entries[1].displayName).toBe("budget.csv");
	});

	it("should append parent folder when names collide", () => {
		const entries: MinimalEntry[] = [
			{ path: "HR/employees.csv", name: "employees.csv", displayName: "employees.csv" },
			{ path: "Finance/employees.csv", name: "employees.csv", displayName: "employees.csv" },
		];
		computeDisplayNames(entries);
		expect(entries[0].displayName).toBe("employees.csv (HR)");
		expect(entries[1].displayName).toBe("employees.csv (Finance)");
	});

	it("should only disambiguate colliding names, not unique ones", () => {
		const entries: MinimalEntry[] = [
			{ path: "HR/employees.csv", name: "employees.csv", displayName: "employees.csv" },
			{ path: "Finance/employees.csv", name: "employees.csv", displayName: "employees.csv" },
			{ path: "IT/servers.csv", name: "servers.csv", displayName: "servers.csv" },
		];
		computeDisplayNames(entries);
		expect(entries[0].displayName).toBe("employees.csv (HR)");
		expect(entries[1].displayName).toBe("employees.csv (Finance)");
		expect(entries[2].displayName).toBe("servers.csv"); // unchanged
	});

	it("should handle three-way collision", () => {
		const entries: MinimalEntry[] = [
			{ path: "A/data.csv", name: "data.csv", displayName: "data.csv" },
			{ path: "B/data.csv", name: "data.csv", displayName: "data.csv" },
			{ path: "C/data.csv", name: "data.csv", displayName: "data.csv" },
		];
		computeDisplayNames(entries);
		expect(entries[0].displayName).toBe("data.csv (A)");
		expect(entries[1].displayName).toBe("data.csv (B)");
		expect(entries[2].displayName).toBe("data.csv (C)");
	});

	it("should handle root-level files without parent folder", () => {
		const entries: MinimalEntry[] = [
			{ path: "data.csv", name: "data.csv", displayName: "data.csv" },
			{ path: "archive/data.csv", name: "data.csv", displayName: "data.csv" },
		];
		computeDisplayNames(entries);
		expect(entries[0].displayName).toBe("data.csv"); // root — no parent to show
		expect(entries[1].displayName).toBe("data.csv (archive)");
	});

	it("should use immediate parent, not full path", () => {
		const entries: MinimalEntry[] = [
			{ path: "dept/HR/employees.csv", name: "employees.csv", displayName: "employees.csv" },
			{ path: "dept/Finance/employees.csv", name: "employees.csv", displayName: "employees.csv" },
		];
		computeDisplayNames(entries);
		expect(entries[0].displayName).toBe("employees.csv (HR)");
		expect(entries[1].displayName).toBe("employees.csv (Finance)");
	});
});
