// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-reporting.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-reporting", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-reporting") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-reporting")).toBeDefined();
	});

	it("renders pipeline nodes from generators", async () => {
		el.generators = [
			{ id: "test", label: "Test Report" },
			{ id: "coverage", label: "Coverage Report" },
			{ id: "status", label: "Status Report", dependencies: ["test", "coverage"] },
		];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Test Report");
		expect(el.shadowRoot!.textContent).toContain("Coverage Report");
		expect(el.shadowRoot!.textContent).toContain("Status Report");
	});

	it("shows empty state when no generators", async () => {
		el.generators = [];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("No report generators configured");
	});

	it("renders Run All button", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		const btn = el.shadowRoot!.querySelector(".run-all-btn");
		expect(btn).not.toBeNull();
	});

	it("dispatches report-run-all on Run All click", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		let fired = false;
		el.addEventListener("report-run-all", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector(".run-all-btn") as HTMLElement;
		btn?.click();
		expect(fired).toBe(true);
	});

	it("dispatches report-run on individual node Run click", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("report-run", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector(".node-run-btn") as HTMLElement;
		btn?.click();
		expect(detail).toEqual({ generatorId: "test" });
	});

	it("shows node status badges", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		el.nodeStates = { test: "passed" };
		await el.updateComplete;
		const badge = el.shadowRoot!.querySelector(".node-badge--passed");
		expect(badge).not.toBeNull();
	});

	it("arranges nodes in topological layers", async () => {
		el.generators = [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C", dependencies: ["a", "b"] },
		];
		await el.updateComplete;
		const layers = el.shadowRoot!.querySelectorAll(".dag-layer");
		expect(layers.length).toBe(2);
	});
});
