// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { JSONPanel } from "../../../src/ui/journeyBuilder/JSONPanel";
import type { JSONPanelDeps } from "../../../src/ui/journeyBuilder/JSONPanel";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

describe("JSONPanel", () => {
	let container: HTMLDivElement;
	let deps: JSONPanelDeps;
	const sampleJSON = JSON.stringify({ journey: "Demo", steps: [] }, null, "\t");

	beforeEach(() => {
		container = document.createElement("div");
		deps = {
			getJSON: vi.fn(() => sampleJSON),
		};
	});

	it("renders toggle header with text 'JSON Preview'", () => {
		new JSONPanel(container, deps).render();
		const header = byTestId(container, "jb-json-toggle");
		expect(header).toBeTruthy();
		expect(header!.textContent).toContain("JSON Preview");
	});

	it("starts collapsed by default", () => {
		new JSONPanel(container, deps).render();
		const panel = byTestId(container, "jb-json-panel");
		expect(panel!.classList.contains("ft-hidden")).toBe(true);
	});

	it("shows correct chevron when collapsed", () => {
		new JSONPanel(container, deps).render();
		const chevron = byTestId(container, "jb-json-chevron");
		expect(chevron!.textContent).toBe("▸");
	});

	it("expands on toggle click", () => {
		new JSONPanel(container, deps).render();
		byTestId(container, "jb-json-toggle")!.click();
		const panel = byTestId(container, "jb-json-panel");
		expect(panel!.classList.contains("ft-hidden")).toBe(false);
	});

	it("shows correct chevron when expanded", () => {
		new JSONPanel(container, deps).render();
		byTestId(container, "jb-json-toggle")!.click();
		const chevron = byTestId(container, "jb-json-chevron");
		expect(chevron!.textContent).toBe("▾");
	});

	it("collapses again on second click", () => {
		new JSONPanel(container, deps).render();
		const toggle = byTestId(container, "jb-json-toggle")!;
		toggle.click(); // expand
		toggle.click(); // collapse
		const panel = byTestId(container, "jb-json-panel");
		expect(panel!.classList.contains("ft-hidden")).toBe(true);
	});

	it("calls getJSON and renders formatted JSON", () => {
		new JSONPanel(container, deps).render();
		const content = byTestId(container, "jb-json-content");
		expect(content!.textContent).toBe(sampleJSON);
		expect(deps.getJSON).toHaveBeenCalledOnce();
	});

	it("starts expanded when collapsed option is false", () => {
		deps.collapsed = false;
		new JSONPanel(container, deps).render();
		const panel = byTestId(container, "jb-json-panel");
		expect(panel!.classList.contains("ft-hidden")).toBe(false);
		const chevron = byTestId(container, "jb-json-chevron");
		expect(chevron!.textContent).toBe("▾");
	});
});
