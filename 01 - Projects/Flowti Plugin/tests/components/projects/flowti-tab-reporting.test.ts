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

	it("renders generator labels from generators", async () => {
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

	it("shows no generator rows when generators empty", async () => {
		el.generators = [];
		await el.updateComplete;
		const gens = el.shadowRoot!.querySelectorAll(".gen");
		expect(gens.length).toBe(0);
	});

	it("renders Run all button", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		const btns = Array.from(el.shadowRoot!.querySelectorAll("button"));
		const runAll = btns.find((b) => b.textContent?.trim() === "Run all");
		expect(runAll).toBeDefined();
	});

	it("dispatches report-run-all on Run all click", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		let fired = false;
		el.addEventListener("report-run-all", () => { fired = true; });
		const btns = Array.from(el.shadowRoot!.querySelectorAll("button"));
		const runAll = btns.find((b) => b.textContent?.trim() === "Run all") as HTMLElement;
		runAll?.click();
		expect(fired).toBe(true);
	});

	it("dispatches report-run on individual generator button click", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("report-run", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const genBtn = el.shadowRoot!.querySelector(".gen button") as HTMLElement;
		genBtn?.click();
		expect(detail).toEqual({ generatorId: "test" });
	});

	it("shows node state text", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		el.nodeStates = { test: "passed" };
		await el.updateComplete;
		const state = el.shadowRoot!.querySelector(".state");
		expect(state).not.toBeNull();
		expect(state!.textContent).toContain("passed");
	});

	it("renders one gen row per generator", async () => {
		el.generators = [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C", dependencies: ["a", "b"] },
		];
		await el.updateComplete;
		const gens = el.shadowRoot!.querySelectorAll(".gen");
		expect(gens.length).toBe(3);
	});
});
