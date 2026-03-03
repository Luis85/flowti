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
			step: { id: "step-1", title: "Open the user hub", actions: [] },
			stepNumber: 1,
			onTitleChanged: vi.fn(),
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
		deps.step = { id: "step-2", title: "", actions: [] };
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-title-input") as HTMLInputElement;
		expect(input.value).toBe("");
	});

	it("renders placeholder text in empty input", () => {
		deps.step = { id: "step-2", title: "", actions: [] };
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
});
