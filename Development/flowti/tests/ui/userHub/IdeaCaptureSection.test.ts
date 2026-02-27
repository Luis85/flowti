// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IdeaCaptureSection, type IdeaCaptureDeps } from "../../../src/ui/userHub/IdeaCaptureSection";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { InboxItem } from "../../../src/domain/inbox/types";

function makeInboxService(items: InboxItem[] = []) {
	return {
		getItems: vi.fn(() => items),
		getUnreadCount: vi.fn(() => 0),
	} as never;
}

function makeDeps(overrides?: Partial<IdeaCaptureDeps>): IdeaCaptureDeps {
	return {
		eventBus: { emit: vi.fn(async () => {}) } as unknown as IEventBus,
		inboxService: makeInboxService(),
		onCapture: vi.fn(),
		...overrides,
	};
}

function makeIdeaItem(title: string): InboxItem {
	return {
		id: `idea-${title}`,
		type: "info",
		title,
		description: "",
		sourceEvent: "capture.idea.created",
		sourceHub: "capture",
		timestamp: new Date().toISOString(),
		read: false,
	};
}

describe("IdeaCaptureSection", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("should render input and submit button", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		expect(container.querySelector("input")).not.toBeNull();
		expect(container.querySelector("button")).not.toBeNull();
		expect(container.textContent).toContain("Capture an idea");
	});

	it("should call onCapture with title when submit clicked", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		const input = container.querySelector("input")!;
		input.value = "My great idea";

		const btn = container.querySelector("button")!;
		btn.click();

		expect(deps.onCapture).toHaveBeenCalledWith("My great idea");
	});

	it("should clear input after submission", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		const input = container.querySelector("input")!;
		input.value = "My idea";

		container.querySelector("button")!.click();

		expect(input.value).toBe("");
	});

	it("should not submit when input is empty", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		container.querySelector("button")!.click();

		expect(deps.onCapture).not.toHaveBeenCalled();
	});

	it("should not submit when input is whitespace only", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		const input = container.querySelector("input")!;
		input.value = "   ";

		container.querySelector("button")!.click();

		expect(deps.onCapture).not.toHaveBeenCalled();
	});

	it("should submit on Enter key", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		const input = container.querySelector("input")!;
		input.value = "Enter idea";

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

		expect(deps.onCapture).toHaveBeenCalledWith("Enter idea");
	});

	it("should show recent ideas when inbox has idea items", () => {
		const items = [
			makeIdeaItem("First idea"),
			makeIdeaItem("Second idea"),
		];
		const deps = makeDeps({ inboxService: makeInboxService(items) });
		new IdeaCaptureSection(container, deps).render();

		expect(container.textContent).toContain("Recent ideas");
		expect(container.textContent).toContain("First idea");
		expect(container.textContent).toContain("Second idea");
	});

	it("should show at most 5 recent ideas", () => {
		const items = Array.from({ length: 8 }, (_, i) => makeIdeaItem(`Idea ${i}`));
		const deps = makeDeps({ inboxService: makeInboxService(items) });
		new IdeaCaptureSection(container, deps).render();

		const ideaItems = container.querySelectorAll(".ft-idea-capture-item");
		expect(ideaItems.length).toBe(5);
	});

	it("should not show recent ideas section when no idea items exist", () => {
		const deps = makeDeps();
		new IdeaCaptureSection(container, deps).render();

		expect(container.textContent).not.toContain("Recent ideas");
	});

	// ── renderCompact ──────────────────────────────────────

	describe("renderCompact", () => {
		it("should render inline input and button without header", () => {
			const deps = makeDeps();
			new IdeaCaptureSection(container, deps).renderCompact();

			expect(container.querySelector(".ft-idea-capture-compact")).not.toBeNull();
			expect(container.querySelector("input")).not.toBeNull();
			expect(container.querySelector("button")).not.toBeNull();
			// No header text
			expect(container.textContent).not.toContain("Capture an idea");
		});

		it("should call onCapture when compact submit is clicked", () => {
			const deps = makeDeps();
			new IdeaCaptureSection(container, deps).renderCompact();

			const input = container.querySelector("input")!;
			input.value = "Quick idea";

			container.querySelector("button")!.click();

			expect(deps.onCapture).toHaveBeenCalledWith("Quick idea");
			expect(input.value).toBe("");
		});

		it("should not show recent ideas in compact mode", () => {
			const items = [makeIdeaItem("Recent one")];
			const deps = makeDeps({ inboxService: makeInboxService(items) });
			new IdeaCaptureSection(container, deps).renderCompact();

			expect(container.textContent).not.toContain("Recent ideas");
			expect(container.textContent).not.toContain("Recent one");
		});
	});

	it("should only show ideas, not other inbox items", () => {
		const items: InboxItem[] = [
			makeIdeaItem("My idea"),
			{
				id: "non-idea",
				type: "info",
				title: "Import completed",
				description: "",
				sourceEvent: "dataExchange.import.completed",
				sourceHub: "data-exchange",
				timestamp: new Date().toISOString(),
				read: false,
			},
		];
		const deps = makeDeps({ inboxService: makeInboxService(items) });
		new IdeaCaptureSection(container, deps).render();

		const ideaItems = container.querySelectorAll(".ft-idea-capture-item");
		expect(ideaItems.length).toBe(1);
		expect(container.textContent).toContain("My idea");
		expect(container.textContent).not.toContain("Import completed");
	});
});
