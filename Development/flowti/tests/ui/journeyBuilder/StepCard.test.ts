// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { StepCard } from "../../../src/ui/journeyBuilder/StepCard";
import type { StepCardDeps } from "../../../src/ui/journeyBuilder/StepCard";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

describe("StepCard", () => {
	let container: HTMLDivElement;
	let deps: StepCardDeps;

	beforeEach(() => {
		container = document.createElement("div");
		deps = {
			step: { id: "step-1", title: "Open the user hub", description: "", swimlane: "", actions: [] },
			stepNumber: 1,
			onTitleChanged: vi.fn(),
			onDescriptionChanged: vi.fn(),
			onSwimlanChanged: vi.fn(),
			onRemove: vi.fn(),
		};
	});

	it("renders step number badge", () => {
		new StepCard(container, deps).render();
		const num = byTestId(container, "jb-step-num");
		expect(num!.textContent).toBe("1");
	});

	it("renders title as editable input", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-title-input") as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.tagName.toLowerCase()).toBe("input");
	});

	it("pre-fills title input with step.title", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-title-input") as HTMLInputElement;
		expect(input.value).toBe("Open the user hub");
	});

	it("renders empty title input for new step", () => {
		deps.step = { id: "step-2", title: "", description: "", swimlane: "", actions: [] };
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-title-input") as HTMLInputElement;
		expect(input.value).toBe("");
	});

	it("renders placeholder text in empty input", () => {
		deps.step = { id: "step-2", title: "", description: "", swimlane: "", actions: [] };
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-title-input") as HTMLInputElement;
		expect(input.placeholder).toContain("step title");
	});

	it("calls onTitleChanged when title input changes", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-title-input") as HTMLInputElement;
		input.value = "New title";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(deps.onTitleChanged).toHaveBeenCalledWith("New title");
	});

	it("renders remove button", () => {
		new StepCard(container, deps).render();
		const btn = byTestId(container, "jb-step-remove");
		expect(btn).toBeTruthy();
		expect(btn!.getAttribute("role")).toBe("button");
	});

	it("calls onRemove when remove button is clicked", () => {
		new StepCard(container, deps).render();
		byTestId(container, "jb-step-remove")!.click();
		expect(deps.onRemove).toHaveBeenCalledOnce();
	});

	it("supports keyboard activation on remove (Enter)", () => {
		new StepCard(container, deps).render();
		const btn = byTestId(container, "jb-step-remove")!;
		btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onRemove).toHaveBeenCalledOnce();
	});

	it("has correct step-id data attribute", () => {
		new StepCard(container, deps).render();
		const card = byTestId(container, "jb-step-card");
		expect(card!.dataset.stepId).toBe("step-1");
	});

	it("renders description textarea", () => {
		new StepCard(container, deps).render();
		const el = byTestId(container, "jb-step-description") as HTMLTextAreaElement;
		expect(el).toBeTruthy();
		expect(el.tagName.toLowerCase()).toBe("textarea");
	});

	it("pre-fills description from step data", () => {
		deps.step = { id: "step-1", title: "T", description: "Opens the hub", swimlane: "", actions: [] };
		new StepCard(container, deps).render();
		const el = byTestId(container, "jb-step-description") as HTMLTextAreaElement;
		expect(el.value).toBe("Opens the hub");
	});

	it("calls onDescriptionChanged on input", () => {
		new StepCard(container, deps).render();
		const el = byTestId(container, "jb-step-description") as HTMLTextAreaElement;
		el.value = "New desc";
		el.dispatchEvent(new Event("input", { bubbles: true }));
		expect(deps.onDescriptionChanged).toHaveBeenCalledWith("New desc");
	});

	it("renders swimlane dropdown with 4 options plus placeholder", () => {
		new StepCard(container, deps).render();
		const el = byTestId(container, "jb-step-swimlane") as HTMLSelectElement;
		expect(el).toBeTruthy();
		expect(el.tagName.toLowerCase()).toBe("select");
		// 4 swimlanes + 1 disabled placeholder
		expect(el.options.length).toBe(5);
	});

	it("pre-selects swimlane from step data", () => {
		deps.step = { id: "step-1", title: "T", description: "", swimlane: "frontstage", actions: [] };
		new StepCard(container, deps).render();
		const el = byTestId(container, "jb-step-swimlane") as HTMLSelectElement;
		expect(el.value).toBe("frontstage");
	});

	it("calls onSwimlanChanged on change", () => {
		new StepCard(container, deps).render();
		const el = byTestId(container, "jb-step-swimlane") as HTMLSelectElement;
		el.value = "backstage";
		el.dispatchEvent(new Event("change", { bubbles: true }));
		expect(deps.onSwimlanChanged).toHaveBeenCalledWith("backstage");
	});
});
