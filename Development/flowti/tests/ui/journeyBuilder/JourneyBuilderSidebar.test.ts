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
			expect(sidebar.getDisplayText()).toBe("Journey builder");
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
			expect(header!.textContent).toBe("Journey builder");
		});

		it("renders empty state with create button when vault has no journey files", () => {
			const empty = byTestId(sidebar.contentEl, "jb-empty-welcome");
			expect(empty).toBeTruthy();
			const btn = byTestId(sidebar.contentEl, "jb-create-new");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("renders import links in empty state", () => {
			const importLink = byTestId(sidebar.contentEl, "jb-import-link");
			const browseLink = byTestId(sidebar.contentEl, "jb-browse-link");
			expect(importLink).toBeTruthy();
			expect(browseLink).toBeTruthy();
		});

		it("emits journey-builder.create-new on Create click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.create-new", handler);
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation with Enter", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.create-new", handler);
			byTestId(sidebar.contentEl, "jb-create-new")!.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("transitions to setup state on Create click", () => {
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			expect(sidebar.getSidebarState()).toBe("setup");
		});

		it("does not show setup form elements in welcome state", () => {
			expect(byTestId(sidebar.contentEl, "jb-name-input")).toBeNull();
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeNull();
		});
	});

	describe("welcome state — with saved journeys", () => {
		let sidebarWithJourneys: JourneyBuilderSidebar;

		beforeEach(async () => {
			sidebarWithJourneys = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getJourneyFolder: () => "03 - Resources/Journeys",
			});
			// Mock vault.getFiles to return a .journey file in the configured folder
			(sidebarWithJourneys as unknown as { app: { vault: { getFiles: () => { path: string }[] } } }).app.vault.getFiles = () => [
				{ path: "03 - Resources/Journeys/Test/Test.journey" },
			];
			await sidebarWithJourneys.onOpen();
		});

		it("renders welcome cards when journeys exist", () => {
			expect(byTestId(sidebarWithJourneys.contentEl, "jb-empty-welcome")).toBeNull();
			expect(byTestId(sidebarWithJourneys.contentEl, "jb-open-existing")).toBeTruthy();
			expect(byTestId(sidebarWithJourneys.contentEl, "jb-create-new")).toBeTruthy();
		});

		it("renders Open Existing card with title and description", () => {
			const card = byTestId(sidebarWithJourneys.contentEl, "jb-open-existing");
			const title = card!.querySelector("[data-test-id='jb-card-title']");
			const desc = card!.querySelector("[data-test-id='jb-card-desc']");
			expect(title!.textContent).toBe("Open journey");
			expect(desc!.textContent).toContain("journey or canvas");
		});

		it("renders Create New card with title and description", () => {
			const card = byTestId(sidebarWithJourneys.contentEl, "jb-create-new");
			const title = card!.querySelector("[data-test-id='jb-card-title']");
			const desc = card!.querySelector("[data-test-id='jb-card-desc']");
			expect(title!.textContent).toBe("Create new journey");
			expect(desc!.textContent).toContain("Design a new");
		});

		it("emits journey-builder.open-existing on Open Existing click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.open-existing", handler);
			byTestId(sidebarWithJourneys.contentEl, "jb-open-existing")!.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation with Space on Open Existing", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.open-existing", handler);
			byTestId(sidebarWithJourneys.contentEl, "jb-open-existing")!.dispatchEvent(
				new KeyboardEvent("keydown", { key: " ", bubbles: true }),
			);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("does not render Import Definition card (consolidated into Open existing)", () => {
			expect(byTestId(sidebarWithJourneys.contentEl, "jb-import-definition")).toBeNull();
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
			expect(header!.textContent).toBe("Journey builder");
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

		it("renders end event input", () => {
			const input = byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.tagName.toLowerCase()).toBe("input");
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
			setInputValue(byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement, "dirty.end");

			const backBtn = byTestId(sidebar.contentEl, "jb-back-btn")!;
			backBtn.click();

			const meta = sidebar.getMetadata();
			expect(meta.name).toBe("");
			expect(meta.description).toBe("");
			expect(meta.startEvent).toBe("");
			expect(meta.endEvent).toBe("");
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

		it("renders export button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-export-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("renders 'View in Test Hub' button", () => {
			const btn = byTestId(sidebar.contentEl, "jb-view-hub-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
		});

		it("'View in Test Hub' emits hub navigation events when journey has a name", async () => {
			// Load a journey to set the name (can't set via getMetadata which returns a copy)
			sidebar.loadJourneyFromJSON(JSON.stringify({
				journey: "Test Journey", description: "", startEvent: "", endEvent: "",
				steps: [{ id: "s1", title: "Step 1", description: "", swimlane: "", actions: [] }],
			}));

			const handler = vi.fn();
			eventBus.on("ui.openTestManagementHub", handler);
			const navHandler = vi.fn();
			eventBus.on("hub.navigate", navHandler);

			byTestId(sidebar.contentEl, "jb-view-hub-btn")!.click();

			await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
			await vi.waitFor(() => expect(navHandler).toHaveBeenCalledOnce());
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

		it("emits notice.success on Export click", async () => {
			const handler = vi.fn();
			eventBus.on("notice.success", handler);
			byTestId(sidebar.contentEl, "jb-export-btn")!.click();
			await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
			expect(handler.mock.calls[0][0].payload.message).toContain("Exported");
		});

		it("returns to setup on back button click", () => {
			byTestId(sidebar.contentEl, "jb-back-btn")!.click();
			expect(sidebar.getSidebarState()).toBe("setup");
			expect(byTestId(sidebar.contentEl, "jb-setup-form")).toBeTruthy();
		});

		it("buildDefinition returns correct structure", () => {
			// Fill metadata from setup (including end event)
			byTestId(sidebar.contentEl, "jb-back-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "Test Journey");
			setInputValue(byTestId(sidebar.contentEl, "jb-description-input") as HTMLTextAreaElement, "A description");
			setInputValue(byTestId(sidebar.contentEl, "jb-start-event-input") as HTMLInputElement, "start.evt");
			setInputValue(byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement, "end.evt");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			// Add steps
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Step One");
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "Step Two");

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

	describe("step chip lists (metadata arrays)", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
		});

		it("emits step.updated when event chip is added", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.step.updated", handler);
			const input = byTestId(sidebar.contentEl, "jb-step-events-input") as HTMLInputElement;
			input.value = "user.login";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({
				field: "events",
				value: ["user.login"],
			});
		});

		it("buildDefinition includes chip arrays", () => {
			// Add events
			const evtInput = byTestId(sidebar.contentEl, "jb-step-events-input") as HTMLInputElement;
			evtInput.value = "user.login";
			evtInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			// Add commands
			const cmdInput = byTestId(sidebar.contentEl, "jb-step-commands-input") as HTMLInputElement;
			cmdInput.value = "flowti:open-hub";
			cmdInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

			const def = sidebar.buildDefinition();
			expect(def.steps[0].events).toEqual(["user.login"]);
			expect(def.steps[0].commands).toEqual(["flowti:open-hub"]);
			expect(def.steps[0].interactions).toEqual([]);
			expect(def.steps[0].components).toEqual([]);
		});

		it("JSON preview reflects chip data", () => {
			byTestId(sidebar.contentEl, "jb-json-toggle")!.click();
			const jsonContent = byTestId(sidebar.contentEl, "jb-json-content")!;

			const input = byTestId(sidebar.contentEl, "jb-step-events-input") as HTMLInputElement;
			input.value = "session.started";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

			expect(jsonContent.textContent).toContain("session.started");
		});

		it("chip removal updates buildDefinition", () => {
			// Add two events
			const input = byTestId(sidebar.contentEl, "jb-step-events-input") as HTMLInputElement;
			input.value = "a.evt";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			input.value = "b.evt";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

			// Remove first
			const removes = sidebar.contentEl.querySelectorAll("[data-test-id='jb-step-events-remove']");
			(removes[0] as HTMLElement).click();

			const def = sidebar.buildDefinition();
			expect(def.steps[0].events).toEqual(["b.evt"]);
		});
	});

	describe("action templates", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
		});

		it("shows template picker on Add action click", () => {
			byTestId(sidebar.contentEl, "jb-add-action-btn")!.click();
			expect(byTestId(sidebar.contentEl, "jb-template-picker")).toBeTruthy();
			expect(byTestId(sidebar.contentEl, "jb-tool-picker")).toBeNull();
		});

		it("shows tool picker after Custom selection", () => {
			byTestId(sidebar.contentEl, "jb-add-action-btn")!.click();
			byTestId(sidebar.contentEl, "jb-template-custom")!.click();
			expect(byTestId(sidebar.contentEl, "jb-template-picker")).toBeNull();
			expect(byTestId(sidebar.contentEl, "jb-tool-picker")).toBeTruthy();
		});

		it("creates multiple actions from template", () => {
			byTestId(sidebar.contentEl, "jb-add-action-btn")!.click();
			const cards = sidebar.contentEl.querySelectorAll("[data-test-id='jb-template-card']");
			// Click "Open via command" (first template)
			(cards[0] as HTMLElement).click();
			const steps = sidebar.getSteps();
			expect(steps[0].actions).toHaveLength(3);
			expect(steps[0].actions[0].tool).toBe("command");
			expect(steps[0].actions[1].tool).toBe("wait");
			expect(steps[0].actions[2].tool).toBe("assert");
		});

		it("emits action.added for each template action", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.action.added", handler);
			byTestId(sidebar.contentEl, "jb-add-action-btn")!.click();
			const cards = sidebar.contentEl.querySelectorAll("[data-test-id='jb-template-card']");
			(cards[0] as HTMLElement).click();
			expect(handler).toHaveBeenCalledTimes(3);
		});

		it("selects first template action after creation", () => {
			byTestId(sidebar.contentEl, "jb-add-action-btn")!.click();
			const cards = sidebar.contentEl.querySelectorAll("[data-test-id='jb-template-card']");
			(cards[0] as HTMLElement).click();
			// First action should be selected — ActionForm should render for "command"
			expect(sidebar.getSelectedActionIndex()).toBe(0);
		});

		it("buildDefinition includes template-generated actions", () => {
			byTestId(sidebar.contentEl, "jb-add-action-btn")!.click();
			const cards = sidebar.contentEl.querySelectorAll("[data-test-id='jb-template-card']");
			(cards[1] as HTMLElement).click(); // click-element: click + wait
			const def = sidebar.buildDefinition();
			expect(def.steps[0].actions).toHaveLength(2);
			expect(def.steps[0].actions![0].tool).toBe("click");
			expect(def.steps[0].actions![1].tool).toBe("wait");
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

		it("JSON content reflects end event set in setup", () => {
			// Go back to setup and set end event
			byTestId(sidebar.contentEl, "jb-back-btn")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-end-event-input") as HTMLInputElement, "session.ended");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();

			byTestId(sidebar.contentEl, "jb-json-toggle")!.click();
			const jsonContent = byTestId(sidebar.contentEl, "jb-json-content")!;
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
		const mockEventCatalog = [
			{ type: "hub.opened", category: "Hub", description: "Hub was opened" },
			{ type: "hub.tab.changed", category: "Hub", description: "Tab was switched" },
			{ type: "user.created", category: "User", description: "User was created" },
			{ type: "session.started", category: "Session", description: "Session started" },
		];

		beforeEach(async () => {
			sidebarWithEvents = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getEventCatalog: () => mockEventCatalog,
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

		it("attaches autocomplete to end event input in setup form", () => {
			// Navigate to setup
			byTestId(sidebarWithEvents.contentEl, "jb-create-new")!.click();

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

		it("skips zoom on subsequent syncs (content edits)", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			vi.advanceTimersByTime(500);
			expect(zoomToFit).toHaveBeenCalledOnce();

			await eventBus.emit("journey-builder.canvas.synced", { canvasPath: "journeys/My Journey.canvas" });
			vi.advanceTimersByTime(500);
			// No additional zoom — content edit, not navigation
			expect(zoomToFit).toHaveBeenCalledOnce();
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

	describe("canvas zoom-to-selection", () => {
		const canvasPath = "03 - Resources/Journeys/My Journey/My Journey.canvas";
		let zoomToFit: ReturnType<typeof vi.fn>;
		let zoomToSelection: ReturnType<typeof vi.fn>;
		let selectOnly: ReturnType<typeof vi.fn>;
		let deselectAll: ReturnType<typeof vi.fn>;
		let openLinkText: ReturnType<typeof vi.fn>;

		function makeCanvasNodes(activeColor?: string): Map<string, { getData: () => Record<string, unknown> }> {
			const nodes = new Map<string, { getData: () => Record<string, unknown> }>();
			nodes.set("start", { getData: () => ({ type: "text", color: "4" }) });
			nodes.set("step-group", { getData: () => ({ type: "group", color: activeColor ?? undefined }) });
			nodes.set("end", { getData: () => ({ type: "text", color: "1" }) });
			return nodes;
		}

		beforeEach(async () => {
			vi.useFakeTimers();
			zoomToFit = vi.fn();
			zoomToSelection = vi.fn();
			selectOnly = vi.fn();
			deselectAll = vi.fn();
			openLinkText = vi.fn();
			(sidebar as unknown as { app: unknown }).app = {
				workspace: {
					openLinkText,
					getLeavesOfType: () => [
						{
							view: {
								file: { path: canvasPath },
								canvas: { zoomToFit, zoomToSelection, selectOnly, deselectAll, nodes: makeCanvasNodes("5") },
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

		it("selects active step node and zooms after first sync", async () => {
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			expect(zoomToFit).toHaveBeenCalledOnce();
			expect(selectOnly).toHaveBeenCalledOnce();
			expect(zoomToSelection).toHaveBeenCalledOnce();
			const selectedNode = selectOnly.mock.calls[0][0];
			expect(selectedNode.getData().color).toBe("5");
			expect(selectedNode.getData().type).toBe("group");
		});

		it("zooms to selection on navigation without zoomToFit", async () => {
			// First sync — first open triggers zoomToFit
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			expect(zoomToFit).toHaveBeenCalledOnce();
			zoomToFit.mockClear();
			selectOnly.mockClear();
			zoomToSelection.mockClear();

			// Add steps for navigation
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			// Simulate service responding to add-step syncs
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			selectOnly.mockClear();
			zoomToSelection.mockClear();

			// Navigate prev — sets pendingZoomToStep flag
			byTestId(sidebar.contentEl, "jb-nav-prev")!.click();
			// Simulate service responding to nav sync
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);

			// Should NOT call zoomToFit, but SHOULD select + zoom
			expect(zoomToFit).not.toHaveBeenCalled();
			expect(selectOnly).toHaveBeenCalledOnce();
			expect(zoomToSelection).toHaveBeenCalledOnce();
		});

		it("zooms to selection when adding a step", async () => {
			// First open so canvasOpenedPath is set
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			selectOnly.mockClear();
			zoomToSelection.mockClear();
			zoomToFit.mockClear();

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			expect(zoomToFit).not.toHaveBeenCalled();
			expect(selectOnly).toHaveBeenCalled();
			expect(zoomToSelection).toHaveBeenCalled();
		});

		it("does not zoom on field change sync", async () => {
			// First open
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			zoomToFit.mockClear();
			selectOnly.mockClear();
			zoomToSelection.mockClear();

			// Simulate a field-change sync (no pendingZoomToStep)
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			expect(zoomToFit).not.toHaveBeenCalled();
			expect(selectOnly).not.toHaveBeenCalled();
			expect(zoomToSelection).not.toHaveBeenCalled();
		});

		it("skips zoom-to-selection when no active step node", async () => {
			// Replace canvas with no highlighted node
			(sidebar as unknown as { app: unknown }).app = {
				workspace: {
					openLinkText,
					getLeavesOfType: () => [
						{
							view: {
								file: { path: canvasPath },
								canvas: { zoomToFit, zoomToSelection, selectOnly, deselectAll, nodes: makeCanvasNodes() },
							},
						},
					],
				},
			};
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			expect(zoomToFit).toHaveBeenCalledOnce();
			expect(selectOnly).not.toHaveBeenCalled();
			expect(zoomToSelection).not.toHaveBeenCalled();
		});

		it("handles missing nodes map gracefully", async () => {
			(sidebar as unknown as { app: unknown }).app = {
				workspace: {
					openLinkText,
					getLeavesOfType: () => [
						{
							view: {
								file: { path: canvasPath },
								canvas: { zoomToFit },
							},
						},
					],
				},
			};
			await eventBus.emit("journey-builder.canvas.synced", { canvasPath });
			vi.advanceTimersByTime(400);
			// Should not throw
			expect(zoomToFit).toHaveBeenCalledOnce();
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
			expect(openLinkText).toHaveBeenCalledWith("03 - Resources/Journeys/My Journey/My Journey.canvas", "");
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

			vi.advanceTimersByTime(200);
			expect(handler).not.toHaveBeenCalled();
		});

		it("emits with correct canvasPath based on journey name", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			vi.advanceTimersByTime(1500);

			expect(handler.mock.calls[0][0].payload.canvasPath).toBe("03 - Resources/Journeys/My Journey/My Journey.canvas");
		});

		it("emits with correct definition matching sidebar state", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();

			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			// Trigger sync via step title change
			setInputValue(byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement, "First Step");
			vi.advanceTimersByTime(1500);

			const def = handler.mock.calls[0][0].payload.definition;
			expect(def.journey).toBe("My Journey");
			expect(def.steps).toHaveLength(1);
			expect(def.steps[0].title).toBe("First Step");
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

		it("navigation prev triggers canvas sync with short delay", () => {
			const handler = vi.fn();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			// Flush add-step syncs
			vi.advanceTimersByTime(1500);

			eventBus.on("journey-builder.canvas.sync-requested", handler);
			byTestId(sidebar.contentEl, "jb-nav-prev")!.click();

			// Not emitted immediately
			expect(handler).not.toHaveBeenCalled();
			// Emitted after short 300ms delay
			vi.advanceTimersByTime(300);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("navigation next triggers canvas sync with short delay", () => {
			const handler = vi.fn();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-prev")!.click();
			// Flush pending syncs
			vi.advanceTimersByTime(1500);

			eventBus.on("journey-builder.canvas.sync-requested", handler);
			byTestId(sidebar.contentEl, "jb-nav-next")!.click();

			expect(handler).not.toHaveBeenCalled();
			vi.advanceTimersByTime(300);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("sync payload includes activeStepIndex matching currentStepIndex", () => {
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			// Flush add syncs
			vi.advanceTimersByTime(1500);

			// Navigate to step 1 (index 1)
			byTestId(sidebar.contentEl, "jb-nav-prev")!.click();

			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);
			vi.advanceTimersByTime(300);

			const def = handler.mock.calls[0][0].payload.definition;
			expect(def.activeStepIndex).toBe(1);
		});
	});

	describe("canvas step selection", () => {
		beforeEach(async () => {
			vi.useFakeTimers();
			await sidebar.onOpen();
			byTestId(sidebar.contentEl, "jb-create-new")!.click();
			setInputValue(byTestId(sidebar.contentEl, "jb-name-input") as HTMLInputElement, "Test");
			byTestId(sidebar.contentEl, "jb-continue-btn")!.click();
			// Add 3 steps
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			byTestId(sidebar.contentEl, "jb-nav-add-step")!.click();
			vi.advanceTimersByTime(1500);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("navigates to selected step when onStepSelectedOnCanvas is called", () => {
			// Currently at step 2 (index 2, last added)
			expect(sidebar.getCurrentStepIndex()).toBe(2);

			// Simulate canvas selection of step 0
			(sidebar as unknown as { onStepSelectedOnCanvas: (i: number) => void }).onStepSelectedOnCanvas(0);

			expect(sidebar.getCurrentStepIndex()).toBe(0);
		});

		it("does not navigate when same step is selected", () => {
			expect(sidebar.getCurrentStepIndex()).toBe(2);
			const renderSpy = vi.spyOn(sidebar as unknown as { renderSteps: () => void }, "renderSteps");

			(sidebar as unknown as { onStepSelectedOnCanvas: (i: number) => void }).onStepSelectedOnCanvas(2);

			expect(renderSpy).not.toHaveBeenCalled();
		});

		it("ignores out-of-bounds step index", () => {
			expect(sidebar.getCurrentStepIndex()).toBe(2);

			(sidebar as unknown as { onStepSelectedOnCanvas: (i: number) => void }).onStepSelectedOnCanvas(5);
			expect(sidebar.getCurrentStepIndex()).toBe(2);

			(sidebar as unknown as { onStepSelectedOnCanvas: (i: number) => void }).onStepSelectedOnCanvas(-1);
			expect(sidebar.getCurrentStepIndex()).toBe(2);
		});

		it("triggers canvas sync after step selection to update colors", () => {
			vi.advanceTimersByTime(1500); // flush pending
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			(sidebar as unknown as { onStepSelectedOnCanvas: (i: number) => void }).onStepSelectedOnCanvas(0);
			vi.advanceTimersByTime(300);

			expect(handler).toHaveBeenCalledOnce();
			const def = handler.mock.calls[0][0].payload.definition;
			expect(def.activeStepIndex).toBe(0);
		});
	});

	describe("open existing journey", () => {
		const sampleJourney = JSON.stringify({
			journey: "My Loaded Journey",
			description: "A loaded description",
			startEvent: "app.opened",
			endEvent: "app.closed",
			tools: [],
			setup: [],
			steps: [
				{ id: "s1", title: "Open the hub", description: "Opens it", swimlane: "frontstage", guideSection: 1, events: ["app.opened"], actions: [{ tool: "command", command: "foo" }] },
				{ id: "s2", title: "Click button", description: "", swimlane: "backstage", guideSection: 2, events: ["app.opened"], actions: [] },
			],
			teardown: [],
		});

		beforeEach(async () => {
			await sidebar.onOpen();
		});

		it("hydrates metadata from JSON", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			const meta = sidebar.getMetadata();
			expect(meta.name).toBe("My Loaded Journey");
			expect(meta.description).toBe("A loaded description");
			expect(meta.startEvent).toBe("app.opened");
		});

		it("hydrates steps from JSON", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			const steps = sidebar.getSteps();
			expect(steps).toHaveLength(2);
			expect(steps[0].title).toBe("Open the hub");
			expect(steps[0].description).toBe("Opens it");
			expect(steps[0].swimlane).toBe("frontstage");
			expect(steps[0].actions).toHaveLength(1);
			expect(steps[1].title).toBe("Click button");
		});

		it("hydrates endEvent from JSON", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(sidebar.getEndEvent()).toBe("app.closed");
		});

		it("transitions to steps state", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(sidebar.getSidebarState()).toBe("steps");
		});

		it("recovers startEvent from steps[0].events[0] when top-level missing", () => {
			const legacy = JSON.stringify({
				journey: "Legacy",
				description: "",
				steps: [{ id: "s1", title: "Step", description: "", swimlane: "", events: ["legacy.start"], actions: [] }],
			});
			sidebar.loadJourneyFromJSON(legacy);
			expect(sidebar.getMetadata().startEvent).toBe("legacy.start");
		});

		it("handles missing fields gracefully", () => {
			sidebar.loadJourneyFromJSON(JSON.stringify({ journey: "Minimal" }));
			const meta = sidebar.getMetadata();
			expect(meta.name).toBe("Minimal");
			expect(meta.description).toBe("");
			expect(meta.startEvent).toBe("");
			expect(sidebar.getEndEvent()).toBe("");
			expect(sidebar.getSteps()).toHaveLength(0);
		});

		it("resets currentStepIndex to 0", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(sidebar.getCurrentStepIndex()).toBe(0);
		});

		it("renders step card with loaded title", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			const num = byTestId(sidebar.contentEl, "jb-step-num");
			expect(num!.textContent).toBe("1");
			const title = byTestId(sidebar.contentEl, "jb-step-title-input") as HTMLInputElement;
			expect(title.value).toBe("Open the hub");
		});

		it("renders nav counter with correct step count", () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			const counter = byTestId(sidebar.contentEl, "jb-nav-counter");
			expect(counter!.textContent).toContain("2");
		});

		it("schedules canvas sync after load", () => {
			vi.useFakeTimers();
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(handler).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1500);
			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.definition.journey).toBe("My Loaded Journey");

			vi.useRealTimers();
		});

		it("resets canvasOpenedPath for auto-open", async () => {
			// Load once to create the canvas sync controller
			sidebar.loadJourneyFromJSON(sampleJourney);
			const canvasSync = (sidebar as unknown as { canvasSync: { getCanvasOpenedPath: () => string | null; onSynced: (p: { canvasPath: string }) => void } }).canvasSync;

			// Simulate a previous canvas open on the controller
			canvasSync.onSynced({ canvasPath: "old.canvas" });
			expect(canvasSync.getCanvasOpenedPath()).toBe("old.canvas");

			// Load again — should reset canvasOpenedPath
			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(canvasSync.getCanvasOpenedPath()).toBeNull();
		});

		it("shows loading state before journey is hydrated", () => {
			// Trigger renderLoading directly (simulates the state after picker selection)
			(sidebar as unknown as { renderLoadingState: (msg: string) => void }).renderLoadingState("Loading journey\u2026");
			const loading = byTestId(sidebar.contentEl, "jb-loading");
			expect(loading).toBeTruthy();
			expect(loading!.textContent).toContain("Loading journey");
		});

		it("loading state is replaced by steps after hydration", () => {
			(sidebar as unknown as { renderLoadingState: (msg: string) => void }).renderLoadingState("Loading journey\u2026");
			expect(byTestId(sidebar.contentEl, "jb-loading")).toBeTruthy();

			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(byTestId(sidebar.contentEl, "jb-loading")).toBeNull();
			expect(sidebar.getSidebarState()).toBe("steps");
		});

		it("hydrates when journey-builder.imported event is received", async () => {
			await eventBus.emit("journey-builder.imported", { json: sampleJourney });
			expect(sidebar.getSidebarState()).toBe("steps");
			expect(sidebar.getMetadata().name).toBe("My Loaded Journey");
			expect(sidebar.getSteps()).toHaveLength(2);
		});

		it("unsubscribes imported listener on close", async () => {
			await sidebar.onClose();
			await eventBus.emit("journey-builder.imported", { json: sampleJourney });
			// State should remain welcome since listener was removed
			expect(sidebar.getSidebarState()).toBe("welcome");
		});

		it("returns to welcome on import-failed event", async () => {
			// Simulate loading state first
			sidebar.loadJourneyFromJSON(sampleJourney);
			expect(sidebar.getSidebarState()).toBe("steps");

			await eventBus.emit("journey-builder.import-failed", {
				path: "journeys/Bad.journey",
				errors: ["Missing journey name"],
			});
			expect(sidebar.getSidebarState()).toBe("welcome");
		});

		it("unsubscribes import-failed listener on close", async () => {
			sidebar.loadJourneyFromJSON(sampleJourney);
			await sidebar.onClose();
			await eventBus.emit("journey-builder.import-failed", {
				path: "journeys/Bad.journey",
				errors: ["test"],
			});
			// State should remain steps since listener was removed
			expect(sidebar.getSidebarState()).toBe("steps");
		});
	});

	describe("canvas reverse sync (canvas.changed merge)", () => {
		const sampleJourney = JSON.stringify({
			journey: "My Journey",
			description: "A test journey",
			startEvent: "app.opened",
			endEvent: "app.closed",
			steps: [
				{ id: "s1", title: "Open the hub", description: "Opens it", swimlane: "frontstage", guideSection: 1, events: [], actions: [{ tool: "command", command: "foo" }] },
				{ id: "s2", title: "Click button", description: "", swimlane: "backstage", guideSection: 2, events: [], actions: [{ tool: "click", selector: ".btn" }] },
			],
		});

		const canvasPath = "03 - Resources/Journeys/My Journey/My Journey.canvas";

		beforeEach(async () => {
			await sidebar.onOpen();
			sidebar.loadJourneyFromJSON(sampleJourney);
		});

		it("updates step titles and descriptions from canvas", async () => {
			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "app.opened",
				endEvent: "app.closed",
				activeStepIndex: undefined,
				steps: [
					{ title: "Renamed step", description: "New desc", actionCount: 1, canvasGroupId: "g1" },
					{ title: "Also renamed", description: "Another", actionCount: 1, canvasGroupId: "g2" },
				],
			});

			const steps = sidebar.getSteps();
			expect(steps[0].title).toBe("Renamed step");
			expect(steps[0].description).toBe("New desc");
			expect(steps[1].title).toBe("Also renamed");
			expect(steps[1].description).toBe("Another");
		});

		it("preserves existing actions during canvas merge", async () => {
			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "app.opened",
				endEvent: "app.closed",
				activeStepIndex: undefined,
				steps: [
					{ title: "Renamed", description: "", actionCount: 1, canvasGroupId: "g1" },
					{ title: "Also renamed", description: "", actionCount: 1, canvasGroupId: "g2" },
				],
			});

			const steps = sidebar.getSteps();
			expect(steps[0].actions).toEqual([{ tool: "command", command: "foo" }]);
			expect(steps[1].actions).toEqual([{ tool: "click", selector: ".btn" }]);
		});

		it("adds new steps from canvas with empty actions", async () => {
			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "app.opened",
				endEvent: "app.closed",
				activeStepIndex: undefined,
				steps: [
					{ title: "Open the hub", description: "Opens it", actionCount: 1, canvasGroupId: "g1" },
					{ title: "Click button", description: "", actionCount: 1, canvasGroupId: "g2" },
					{ title: "New step", description: "Added in canvas", actionCount: 0, canvasGroupId: "g3" },
				],
			});

			const steps = sidebar.getSteps();
			expect(steps).toHaveLength(3);
			expect(steps[2].title).toBe("New step");
			expect(steps[2].description).toBe("Added in canvas");
			expect(steps[2].actions).toEqual([]);
		});

		it("updates startEvent and endEvent from canvas", async () => {
			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "new.start.event",
				endEvent: "new.end.event",
				activeStepIndex: undefined,
				steps: [
					{ title: "Open the hub", description: "", actionCount: 0, canvasGroupId: "g1" },
					{ title: "Click button", description: "", actionCount: 0, canvasGroupId: "g2" },
				],
			});

			expect(sidebar.getMetadata().startEvent).toBe("new.start.event");
			expect(sidebar.getEndEvent()).toBe("new.end.event");
		});

		it("does not trigger scheduleCanvasSync during canvas-initiated update", async () => {
			vi.useFakeTimers();
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "app.opened",
				endEvent: "app.closed",
				activeStepIndex: undefined,
				steps: [
					{ title: "Renamed", description: "New", actionCount: 1, canvasGroupId: "g1" },
					{ title: "Also renamed", description: "", actionCount: 1, canvasGroupId: "g2" },
				],
			});

			// Advance past any debounce timers
			vi.advanceTimersByTime(5000);
			vi.useRealTimers();

			expect(handler).not.toHaveBeenCalled();
		});

		it("ignores canvas.changed when not in steps state", async () => {
			// Reset to welcome state
			await sidebar.onClose();
			await sidebar.onOpen();
			expect(sidebar.getSidebarState()).toBe("welcome");

			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "new.event",
				endEvent: "new.end",
				activeStepIndex: undefined,
				steps: [{ title: "Ghost step", description: "", actionCount: 0, canvasGroupId: "g1" }],
			});

			expect(sidebar.getSteps()).toHaveLength(0);
		});

		it("ignores canvas.changed for wrong canvas path", async () => {
			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath: "other/path.canvas",
				startEvent: "new.event",
				endEvent: "new.end",
				activeStepIndex: undefined,
				steps: [{ title: "Ghost step", description: "", actionCount: 0, canvasGroupId: "g1" }],
			});

			const steps = sidebar.getSteps();
			expect(steps[0].title).toBe("Open the hub");
		});

		it("unsubscribes canvas.changed on close", async () => {
			await sidebar.onClose();

			await eventBus.emit("journey-builder.canvas.changed", {
				canvasPath,
				startEvent: "new.event",
				endEvent: "new.end",
				activeStepIndex: undefined,
				steps: [{ title: "Ghost", description: "", actionCount: 0, canvasGroupId: "g1" }],
			});

			// Re-open to check state was not changed
			expect(sidebar.getSteps()[0].title).toBe("Open the hub");
		});
	});

	describe("dual input (file picker)", () => {
		it("findJourneyFiles includes both .journey and .canvas files", async () => {
			const dual = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getJourneyFolder: () => "03 - Resources/Journeys",
			});
			(dual as unknown as { app: { vault: { getFiles: () => { path: string }[] } } }).app.vault.getFiles = () => [
				{ path: "03 - Resources/Journeys/Test/Test.journey" },
				{ path: "03 - Resources/Journeys/Test/Test.canvas" },
				{ path: "03 - Resources/Journeys/Other/Other.journey" },
			];
			await dual.onOpen();
			// Welcome state should show "Open existing" (3 files found)
			expect(byTestId(dual.contentEl, "jb-open-existing")).toBeTruthy();
		});

		it("findJourneyFiles with folder scope only returns files in journey folder", async () => {
			const dual = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getJourneyFolder: () => "03 - Resources/Journeys",
			});
			(dual as unknown as { app: { vault: { getFiles: () => { path: string }[] } } }).app.vault.getFiles = () => [
				{ path: "03 - Resources/Journeys/Test/Test.journey" },
				{ path: "other/folder/Random.canvas" },
			];
			await dual.onOpen();
			// Only 1 file in journey folder — should show "Open existing"
			expect(byTestId(dual.contentEl, "jb-open-existing")).toBeTruthy();
		});

		it("shows Open existing when only canvas files are present", async () => {
			const dual = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getJourneyFolder: () => "03 - Resources/Journeys",
			});
			(dual as unknown as { app: { vault: { getFiles: () => { path: string }[] } } }).app.vault.getFiles = () => [
				{ path: "03 - Resources/Journeys/MyCanvas/MyCanvas.canvas" },
			];
			await dual.onOpen();
			expect(byTestId(dual.contentEl, "jb-open-existing")).toBeTruthy();
		});

		it("shows empty welcome when no journey or canvas files exist", async () => {
			const dual = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getJourneyFolder: () => "03 - Resources/Journeys",
			});
			(dual as unknown as { app: { vault: { getFiles: () => { path: string }[] } } }).app.vault.getFiles = () => [
				{ path: "03 - Resources/Journeys/readme.md" },
			];
			await dual.onOpen();
			expect(byTestId(dual.contentEl, "jb-empty-welcome")).toBeTruthy();
			expect(byTestId(dual.contentEl, "jb-open-existing")).toBeNull();
		});

		it("open from vault link shows notice when no files found", async () => {
			const dual = new JourneyBuilderSidebar(createMockLeaf(), {
				eventBus,
				getJourneyFolder: () => "03 - Resources/Journeys",
			});
			(dual as unknown as { app: { vault: { getFiles: () => { path: string }[] } } }).app.vault.getFiles = () => [];
			await dual.onOpen();

			const notices: string[] = [];
			eventBus.on("notice.show", (event) => {
				notices.push((event.payload as { message: string }).message);
			});

			// Trigger open — internally calls onOpenExisting() via import link
			const link = byTestId(dual.contentEl, "jb-import-link");
			if (link) link.click();

			expect(notices.some((m) => m.includes("No journey or canvas files found"))).toBe(true);
		});
	});

	describe("preview run", () => {
		const sampleJourney = JSON.stringify({
			journey: "My Journey",
			description: "A test journey",
			startEvent: "app.opened",
			endEvent: "app.closed",
			steps: [
				{ id: "s1", title: "Open the hub", description: "", swimlane: "", guideSection: 1, events: [], actions: [{ tool: "command", id: "flowti:open" }] },
				{ id: "s2", title: "Click button", description: "", swimlane: "", guideSection: 2, events: [], actions: [{ tool: "click", selector: ".btn" }] },
			],
		});

		beforeEach(async () => {
			await sidebar.onOpen();
			sidebar.loadJourneyFromJSON(sampleJourney);
		});

		it("renders preview button when steps exist", () => {
			const btn = sidebar.contentEl.querySelector('[data-test-id="jb-preview-btn"]');
			expect(btn).toBeTruthy();
		});

		it("does not render preview button when no steps", async () => {
			sidebar.loadJourneyFromJSON(JSON.stringify({
				journey: "Empty",
				steps: [],
			}));
			const btn = sidebar.contentEl.querySelector('[data-test-id="jb-preview-btn"]');
			expect(btn).toBeNull();
		});

		it("emits preview.started and preview.completed during run", async () => {
			const started = vi.fn();
			const completed = vi.fn();
			eventBus.on("journey-builder.preview.started", started);
			eventBus.on("journey-builder.preview.completed", completed);

			const btn = sidebar.contentEl.querySelector('[data-test-id="jb-preview-btn"]') as HTMLElement;
			btn.click();

			// Wait for async preview run to complete (300ms per step × 2 steps + buffer)
			await new Promise((r) => setTimeout(r, 1000));

			expect(started).toHaveBeenCalledOnce();
			expect(started.mock.calls[0][0].payload).toEqual({ stepCount: 2 });
			expect(completed).toHaveBeenCalledOnce();
			expect(completed.mock.calls[0][0].payload).toMatchObject({
				totalSteps: 2,
				passed: 2,
				failed: 0,
			});
		});
	});

	describe("background image round-trip", () => {
		beforeEach(async () => {
			await sidebar.onOpen();
		});

		it("buildDefinition includes backgroundImage field", () => {
			const json = JSON.stringify({
				journey: "BG Test",
				startEvent: "start",
				endEvent: "end",
				steps: [{ id: "s1", title: "Step 1", description: "", swimlane: "", actions: [], backgroundImage: "assets/mockup.png" }],
			});
			sidebar.loadJourneyFromJSON(json);
			const def = sidebar.buildDefinition();
			expect(def.steps[0].backgroundImage).toBe("assets/mockup.png");
		});

		it("loadJourneyFromJSON restores backgroundImage from JSON", () => {
			const json = JSON.stringify({
				journey: "BG Test",
				startEvent: "start",
				endEvent: "end",
				steps: [{ id: "s1", title: "Step 1", description: "", swimlane: "", actions: [], backgroundImage: "img/wireframe.svg" }],
			});
			sidebar.loadJourneyFromJSON(json);
			const steps = sidebar.getSteps();
			expect(steps[0].backgroundImage).toBe("img/wireframe.svg");
		});
	});
});
