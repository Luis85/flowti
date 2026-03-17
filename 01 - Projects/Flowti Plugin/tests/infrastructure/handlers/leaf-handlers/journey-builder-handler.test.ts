// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

import { registerJourneyBuilderHandler } from "../../../../src/infrastructure/handlers/leaf-handlers/journey-builder-handler";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import type { TabContext } from "../../../../src/infrastructure/handlers/plugin-handler-registry";

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createTabContext(eventBus: IEventBus): TabContext {
	return {
		tabId: "journey-builder",
		viewId: "test",
		eventBus,
	};
}

describe("registerJourneyBuilderHandler", () => {
	let registry: PluginHandlerRegistry;
	let eventBus: IEventBus;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		eventBus = createMockEventBus();
		registerJourneyBuilderHandler(registry, {
			eventBus,
			app: {},
		});
	});

	it("registers the leaf:journey-builder tab handler", () => {
		expect(registry.getTabHandler("leaf:journey-builder")).toBeDefined();
	});

	describe("initial render (welcome screen)", () => {
		it("renders the sidebar header with title", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			const title = container.querySelector('[data-test-id="jb-header-title"]');
			expect(title).not.toBeNull();
			expect(title!.textContent).toBe("Journey builder");
		});

		it("renders the welcome screen with create-new card", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// WelcomeScreen renders with hasExistingJourneys: false → empty welcome
			const createBtn = container.querySelector('[data-test-id="jb-create-new"]');
			expect(createBtn).not.toBeNull();
		});

		it("adds the ft-jb-sidebar class to the container", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			expect(container.classList.contains("ft-jb-sidebar")).toBe(true);
		});

		it("subscribes to eventBus events on render", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// Should subscribe to canvas.synced, imported, import-failed, canvas.changed
			expect(eventBus.on).toHaveBeenCalledWith("journey-builder.canvas.synced", expect.any(Function));
			expect(eventBus.on).toHaveBeenCalledWith("journey-builder.imported", expect.any(Function));
			expect(eventBus.on).toHaveBeenCalledWith("journey-builder.import-failed", expect.any(Function));
			expect(eventBus.on).toHaveBeenCalledWith("journey-builder.canvas.changed", expect.any(Function));
		});
	});

	describe("state transitions", () => {
		it("transitions to setup when create-new is clicked", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// Click the create-new button to trigger onCreateNew
			const createBtn = container.querySelector<HTMLElement>('[data-test-id="jb-create-new"]');
			expect(createBtn).not.toBeNull();
			createBtn!.click();

			// Verify we emitted the create-new event
			expect(eventBus.emit).toHaveBeenCalledWith("journey-builder.create-new", {});

			// Verify setup form is now rendered
			const setupForm = container.querySelector('[data-test-id="jb-setup-form"]');
			expect(setupForm).not.toBeNull();
		});

		it("renders setup form with name, description, and event inputs", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// Click create-new to go to setup
			const createBtn = container.querySelector<HTMLElement>('[data-test-id="jb-create-new"]');
			createBtn!.click();

			const nameInput = container.querySelector<HTMLInputElement>('[data-test-id="jb-name-input"]');
			expect(nameInput).not.toBeNull();

			const descInput = container.querySelector<HTMLTextAreaElement>('[data-test-id="jb-description-input"]');
			expect(descInput).not.toBeNull();

			const startInput = container.querySelector<HTMLInputElement>('[data-test-id="jb-start-event-input"]');
			expect(startInput).not.toBeNull();

			const endInput = container.querySelector<HTMLInputElement>('[data-test-id="jb-end-event-input"]');
			expect(endInput).not.toBeNull();
		});

		it("transitions to steps when continue is clicked from setup", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// Go to setup
			const createBtn = container.querySelector<HTMLElement>('[data-test-id="jb-create-new"]');
			createBtn!.click();

			// Click the continue button
			const continueBtn = container.querySelector<HTMLElement>('[data-test-id="jb-continue-btn"]');
			expect(continueBtn).not.toBeNull();
			continueBtn!.click();

			// Verify steps view is rendered (NavBar should be present)
			const navCounter = container.querySelector('[data-test-id="jb-nav-counter"]');
			expect(navCounter).not.toBeNull();
			expect(navCounter!.textContent).toBe("No steps yet");
		});

		it("renders back button in setup that returns to welcome", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// Go to setup
			const createBtn = container.querySelector<HTMLElement>('[data-test-id="jb-create-new"]');
			createBtn!.click();

			// Click back
			const backBtn = container.querySelector<HTMLElement>('[data-test-id="jb-back-btn"]');
			expect(backBtn).not.toBeNull();
			backBtn!.click();

			// Should be back at welcome
			const createNewAgain = container.querySelector('[data-test-id="jb-create-new"]');
			expect(createNewAgain).not.toBeNull();
		});

		it("renders back button in steps that returns to setup", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));

			// Go to setup → steps
			container.querySelector<HTMLElement>('[data-test-id="jb-create-new"]')!.click();
			container.querySelector<HTMLElement>('[data-test-id="jb-continue-btn"]')!.click();

			// Verify we are in steps
			expect(container.querySelector('[data-test-id="jb-nav-counter"]')).not.toBeNull();

			// Click back
			container.querySelector<HTMLElement>('[data-test-id="jb-back-btn"]')!.click();

			// Should be back at setup
			expect(container.querySelector('[data-test-id="jb-setup-form"]')).not.toBeNull();
		});
	});

	describe("steps view", () => {
		function goToSteps(container: HTMLElement): void {
			container.querySelector<HTMLElement>('[data-test-id="jb-create-new"]')!.click();
			container.querySelector<HTMLElement>('[data-test-id="jb-continue-btn"]')!.click();
		}

		it("shows empty state when no steps exist", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));
			goToSteps(container);

			const empty = container.querySelector('[data-test-id="jb-empty-steps"]');
			expect(empty).not.toBeNull();
			expect(empty!.textContent).toContain("No steps yet");
		});

		it("renders add-step button in NavBar", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));
			goToSteps(container);

			const addStep = container.querySelector('[data-test-id="jb-nav-add-step"]');
			expect(addStep).not.toBeNull();
		});

		it("adds a step when add-step is clicked", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));
			goToSteps(container);

			// Click add step
			container.querySelector<HTMLElement>('[data-test-id="jb-nav-add-step"]')!.click();

			// NavBar counter should update
			const counter = container.querySelector('[data-test-id="jb-nav-counter"]');
			expect(counter).not.toBeNull();
			expect(counter!.textContent).toBe("Step 1 of 1");

			// Emits step.added event
			expect(eventBus.emit).toHaveBeenCalledWith(
				"journey-builder.step.added",
				expect.objectContaining({ title: "" }),
			);
		});

		it("renders header toolbar with export and hub buttons", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));
			goToSteps(container);

			const toolbar = container.querySelector('[data-test-id="jb-header-toolbar"]');
			expect(toolbar).not.toBeNull();

			const exportBtn = container.querySelector('[data-test-id="jb-export-btn"]');
			expect(exportBtn).not.toBeNull();

			const hubBtn = container.querySelector('[data-test-id="jb-view-hub-btn"]');
			expect(hubBtn).not.toBeNull();
		});

		it("renders JSON panel container", () => {
			const container = document.createElement("div");
			registry.getTabHandler("leaf:journey-builder")!(container, createTabContext(eventBus));
			goToSteps(container);

			const jsonContainer = container.querySelector(".ft-jb-json-container");
			expect(jsonContainer).not.toBeNull();
		});
	});
});
