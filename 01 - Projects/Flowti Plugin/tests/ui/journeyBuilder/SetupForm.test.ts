// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { SetupForm } from "../../../src/ui/journeyBuilder/SetupForm";
import type { SetupFormDeps } from "../../../src/ui/journeyBuilder/SetupForm";
import type { JourneyMetadata } from "../../../src/ui/journeyBuilder/JourneyBuilderSidebar";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	el.value = value;
	el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SetupForm", () => {
	let container: HTMLDivElement;
	let metadata: JourneyMetadata;
	let deps: SetupFormDeps;

	beforeEach(() => {
		container = document.createElement("div");
		metadata = { name: "", description: "", startEvent: "", endEvent: "" };
		deps = {
			metadata,
			onFieldChanged: vi.fn(),
			onContinue: vi.fn(),
		};
	});

	it("renders setup form container", () => {
		new SetupForm(container, deps).render();
		expect(byTestId(container, "jb-setup-form")).toBeTruthy();
	});

	it("renders name input", () => {
		new SetupForm(container, deps).render();
		const input = byTestId(container, "jb-name-input") as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.tagName.toLowerCase()).toBe("input");
	});

	it("renders description textarea", () => {
		new SetupForm(container, deps).render();
		const input = byTestId(container, "jb-description-input") as HTMLTextAreaElement;
		expect(input).toBeTruthy();
		expect(input.tagName.toLowerCase()).toBe("textarea");
	});

	it("renders start event input", () => {
		new SetupForm(container, deps).render();
		const input = byTestId(container, "jb-start-event-input") as HTMLInputElement;
		expect(input).toBeTruthy();
	});

	it("renders end event input", () => {
		new SetupForm(container, deps).render();
		const input = byTestId(container, "jb-end-event-input") as HTMLInputElement;
		expect(input).toBeTruthy();
	});

	it("renders continue button", () => {
		new SetupForm(container, deps).render();
		expect(byTestId(container, "jb-continue-btn")).toBeTruthy();
	});

	it("populates inputs from metadata", () => {
		metadata.name = "My journey";
		metadata.description = "Test desc";
		metadata.startEvent = "session.started";
		metadata.endEvent = "app.closed";
		new SetupForm(container, deps).render();
		expect((byTestId(container, "jb-name-input") as HTMLInputElement).value).toBe("My journey");
		expect((byTestId(container, "jb-description-input") as HTMLTextAreaElement).value).toBe("Test desc");
		expect((byTestId(container, "jb-start-event-input") as HTMLInputElement).value).toBe("session.started");
		expect((byTestId(container, "jb-end-event-input") as HTMLInputElement).value).toBe("app.closed");
	});

	it("calls onFieldChanged when name changes", () => {
		new SetupForm(container, deps).render();
		setInputValue(byTestId(container, "jb-name-input") as HTMLInputElement, "New name");
		expect(deps.onFieldChanged).toHaveBeenCalledWith("name", "New name");
	});

	it("updates metadata.name on input", () => {
		new SetupForm(container, deps).render();
		setInputValue(byTestId(container, "jb-name-input") as HTMLInputElement, "Updated");
		expect(metadata.name).toBe("Updated");
	});

	it("calls onFieldChanged when description changes", () => {
		new SetupForm(container, deps).render();
		setInputValue(byTestId(container, "jb-description-input") as HTMLTextAreaElement, "New desc");
		expect(deps.onFieldChanged).toHaveBeenCalledWith("description", "New desc");
	});

	it("calls onFieldChanged when start event changes", () => {
		new SetupForm(container, deps).render();
		setInputValue(byTestId(container, "jb-start-event-input") as HTMLInputElement, "hub.loaded");
		expect(deps.onFieldChanged).toHaveBeenCalledWith("startEvent", "hub.loaded");
	});

	it("calls onFieldChanged when end event changes", () => {
		new SetupForm(container, deps).render();
		setInputValue(byTestId(container, "jb-end-event-input") as HTMLInputElement, "app.closed");
		expect(deps.onFieldChanged).toHaveBeenCalledWith("endEvent", "app.closed");
	});

	it("updates metadata.endEvent on input", () => {
		new SetupForm(container, deps).render();
		setInputValue(byTestId(container, "jb-end-event-input") as HTMLInputElement, "session.ended");
		expect(metadata.endEvent).toBe("session.ended");
	});

	it("calls onContinue on continue button click", () => {
		new SetupForm(container, deps).render();
		byTestId(container, "jb-continue-btn")!.click();
		expect(deps.onContinue).toHaveBeenCalledOnce();
	});

	it("destroy cleans up without error", () => {
		const form = new SetupForm(container, deps);
		form.render();
		expect(() => form.destroy()).not.toThrow();
	});

	it("destroy is idempotent", () => {
		const form = new SetupForm(container, deps);
		form.render();
		form.destroy();
		expect(() => form.destroy()).not.toThrow();
	});
});
