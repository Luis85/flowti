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

		it("renders the sidebar container class on contentEl", () => {
			const el = sidebar.contentEl;
			expect(el.classList.contains("ft-jb-sidebar")).toBe(true);
		});

		it("renders the header with title", () => {
			const header = sidebar.contentEl.querySelector(".ft-jb-header-title");
			expect(header).toBeTruthy();
			expect(header!.textContent).toBe("Journey Builder");
		});

		it("renders Open Existing button", () => {
			const btn = sidebar.contentEl.querySelector(".ft-jb-open-existing-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
			expect(btn!.getAttribute("tabindex")).toBe("0");
		});

		it("renders Create New button", () => {
			const btn = sidebar.contentEl.querySelector(".ft-jb-create-new-btn");
			expect(btn).toBeTruthy();
			expect(btn!.getAttribute("role")).toBe("button");
			expect(btn!.getAttribute("tabindex")).toBe("0");
		});

		it("renders Open Existing card with title and description", () => {
			const card = sidebar.contentEl.querySelector(".ft-jb-open-existing-btn");
			const title = card!.querySelector(".ft-jb-card-title");
			const desc = card!.querySelector(".ft-jb-card-desc");
			expect(title!.textContent).toBe("Open Existing Journey");
			expect(desc!.textContent).toContain("Load and edit");
		});

		it("renders Create New card with title and description", () => {
			const card = sidebar.contentEl.querySelector(".ft-jb-create-new-btn");
			const title = card!.querySelector(".ft-jb-card-title");
			const desc = card!.querySelector(".ft-jb-card-desc");
			expect(title!.textContent).toBe("Create New Journey");
			expect(desc!.textContent).toContain("Design a new");
		});

		it("emits journey-builder.open-existing on Open Existing click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.open-existing", handler);
			const btn = sidebar.contentEl.querySelector(".ft-jb-open-existing-btn") as HTMLElement;
			btn.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("emits journey-builder.create-new on Create New click", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.create-new", handler);
			const btn = sidebar.contentEl.querySelector(".ft-jb-create-new-btn") as HTMLElement;
			btn.click();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation with Enter", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.create-new", handler);
			const btn = sidebar.contentEl.querySelector(".ft-jb-create-new-btn") as HTMLElement;
			btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(handler).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation with Space", () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.open-existing", handler);
			const btn = sidebar.contentEl.querySelector(".ft-jb-open-existing-btn") as HTMLElement;
			btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
			expect(handler).toHaveBeenCalledOnce();
		});
	});

	describe("cleanup", () => {
		it("onClose completes without error", async () => {
			await sidebar.onOpen();
			await expect(sidebar.onClose()).resolves.toBeUndefined();
		});
	});
});
