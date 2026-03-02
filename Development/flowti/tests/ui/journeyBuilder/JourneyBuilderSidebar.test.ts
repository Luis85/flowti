// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import {
	JourneyBuilderSidebar,
	VIEW_TYPE_JOURNEY_BUILDER,
} from "../../../src/ui/journeyBuilder/JourneyBuilderSidebar";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

// ── Helpers ──────────────────────────────────────────────

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
	return {} as import("obsidian").WorkspaceLeaf;
}

/** Query by data-test-id attribute. */
function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

/** Simulate an input event on an element. */
function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	el.value = value;
	el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ── Tests ────────────────────────────────────────────────

describe("JourneyBuilderSidebar", () => {
	let eventBus: EventBus;
	let sidebar: JourneyBuilderSidebar;

	beforeEach(() => {
		eventBus = new EventBus();
		sidebar = new JourneyBuilderSidebar(createMockLeaf(), { eventBus });
	});

	describe("view metadata", () => {
		it("returns correct view type", () => {
			expect(sidebar.getViewType()).toBe("flowti-journey-builder");
		});

		it("VIEW_TYPE constant matches getViewType()", () => {
			expect(VIEW_TYPE_JOURNEY_BUILDER).toBe(sidebar.getViewType());
		});

		it("returns correct display text", () => {
			expect(sidebar.getDisplayText()).toBe("Journey Builder");
		});

		it("returns correct icon", () => {
			expect(sidebar.getIcon()).toBe("route");
		});
	});

	describe("welcome state", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
		});

		it("starts in welcome state", () => {
			expect(sidebar.getSidebarState()).toBe("welcome");
		});

		it("renders the sidebar container class on contentEl", () => {
			const el = sidebar.contentEl;
			expect(el.classList.contains("ft-jb-sidebar")).toBe(true);
		});

		it("renders the header with title", () => {
			const header = byTestId(sidebar.contentEl, "jb-header-title");
			expect(header).toBeTruthy();
			expect(header!.textContent).toBe("Journey Builder");
		});

		it("renders Open Existing button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-open-existing");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
			expect(btn!.getAttribute("tabindex")).toBe("0");
		});

		it("renders Create New button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-create-new");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
			expect(btn!.getAttribute("tabindex")).toBe("0");
		});

		it("renders Open Existing card with title and description", () => {
			const card = byTestId(sidebar.contentEl, "jb-open-existing");
			const title = card!.querySelector("[data-test-id='jb-card-title']");
			const desc = card!.querySelector("[data-test-id='jb-card-desc']");
			expect(title!.textContent).toBe("Open Existing Journey");
			expect(desc!.textContent).toContain("Load and edit");
		});

		it("renders Create New card with title and description", () => {
			const card = byTestId(sidebar.contentEl, "jb-create-new");
			const title = card!.querySelector("[data-test-id='jb-card-title']");
			const desc = card!.querySelector("[data-test-id='jb-card-desc']");
			expect(title!.textContent).toBe("Create New Journey");
			expect(desc!.textContent).toContain("Design a new");
		});

		it("emits journey-builder.open-existing on Open Existing click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.open-existing", handler);
			const btn = byTestId(sidebar.contentEl, "jb-open-existing")!;
			btn.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("emits journey-builder.create-new on Create New click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.create-new", handler);
			const btn = byTestId(sidebar.contentEl, "jb-create-new")!;
			btn.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation with Enter", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.create-new", handler);
			const btn = byTestId(sidebar.contentEl, "jb-create-new")!;
			btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(handler).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation with Space", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.open-existing", handler);
			const btn = byTestId(sidebar.contentEl, "jb-open-existing")!;
			btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
			expect(handler).toHaveBeenCalledOnce();
		});

		it("transitions to setup state on Create New click", () => {
			const btn = byTestId(sidebar.contentEl, "jb-create-new")!;
			btn.click();
			expect(sidebar.getSidebarState()).toBe("setup");
		});

		it("does not show setup form elements in welcome state", () => {
			expect(byTestId(sidebar.contentEl, "jb-name-input")).toBeNull();
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeNull();
		});
	});

	describe("setup state", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			// Transition to setup
			const btn = byTestId(sidebar.contentEl, "jb-create-new")!;
			btn.click();
		});

		it("is in setup state after Create New click", () => {
			expect(sidebar.getSidebarState()).toBe("setup");
		});

		it("renders the setup form container", () => {
			const form = byTestId(sidebar.contentEl, "jb-setup-form");
			expect(form).toBeTruthy();
		});

		it("renders the header in setup state", () => {
			const header = byTestId(sidebar.contentEl, "jb-header-title");
			expect(header).toBeTruthy();
			expect(header!.textContent).toBe("Journey Builder");
		});

		it("renders the back button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-back-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
			expect(btn!.getAttribute("tabindex")).toBe("0");
		});

		it("renders journey name input", () => {
			const input = byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.tagName.toLowerCase()).toBe("input");
			expect(input.type).toBe("text");
		});

		it("renders description textarea", () => {
			const input = byTestId(sidebar.contentEl, "jb-description-input") as HTMLTextAreaElement;
			expect(input).toBeTruthy();
			expect(input.tagName.toLowerCase()).toBe("textarea");
		});

		it("renders start event input", () => {
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.tagName.toLowerCase()).toBe("input");
			expect(input.type).toBe("text");
		});

		it("renders continue button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-continue-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
			expect(btn!.getAttribute("tabindex")).toBe("0");
		});

		it("does not show welcome cards in setup state", () => {
			expect(byTestId(sidebar.contentEl, "jb-open-existing")).toBeNull();
			expect(byTestId(sidebar.contentEl, "jb-create-new")).toBeNull();
		});

		it("emits metadata.updated on name input", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.metadata.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement;
			setInputValue(input, "My Journey");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({ field: "name", value: "My Journey" });
		});

		it("emits metadata.updated on description input", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.metadata.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-description-input") as HTMLTextAreaElement;
			setInputValue(input, "A test journey");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({ field: "description", value: "A test journey" });
		});

		it("emits metadata.updated on start event input", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.metadata.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(input, "app.started");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({ field: "startEvent", value: "app.started" });
		});

		it("tracks metadata state across inputs", () => {
			const nameInput = byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement;
			const descInput = byTestId(sidebar.contentEl, "jb-description-input") as HTMLTextAreaElement;
			const startInput = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;

			setInputValue(nameInput, "Demo Journey");
			setInputValue(descInput, "Testing the builder");
			setInputValue(startInput, "journey.start");

			const meta = sidebar.getMetadata();
			expect(meta.name).toBe("Demo Journey");
			expect(meta.description).toBe("Testing the builder");
			expect(meta.startEvent).toBe("journey.start");
		});

		it("returns to welcome on back button click", () => {
			const btn = byTestId(sidebar.contentEl, "jb-back-btn")!;
			btn.click();
			expect(sidebar.getSidebarState()).toBe("welcome");
			expect(byTestId(sidebar.contentEl, "jb-create-new")).toBeTruthy();
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeNull();
		});

		it("resets metadata when returning to welcome", () => {
			const nameInput = byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement;
			setInputValue(nameInput, "Dirty Data");

			const backBtn = byTestId(sidebar.contentEl, "jb-back-btn")!;
			backBtn.click();

			const meta = sidebar.getMetadata();
			expect(meta.name).toBe("");
			expect(meta.description).toBe("");
			expect(meta.startEvent).toBe("");
		});

		it("supports keyboard back with Enter", () => {
			const btn = byTestId(sidebar.contentEl, "jb-back-btn")!;
			btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(sidebar.getSidebarState()).toBe("welcome");
		});

		it("transitions to steps state on Continue click", () => {
			const btn = byTestId(sidebar.contentEl, "jb-continue-btn")!;
			btn.click();
			expect(sidebar.getSidebarState()).toBe("steps");
		});
	});

	describe("steps state", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			// welcome → setup → steps
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		it("is in steps state", () => {
			expect(sidebar.getSidebarState()).toBe("steps");
		});

		it("renders step list container", () => {
			expect(byTestId(sidebar.contentEl, "jb-step-list")).toBeTruthy();
		});

		it("renders add step button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-add-step-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("renders end event input", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.tagName.toLowerCase()).toBe("input");
		});

		it("renders export button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-export-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("does not show setup form elements", () => {
			expect(byTestId(sidebar.contentEl, "jb-name-input")).toBeNull();
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeNull();
		});

		it("shows step form on Add Step click", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			expect(byTestId(sidebar.contentEl, "jb-step-form")).toBeTruthy();
			expect(byTestId(sidebar.contentEl, "jb-step-title-input")).toBeTruthy();
		});

		it("adds a step when form is confirmed", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			const titleInput = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(titleInput, "Open the user hub");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			const steps = sidebar.getSteps();
			expect(steps).toHaveLength(1);
			expect(steps[0].title).toBe("Open the user hub");
		});

		it("renders step card after adding a step", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			const titleInput = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(titleInput, "Click a button");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			const card = byTestId(sidebar.contentEl, "jb-step-card");
			expect(card).toBeTruthy();
			const title = byTestId(sidebar.contentEl, "jb-step-title");
			expect(title!.textContent).toBe("Click a button");
		});

		it("shows step number on card", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Step A");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			const num = byTestId(sidebar.contentEl, "jb-step-num");
			expect(num!.textContent).toBe("1");
		});

		it("emits step.added event when step is confirmed", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.step.added", handler);

			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Navigate");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({ title: "Navigate" });
		});

		it("does not add step with empty title", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			expect(sidebar.getSteps()).toHaveLength(0);
		});

		it("removes step form after confirming", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Test");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			expect(byTestId(sidebar.contentEl, "jb-step-form")).toBeNull();
		});

		it("can add multiple steps", () => {
			// Step 1
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "First");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			// Step 2
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Second");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			expect(sidebar.getSteps()).toHaveLength(2);
			const cards = sidebar.contentEl.querySelectorAll("[data-test-id='jb-step-card']");
			expect(cards).toHaveLength(2);
		});

		it("removes a step on remove button click", () => {
			// Add a step
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "To remove");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();
			expect(sidebar.getSteps()).toHaveLength(1);

			// Remove it
			byTestId(sidebar.contentEl, "jb-step-remove")!.click();
			expect(sidebar.getSteps()).toHaveLength(0);
			expect(byTestId(sidebar.contentEl, "jb-step-card")).toBeNull();
		});

		it("tracks end event input", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "hub.tab.changed");
			expect(sidebar.getEndEvent()).toBe("hub.tab.changed");
		});

		it("emits metadata.updated on end event input", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.metadata.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "app.closed");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({ field: "endEvent", value: "app.closed" });
		});

		it("emits exported event on Export click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.exported", handler);
			byTestId(sidebar.contentEl, "jb-export-btn")!.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("exported event payload includes step count", () => {
			// Add a step first
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "A step");
			byTestId(sidebar.contentEl, "jb-step-confirm")!.click();

			const handler = vi.fn();
			eventBus.on("journey-builder.exported", handler);
			byTestId(sidebar.contentEl, "jb-export-btn")!.click();
			expect(handler.mock.calls[0][0].payload.stepCount).toBe(1);
		});

		it("returns to setup on back button click", () => {
			byTestId(sidebar.contentEl, "jb-back-btn")!.click();
			expect(sidebar.getSidebarState()).toBe("setup");
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeTruthy();
		});

		it("confirms step via Enter key in title input", () => {
			byTestId(sidebar.contentEl, "jb-add-step-btn")!.click();
			const titleInput = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(titleInput, "Enter step");
			titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

			expect(sidebar.getSteps()).toHaveLength(1);
			expect(sidebar.getSteps()[0].title).toBe("Enter step");
		});
	});

	describe("cleanup", () => {
		it("onClose completes without error", async () => {
			await sidebar.onOpen();
			await expect(sidebar.onClose()).resolves.toBeUndefined();
		});
	});
});
