// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { StepCard } from "../../../src/ui/journeyBuilder/StepCard";
import type { StepCardDeps } from "../../../src/ui/journeyBuilder/StepCard";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

function allByTestId(root: HTMLElement, id: string): HTMLElement[] {
	return Array.from(root.querySelectorAll(`[data-test-id="${id}"]`)) as HTMLElement[];
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
			onEventsChanged: vi.fn(),
			onCommandsChanged: vi.fn(),
			onInteractionsChanged: vi.fn(),
			onComponentsChanged: vi.fn(),
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

	// ── Chip lists ─────────────────────────────────────────

	it("renders 4 chip list sections", () => {
		new StepCard(container, deps).render();
		expect(byTestId(container, "jb-step-events-list")).toBeTruthy();
		expect(byTestId(container, "jb-step-commands-list")).toBeTruthy();
		expect(byTestId(container, "jb-step-interactions-list")).toBeTruthy();
		expect(byTestId(container, "jb-step-components-list")).toBeTruthy();
	});

	it("pre-populates chips from step data", () => {
		deps.step = {
			id: "step-1", title: "T", description: "", swimlane: "",
			actions: [], events: ["user.login", "user.logout"],
		};
		new StepCard(container, deps).render();
		const chips = allByTestId(container, "jb-step-events-chip");
		expect(chips).toHaveLength(2);
	});

	it("renders empty chips when step has no arrays", () => {
		new StepCard(container, deps).render();
		expect(allByTestId(container, "jb-step-events-chip")).toHaveLength(0);
		expect(allByTestId(container, "jb-step-commands-chip")).toHaveLength(0);
	});

	it("calls onEventsChanged when event chip is added", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "user.login";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onEventsChanged).toHaveBeenCalledWith(["user.login"]);
	});

	it("calls onCommandsChanged when command chip is added", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-commands-input") as HTMLInputElement;
		input.value = "flowti:open-hub";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onCommandsChanged).toHaveBeenCalledWith(["flowti:open-hub"]);
	});

	it("calls onInteractionsChanged when interaction chip is added", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-interactions-input") as HTMLInputElement;
		input.value = "click: Start button";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onInteractionsChanged).toHaveBeenCalledWith(["click: Start button"]);
	});

	it("calls onComponentsChanged when component chip is added", () => {
		new StepCard(container, deps).render();
		const input = byTestId(container, "jb-step-components-input") as HTMLInputElement;
		input.value = "ActionForm";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onComponentsChanged).toHaveBeenCalledWith(["ActionForm"]);
	});

	it("calls onEventsChanged when event chip is removed", () => {
		deps.step = {
			id: "step-1", title: "T", description: "", swimlane: "",
			actions: [], events: ["a", "b"],
		};
		new StepCard(container, deps).render();
		allByTestId(container, "jb-step-events-remove")[0].click();
		expect(deps.onEventsChanged).toHaveBeenCalledWith(["b"]);
	});

	// ── Background image ─────────────────────────────────

	it("renders add background button when no image set", () => {
		deps.onBackgroundImageRequested = vi.fn();
		new StepCard(container, deps).render();
		expect(byTestId(container, "jb-step-bg-add")).toBeTruthy();
		expect(byTestId(container, "jb-step-bg-remove")).toBeNull();
	});

	it("calls onBackgroundImageRequested on add button click", () => {
		deps.onBackgroundImageRequested = vi.fn();
		new StepCard(container, deps).render();
		byTestId(container, "jb-step-bg-add")!.click();
		expect(deps.onBackgroundImageRequested).toHaveBeenCalledOnce();
	});

	it("shows filename and remove button when backgroundImage is set", () => {
		deps.onBackgroundImageRequested = vi.fn();
		deps.onBackgroundImageRemoved = vi.fn();
		deps.step = { id: "step-1", title: "T", description: "", swimlane: "", actions: [], backgroundImage: "assets/mockup.png" };
		new StepCard(container, deps).render();
		expect(byTestId(container, "jb-step-bg-add")).toBeNull();
		expect(byTestId(container, "jb-step-bg-remove")).toBeTruthy();
		const name = container.querySelector(".ft-jb-step-bg-name");
		expect(name!.textContent).toBe("mockup.png");
	});

	it("calls onBackgroundImageRemoved on remove click", () => {
		deps.onBackgroundImageRequested = vi.fn();
		deps.onBackgroundImageRemoved = vi.fn();
		deps.step = { id: "step-1", title: "T", description: "", swimlane: "", actions: [], backgroundImage: "assets/mockup.png" };
		new StepCard(container, deps).render();
		byTestId(container, "jb-step-bg-remove")!.click();
		expect(deps.onBackgroundImageRemoved).toHaveBeenCalledOnce();
	});
});
