// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

		it("renders NavBar with counter", () => {
			const counter = byTestId(sidebar.contentEl, "jb-nav-counter");
			expect(counter).toBeTruthy();
		});

		it("renders NavBar add step button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-nav-add-step");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("shows empty state when no steps exist", () => {
			const empty = byTestId(sidebar.contentEl, "jb-empty-steps");
			expect(empty).toBeTruthy();
			expect(empty!.textContent).toContain("No steps yet");
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

		it("renders JSON panel toggle", () => {
			const toggle = byTestId(sidebar.contentEl, "jb-json-toggle");
			expect(toggle).toBeTruthy();
		});

		it("does not show setup form elements", () => {
			expect(byTestId(sidebar.contentEl, "jb-name-input")).toBeNull();
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeNull();
		});

		it("adds a step via NavBar add button", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(sidebar.getSteps()).toHaveLength(1);
			expect(sidebar.getCurrentStepIndex()).toBe(0);
		});

		it("renders StepCard after adding a step", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			const card = byTestId(sidebar.contentEl, "jb-step-card");
			expect(card).toBeTruthy();
		});

		it("shows step number on StepCard", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			const num = byTestId(sidebar.contentEl, "jb-step-num");
			expect(num!.textContent).toBe("1");
		});

		it("shows editable title input on StepCard", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			const input = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.tagName.toLowerCase()).toBe("input");
		});

		it("emits step.added event when step is added", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.step.added", handler);
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({ title: "" });
		});

		it("emits step.updated event when title is edited", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			const handler = vi.fn();
			eventBus.on("journey-builder.step.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(input, "Open the hub");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({
				field: "title",
				value: "Open the hub",
			});
		});

		it("updates step title in state when edited", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			const input = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(input, "Navigate to settings");
			expect(sidebar.getSteps()[0].title).toBe("Navigate to settings");
		});

		it("navigates to new step when multiple steps are added", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(sidebar.getSteps()).toHaveLength(2);
			expect(sidebar.getCurrentStepIndex()).toBe(1);
			const num = byTestId(sidebar.contentEl, "jb-step-num");
			expect(num!.textContent).toBe("2");
		});

		it("navigates to previous step with Prev button", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(sidebar.getCurrentStepIndex()).toBe(1);
			byTestId(sidebar.contentEl, "jb-nav-prev")!.click();
			expect(sidebar.getCurrentStepIndex()).toBe(0);
			const num = byTestId(sidebar.contentEl, "jb-step-num");
			expect(num!.textContent).toBe("1");
		});

		it("navigates to next step with Next button", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			// Go back to first
			byTestId(sidebar.contentEl, "jb-nav-prev")!.click();
			expect(sidebar.getCurrentStepIndex()).toBe(0);
			// Go forward again
			byTestId(sidebar.contentEl, "jb-nav-next")!.click();
			expect(sidebar.getCurrentStepIndex()).toBe(1);
		});

		it("removes step and clamps index", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(sidebar.getSteps()).toHaveLength(1);
			byTestId(sidebar.contentEl, "jb-step-remove")!.click();
			expect(sidebar.getSteps()).toHaveLength(0);
			expect(sidebar.getCurrentStepIndex()).toBe(0);
			expect(byTestId(sidebar.contentEl, "jb-empty-steps")).toBeTruthy();
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

		it("emits exported event on Export click", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.exported", handler);
			byTestId(sidebar.contentEl, "jb-export-btn")!.click();
			await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
		});

		it("exported event payload includes journey definition with steps", async () => {
			// Add a step and set its title
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			const input = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(input, "A step");

			const handler = vi.fn();
			eventBus.on("journey-builder.exported", handler);
			byTestId(sidebar.contentEl, "jb-export-btn")!.click();
			await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
			const payload = handler.mock.calls[0][0].payload;
			expect(payload.definition.steps).toHaveLength(1);
			expect(payload.definition.steps[0].title).toBe("A step");
			expect(payload.definition.steps[0].guideSection).toBe(1);
		});

		it("returns to setup on back button click", () => {
			byTestId(sidebar.contentEl, "jb-back-btn")!.click();
			expect(sidebar.getSidebarState()).toBe("setup");
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeTruthy();
		});

		it("buildDefinition returns correct structure", () => {
			// Fill metadata from setup
			byTestId(sidebar.contentEl, "jb-back-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "Test Journey");
			setInputValue(byTestId(sidebar.contentEl, "jb-description-input") as HTMLTextAreaElement, "A description");
			setInputValue(byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement, "start.evt");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			// Add steps
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Step One");
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Step Two");

			// Set end event
			setInputValue(byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement, "end.evt");

			const def = sidebar.buildDefinition();
			expect(def.journey).toBe("Test Journey");
			expect(def.description).toBe("A description");
			expect(def.startEvent).toBe("start.evt");
			expect(def.endEvent).toBe("end.evt");
			expect(def.steps).toHaveLength(2);
			expect(def.steps[0].title).toBe("Step One");
			expect(def.steps[0].guideSection).toBe(1);
			expect(def.steps[1].title).toBe("Step Two");
			expect(def.steps[1].guideSection).toBe(2);
		});
	});

	describe("start event Title Sentence conversion", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
		});

		it("converts Title Sentence to dot-notation in metadata", () => {
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(input, "Session Started");
			expect(sidebar.getMetadata().startEvent).toBe("session.started");
		});

		it("passes through dot-notation unchanged", () => {
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(input, "session.started");
			expect(sidebar.getMetadata().startEvent).toBe("session.started");
		});

		it("shows preview when Title Sentence is converted", () => {
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(input, "Session Started");
			const preview = byTestId(sidebar.contentEl, "jb-start-event-preview")!;
			expect(preview.textContent).toBe("\u2192 session.started");
		});

		it("hides preview for dot-notation passthrough", () => {
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(input, "session.started");
			const preview = byTestId(sidebar.contentEl, "jb-start-event-preview")!;
			expect(preview.textContent).toBe("");
		});

		it("emits converted value in metadata.updated event", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.metadata.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(input, "Journey Builder Opened");
			expect(handler.mock.calls[0][0].payload).toEqual({
				field: "startEvent",
				value: "journey.builder.opened",
			});
		});
	});

	describe("end event Title Sentence conversion", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		it("converts Title Sentence to dot-notation in endEvent", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "Hub Tab Changed");
			expect(sidebar.getEndEvent()).toBe("hub.tab.changed");
		});

		it("passes through dot-notation unchanged", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "hub.tab.changed");
			expect(sidebar.getEndEvent()).toBe("hub.tab.changed");
		});

		it("shows preview when Title Sentence is converted", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "Hub Tab Changed");
			const preview = byTestId(sidebar.contentEl, "jb-end-event-preview")!;
			expect(preview.textContent).toBe("\u2192 hub.tab.changed");
		});

		it("hides preview for dot-notation passthrough", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "hub.tab.changed");
			const preview = byTestId(sidebar.contentEl, "jb-end-event-preview")!;
			expect(preview.textContent).toBe("");
		});

		it("emits converted value in metadata.updated event", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.metadata.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(input, "App Closed");
			expect(handler.mock.calls[0][0].payload).toEqual({
				field: "endEvent",
				value: "app.closed",
			});
		});
	});

	describe("step metadata fields", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
		});

		it("emits step.updated with field 'description' on description input", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.step.updated", handler);
			const el = byTestId(sidebar.contentEl, "jb-step-description") as HTMLTextAreaElement;
			setInputValue(el, "Opens the user hub");
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({
				field: "description",
				value: "Opens the user hub",
			});
		});

		it("emits step.updated with field 'swimlane' on swimlane change", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.step.updated", handler);
			const el = byTestId(sidebar.contentEl, "jb-step-swimlane") as HTMLSelectElement;
			el.value = "frontstage";
			el.dispatchEvent(new Event("change", { bubbles: true }));
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({
				field: "swimlane",
				value: "frontstage",
			});
		});

		it("buildDefinition includes description and swimlane", () => {
			const descEl = byTestId(sidebar.contentEl, "jb-step-description") as HTMLTextAreaElement;
			setInputValue(descEl, "A step description");
			const swEl = byTestId(sidebar.contentEl, "jb-step-swimlane") as HTMLSelectElement;
			swEl.value = "backstage";
			swEl.dispatchEvent(new Event("change", { bubbles: true }));
			const def = sidebar.buildDefinition();
			expect(def.steps[0].description).toBe("A step description");
			expect(def.steps[0].swimlane).toBe("backstage");
		});
	});

	describe("JSON panel live update", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
		});

		it("JSON content updates when step title changes", () => {
			// Expand JSON panel
			byTestId(sidebar.contentEl, "jb-json-toggle")!.click();
			const jsonContent = byTestId(sidebar.contentEl, "jb-json-content")!;
			const before = jsonContent.textContent!;

			// Edit step title
			const titleInput = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			setInputValue(titleInput, "My updated step");

			const after = jsonContent.textContent!;
			expect(after).not.toBe(before);
			expect(after).toContain("My updated step");
		});

		it("JSON content updates when step description changes", () => {
			byTestId(sidebar.contentEl, "jb-json-toggle")!.click();
			const jsonContent = byTestId(sidebar.contentEl, "jb-json-content")!;

			const descEl = byTestId(sidebar.contentEl, "jb-step-description") as HTMLTextAreaElement;
			setInputValue(descEl, "A new description");

			expect(jsonContent.textContent).toContain("A new description");
		});

		it("JSON content updates when end event changes", () => {
			byTestId(sidebar.contentEl, "jb-json-toggle")!.click();
			const jsonContent = byTestId(sidebar.contentEl, "jb-json-content")!;

			const endInput = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(endInput, "session.ended");

			expect(jsonContent.textContent).toContain("session.ended");
		});

		it("renders copy button in JSON panel header", () => {
			const copyBtn = byTestId(sidebar.contentEl, "jb-json-copy");
			expect(copyBtn).toBeTruthy();
			expect(copyBtn!.getAttribute("role")).toBe("button");
		});
	});

	describe("cleanup", () => {
		it("onClose completes without error", async () => {
			await sidebar.onOpen();
			await expect(sidebar.onClose()).resolves.toBeUndefined();
		});
	});

	describe("event autocomplete", () => {
		let sidebarWithEvents: JourneyBuilderSidebar;
		const mockEvents = ["hub.opened", "hub.tab.changed", "user.created", "session.started"];

		beforeEach(async () => {
			sidebarWithEvents = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getEventNames: () => mockEvents,
			});
			await sidebarWithEvents.onOpen();
		});

		it("attaches autocomplete to start event input in setup form", () => {
			// Navigate to setup
			const createNew = byTestId(sidebarWithEvents.contentEl, "jb-create-new");
			createNew!.click();

			const startInput = byTestId(sidebarWithEvents.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(startInput, "hub");

			const dropdown = sidebarWithEvents.contentEl.querySelector("[data-test-id='jb-autocomplete-dropdown']");
			expect(dropdown).toBeTruthy();
		});

		it("autocomplete selection updates metadata", () => {
			// Navigate to setup
			byTestId(sidebarWithEvents.contentEl, "jb-create-new")!.click();

			const startInput = byTestId(sidebarWithEvents.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(startInput, "hub");

			const items = sidebarWithEvents.contentEl.querySelectorAll("[data-test-id='jb-autocomplete-item']");
			expect(items.length).toBeGreaterThan(0);
			(items[0] as HTMLElement).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

			expect(sidebarWithEvents.getMetadata().startEvent).toBe("hub.opened");
		});

		it("attaches autocomplete to end event input in steps form", () => {
			// Navigate to setup → steps
			byTestId(sidebarWithEvents.contentEl, "jb-create-new")!.click();
			byTestId(sidebarWithEvents.contentEl, "jb-continue-btn")!.click();

			const endInput = byTestId(sidebarWithEvents.contentEl, "jb-end-event-input") as HTMLInputElement;
			setInputValue(endInput, "session");

			const dropdown = sidebarWithEvents.contentEl.querySelector("[data-test-id='jb-autocomplete-dropdown']");
			expect(dropdown).toBeTruthy();
		});

		it("does not attach autocomplete when getEventNames is not provided", async () => {
			// Default sidebar (no getEventNames)
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();

			const startInput = byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement;
			setInputValue(startInput, "hub");

			const dropdown = sidebar.contentEl.querySelector("[data-test-id='jb-autocomplete-dropdown']");
			expect(dropdown).toBeNull();
		});
	});

	describe("nav setup button", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			// Navigate to setup → steps
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			const nameInput = byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement;
			setInputValue(nameInput, "Test Journey");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		it("renders setup button in NavBar", () => {
			expect(byTestId(sidebar.contentEl, "jb-nav-setup")).toBeTruthy();
		});

		it("clicking setup button navigates to setup form", () => {
			byTestId(sidebar.contentEl, "jb-nav-setup")!.click();
			expect(sidebar.getSidebarState()).toBe("setup");
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeTruthy();
		});

		it("preserves metadata when navigating back to setup", () => {
			byTestId(sidebar.contentEl, "jb-nav-setup")!.click();
			const nameInput = byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement;
			expect(nameInput.value).toBe("Test Journey");
		});

		it("preserves steps when navigating setup → steps → setup → steps", () => {
			// Add a step first
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(sidebar.getSteps().length).toBe(1);

			// Go to setup and back
			byTestId(sidebar.contentEl, "jb-nav-setup")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			expect(sidebar.getSidebarState()).toBe("steps");
			expect(sidebar.getSteps().length).toBe(1);
		});
	});

	describe("canvas auto-open", () => {
		let openLinkText: ReturnType<typeof vi.fn>;

		beforeEach(async () => {
			openLinkText = vi.fn();
			(sidebar as unknown as { app: unknown }).app = {
				workspace: { openLinkText },
			};
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "My Journey");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		it("opens canvas on first canvas.synced event", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			expect(openLinkText).toHaveBeenCalledOnce();
			expect(openLinkText).toHaveBeenCalledWith("journeys/My Journey.canvas", "");
		});

		it("does not re-open on subsequent syncs with same path", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			expect(openLinkText).toHaveBeenCalledOnce();
		});

		it("opens again when canvas path changes", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/Other Journey.canvas" });
			expect(openLinkText).toHaveBeenCalledTimes(2);
		});

		it("resets canvasOpenedPath when returning to welcome", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			expect(openLinkText).toHaveBeenCalledOnce();

			// Go back to welcome (resets state)
			byTestId(sidebar.contentEl, "jb-back-btn")!.click(); // → setup
			byTestId(sidebar.contentEl, "jb-back-btn")!.click(); // → welcome

			// Re-enter and trigger sync again
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "My Journey");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			expect(openLinkText).toHaveBeenCalledTimes(2);
		});

		it("unsubscribes on close", async () => {
			await sidebar.onClose();
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			expect(openLinkText).not.toHaveBeenCalled();
		});
	});

	describe("canvas zoom-to-fit", () => {
		let zoomToFit: ReturnType<typeof vi.fn>;
		let openLinkText: ReturnType<typeof vi.fn>;

		beforeEach(async () => {
			vi.useFakeTimers();
			zoomToFit = vi.fn();
			openLinkText = vi.fn();
			(sidebar as unknown as { app: unknown }).app = {
				workspace: {
					openLinkText,
					getLeavesOfType: () => [
						{
							view: {
								file: { path: "journeys/My Journey.canvas" },
								canvas: { zoomToFit },
							},
						},
					],
				},
			};
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "My Journey");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("calls zoomToFit after canvas sync with delay", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			expect(zoomToFit).not.toHaveBeenCalled();
			vi.advanceTimersByTime(500);
			expect(zoomToFit).toHaveBeenCalledOnce();
		});

		it("calls zoomToFit on every sync, not just the first", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			vi.advanceTimersByTime(500);
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			vi.advanceTimersByTime(500);
			expect(zoomToFit).toHaveBeenCalledTimes(2);
		});

		it("skips zoom when canvas leaf path does not match", async () => {
			(sidebar as unknown as { app: unknown }).app = {
				workspace: {
					openLinkText,
					getLeavesOfType: () => [
						{
							view: {
								file: { path: "journeys/Other.canvas" },
								canvas: { zoomToFit },
							},
						},
					],
				},
			};
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			vi.advanceTimersByTime(500);
			expect(zoomToFit).not.toHaveBeenCalled();
		});

		it("handles missing canvas API gracefully", async () => {
			(sidebar as unknown as { app: unknown }).app = {
				workspace: {
					openLinkText,
					getLeavesOfType: () => [
						{
							view: { file: { path: "journeys/My Journey.canvas" } },
						},
					],
				},
			};
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			vi.advanceTimersByTime(500);
			// Should not throw
		});
	});

	describe("open canvas button", () => {
		let openLinkText: ReturnType<typeof vi.fn>;

		beforeEach(async () => {
			openLinkText = vi.fn();
			(sidebar as unknown as { app: unknown }).app = {
				workspace: { openLinkText },
			};
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "My Journey");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		it("renders Open Canvas button when journey name is set", () => {
			const btn = byTestId(sidebar.contentEl, "jb-open-canvas-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("does not render Open Canvas button when name is empty", async () => {
			// Go back to setup, clear name, return to steps
			byTestId(sidebar.contentEl, "jb-nav-setup")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			const btn = byTestId(sidebar.contentEl, "jb-open-canvas-btn");
			expect(btn).toBeNull();
		});

		it("opens canvas file on click", () => {
			byTestId(sidebar.contentEl, "jb-open-canvas-btn")!.click();
			expect(openLinkText).toHaveBeenCalledOnce();
			expect(openLinkText).toHaveBeenCalledWith("journeys/My Journey.canvas", "");
		});
	});

	describe("canvas sync debounce", () => {
		beforeEach(async () => {
			vi.useFakeTimers();
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			// Set a name so canvas sync has a valid path
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "My Journey");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("emits canvas.sync-requested after debounce on step add", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();

			// Not emitted immediately
			expect(handler).not.toHaveBeenCalled();

			// After debounce
			vi.advanceTimersByTime(1500);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("does not emit immediately (debounced)", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			expect(handler).not.toHaveBeenCalled();

			vi.advanceTimersByTime(500);
			expect(handler).not.toHaveBeenCalled();
		});

		it("emits with correct canvasPath based on journey name", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			vi.advanceTimersByTime(1500);

			expect(handler.mock.calls[0][0].payload.canvasPath).toBe("journeys/My Journey.canvas");
		});

		it("emits with correct definition matching sidebar state", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "First Step");

			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			// Trigger another change to schedule sync
			setInputValue(byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement, "app.closed");
			vi.advanceTimersByTime(1500);

			const def = handler.mock.calls[0][0].payload.definition;
			expect(def.journey).toBe("My Journey");
			expect(def.steps).toHaveLength(1);
			expect(def.steps[0].title).toBe("First Step");
			expect(def.endEvent).toBe("app.closed");
		});

		it("does not emit when journey name is empty", async () => {
			// Flush any pending timers from beforeEach
			vi.advanceTimersByTime(1500);

			// Go back to setup, clear name
			byTestId(sidebar.contentEl, "jb-nav-setup")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			vi.advanceTimersByTime(1500);

			expect(handler).not.toHaveBeenCalled();
		});

		it("clears timer on close", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			await sidebar.onClose();
			vi.advanceTimersByTime(1500);

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
