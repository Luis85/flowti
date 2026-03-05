// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { NavBar } from "../../../src/ui/journeyBuilder/NavBar";
import type { NavBarDeps } from "../../../src/ui/journeyBuilder/NavBar";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

describe("NavBar", () => {
	let container: HTMLDivElement;
	let deps: NavBarDeps;

	beforeEach(() => {
		container = document.createElement("div");
		deps = {
			stepCount: 3,
			currentIndex: 1,
			onPrev: vi.fn(),
			onNext: vi.fn(),
			onAddStep: vi.fn(),
		};
	});

	it("renders the navbar container", () => {
		new NavBar(container, deps).render();
		expect(container.querySelector(".ft-jb-navbar")).toBeTruthy();
	});

	it("renders step counter: Step 2 of 3", () => {
		new NavBar(container, deps).render();
		const counter = byTestId(container, "jb-nav-counter");
		expect(counter!.textContent).toBe("Step 2 of 3");
	});

	it("renders 'No steps yet' when stepCount is 0", () => {
		deps.stepCount = 0;
		deps.currentIndex = 0;
		new NavBar(container, deps).render();
		const counter = byTestId(container, "jb-nav-counter");
		expect(counter!.textContent).toBe("No steps yet");
	});

	it("renders correct counter for single step", () => {
		deps.stepCount = 1;
		deps.currentIndex = 0;
		new NavBar(container, deps).render();
		const counter = byTestId(container, "jb-nav-counter");
		expect(counter!.textContent).toBe("Step 1 of 1");
	});

	it("calls onPrev when prev button is clicked", () => {
		new NavBar(container, deps).render();
		byTestId(container, "jb-nav-prev")!.click();
		expect(deps.onPrev).toHaveBeenCalledOnce();
	});

	it("calls onNext when next button is clicked", () => {
		new NavBar(container, deps).render();
		byTestId(container, "jb-nav-next")!.click();
		expect(deps.onNext).toHaveBeenCalledOnce();
	});

	it("calls onAddStep when add button is clicked", () => {
		new NavBar(container, deps).render();
		byTestId(container, "jb-nav-add-step")!.click();
		expect(deps.onAddStep).toHaveBeenCalledOnce();
	});

	it("disables prev button when currentIndex is 0", () => {
		deps.currentIndex = 0;
		new NavBar(container, deps).render();
		const prev = byTestId(container, "jb-nav-prev")!;
		expect(prev.classList.contains("ft-jb-nav-disabled")).toBe(true);
		expect(prev.getAttribute("tabindex")).toBe("-1");
	});

	it("disables next button when currentIndex is last", () => {
		deps.currentIndex = 2; // last of 3
		new NavBar(container, deps).render();
		const next = byTestId(container, "jb-nav-next")!;
		expect(next.classList.contains("ft-jb-nav-disabled")).toBe(true);
		expect(next.getAttribute("tabindex")).toBe("-1");
	});

	it("does not call onPrev when disabled and clicked", () => {
		deps.currentIndex = 0;
		new NavBar(container, deps).render();
		byTestId(container, "jb-nav-prev")!.click();
		expect(deps.onPrev).not.toHaveBeenCalled();
	});

	it("does not call onNext when disabled and clicked", () => {
		deps.currentIndex = 2;
		new NavBar(container, deps).render();
		byTestId(container, "jb-nav-next")!.click();
		expect(deps.onNext).not.toHaveBeenCalled();
	});

	it("supports keyboard activation on prev (Enter)", () => {
		new NavBar(container, deps).render();
		const prev = byTestId(container, "jb-nav-prev")!;
		prev.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onPrev).toHaveBeenCalledOnce();
	});

	it("supports keyboard activation on next (Space)", () => {
		new NavBar(container, deps).render();
		const next = byTestId(container, "jb-nav-next")!;
		next.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
		expect(deps.onNext).toHaveBeenCalledOnce();
	});

	it("supports keyboard activation on add (Enter)", () => {
		new NavBar(container, deps).render();
		const add = byTestId(container, "jb-nav-add-step")!;
		add.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onAddStep).toHaveBeenCalledOnce();
	});

	it("has correct ARIA roles", () => {
		new NavBar(container, deps).render();
		expect(byTestId(container, "jb-nav-prev")!.getAttribute("role")).toBe("button");
		expect(byTestId(container, "jb-nav-next")!.getAttribute("role")).toBe("button");
		expect(byTestId(container, "jb-nav-add-step")!.getAttribute("role")).toBe("button");
	});

	it("enables prev and next for middle step", () => {
		new NavBar(container, deps).render();
		const prev = byTestId(container, "jb-nav-prev")!;
		const next = byTestId(container, "jb-nav-next")!;
		expect(prev.classList.contains("ft-jb-nav-disabled")).toBe(false);
		expect(next.classList.contains("ft-jb-nav-disabled")).toBe(false);
		expect(prev.getAttribute("tabindex")).toBe("0");
		expect(next.getAttribute("tabindex")).toBe("0");
	});
});
