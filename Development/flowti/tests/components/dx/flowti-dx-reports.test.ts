// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-reports";

function makeReport(overrides: Record<string, unknown> = {}) {
	return {
		name: "Test Report",
		path: "Reports/CSV - Test.md",
		frontmatter: { type: "CsvDoc", name: "Test Report" },
		frontmatterIssues: [] as string[],
		...overrides,
	};
}

describe("flowti-dx-reports", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-reports") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-reports")).toBeDefined();
	});

	it("renders empty state when no reports", async () => {
		el.reports = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No reports found");
	});

	it("renders report list items", async () => {
		el.reports = [
			makeReport({ name: "Articles Report", path: "Reports/CSV - Articles.md" }),
			makeReport({ name: "Notes Report", path: "Reports/CSV - Notes.md" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
		expect(items[0].textContent).toContain("Articles Report");
		expect(items[1].textContent).toContain("Notes Report");
	});

	it("shows issue badge when frontmatter issues exist", async () => {
		el.reports = [
			makeReport({ name: "Bad Report", frontmatterIssues: ["Missing headers", "Missing csvFile"] }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".status-badge--warning");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toContain("2 issues");
	});

	it("renders detail panel for selected report", async () => {
		el.reports = [
			makeReport({ name: "Articles Report", path: "Reports/CSV - Articles.md" }),
		];
		el.selectedId = "Reports/CSV - Articles.md";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const header = shadow.querySelector(".detail-header h3");
		expect(header!.textContent).toContain("Articles Report");

		const pathValue = shadow.querySelector(".detail-field__value");
		expect(pathValue!.textContent).toContain("Reports/CSV - Articles.md");
	});

	it("renders frontmatter issues in detail", async () => {
		el.reports = [
			makeReport({ path: "r.md", frontmatterIssues: ["Missing headers"] }),
		];
		el.selectedId = "r.md";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const issues = shadow.querySelectorAll(".issue-item");
		expect(issues.length).toBe(1);
		expect(issues[0].textContent).toContain("Missing headers");
	});

	it("filters reports by searchText", async () => {
		el.reports = [
			makeReport({ name: "Articles Report" }),
			makeReport({ name: "Notes Report" }),
		];
		el.searchText = "notes";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Notes Report");
	});

	it("dispatches select-report on list item click", async () => {
		el.reports = [makeReport({ path: "Reports/CSV - Test.md" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".list-item") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-report", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		item.click();
		expect(detail).toEqual({ reportPath: "Reports/CSV - Test.md" });
	});

	it("dispatches open-report on button click", async () => {
		el.reports = [makeReport({ path: "Reports/CSV - Test.md" })];
		el.selectedId = "Reports/CSV - Test.md";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector(".detail-actions button") as HTMLButtonElement;
		expect(btn!.textContent).toContain("Open report");

		let detail: unknown = null;
		el.addEventListener("open-report", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		btn.click();
		expect(detail).toEqual({ reportPath: "Reports/CSV - Test.md" });
	});
});
