// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubInbox } from "../../../src/ui/userHub/UserHubInbox";
import { formatSourceEvent, type UserHubState, type UserHubComponentDeps, type InboxItem } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Helpers ──────────────────────────────────────────────────

function makeItem(overrides?: Partial<InboxItem>): InboxItem {
	return {
		id: "item-1",
		type: "info",
		title: "Test Item",
		description: "A test inbox item",
		sourceEvent: "test.event",
		sourceHub: "event-catalog",
		timestamp: new Date().toISOString(),
		read: false,
		...overrides,
	};
}

function makeState(): UserHubState {
	return {
		inboxItems: [],
		selectedInboxItem: null,
	};
}

function makeDeps(state: UserHubState): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus: {} as IEventBus,
		inboxService: {
			markRead: vi.fn(async () => {}),
			dismiss: vi.fn(async () => {}),
			clearAll: vi.fn(async () => {}),
			getItems: vi.fn(() => []),
			getUnreadCount: vi.fn(() => 0),
		} as never,
		scheduleRender: vi.fn(),
		navigateToEvent: vi.fn(),
	};
}

describe("formatSourceEvent", () => {
	it("should return human-readable labels for known events", () => {
		expect(formatSourceEvent("subscription.matched")).toBe("Watcher");
		expect(formatSourceEvent("dataExchange.import.completed")).toBe("Import");
		expect(formatSourceEvent("dataExchange.import.failed")).toBe("Import Error");
		expect(formatSourceEvent("dataExchange.export.completed")).toBe("Export");
	});

	it("should return raw event name for unknown events", () => {
		expect(formatSourceEvent("custom.event")).toBe("custom.event");
	});
});

describe("UserHubInbox", () => {
	let state: UserHubState;
	let deps: UserHubComponentDeps;
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;
	let inbox: UserHubInbox;

	beforeEach(() => {
		state = makeState();
		deps = makeDeps(state);
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		inbox = new UserHubInbox(masterEl, detailEl, deps);
	});

	// ── renderMaster ────────────────────────────────────────

	describe("renderMaster", () => {
		it("should render empty state when no items", () => {
			inbox.renderMaster("");

			expect(masterEl.textContent).toContain("No items in your inbox");
		});

		it("should render inbox items", () => {
			state.inboxItems = [
				makeItem({ id: "1", title: "First" }),
				makeItem({ id: "2", title: "Second" }),
			];

			inbox.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(2);
		});

		it("should filter items by title", () => {
			state.inboxItems = [
				makeItem({ id: "1", title: "Import Complete" }),
				makeItem({ id: "2", title: "Export Failed" }),
			];

			inbox.renderMaster("import");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(1);
			expect(masterEl.textContent).toContain("Import Complete");
		});

		it("should bold unread items", () => {
			state.inboxItems = [makeItem({ read: false })];
			inbox.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			expect(row.style.fontWeight).toBe("600");
		});

		it("should not bold read items", () => {
			state.inboxItems = [makeItem({ read: true })];
			inbox.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			expect(row.style.fontWeight).not.toBe("600");
		});

		it("should set selectedInboxItem and scheduleRender on click", () => {
			const item = makeItem();
			state.inboxItems = [item];

			inbox.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			row.click();

			expect(state.selectedInboxItem).toBe(item);
			expect(deps.scheduleRender).toHaveBeenCalled();
		});

		it("should show source event badge on rows", () => {
			state.inboxItems = [makeItem({
				sourceEvent: "dataExchange.export.completed",
			})];

			inbox.renderMaster("");

			const badges = masterEl.querySelectorAll(".ft-badge");
			const badgeTexts = Array.from(badges).map((b) => b.textContent);
			expect(badgeTexts).toContain("Export");
		});

		it("should show empty state when filter matches nothing", () => {
			state.inboxItems = [makeItem({ title: "Hello" })];

			inbox.renderMaster("zzz-no-match");

			expect(masterEl.textContent).toContain("No items in your inbox");
		});
	});

	// ── renderDetail ────────────────────────────────────────

	describe("renderDetail", () => {
		it("should render placeholder when no item is selected", () => {
			inbox.renderDetail();

			expect(detailEl.textContent).toContain("Select an item to view details");
		});

		it("should render selected item details", () => {
			state.selectedInboxItem = makeItem({
				title: "Import Finished",
				description: "10 files imported",
				type: "info",
			});

			inbox.renderDetail();

			expect(detailEl.textContent).toContain("Import Finished");
			expect(detailEl.textContent).toContain("10 files imported");
			expect(detailEl.textContent).toContain("Information");
		});

		it("should show 'Action Required' badge for action items", () => {
			state.selectedInboxItem = makeItem({ type: "action" });

			inbox.renderDetail();

			expect(detailEl.textContent).toContain("Action Required");
		});

		it("should show source event badge and trigger line", () => {
			state.selectedInboxItem = makeItem({
				sourceEvent: "dataExchange.import.completed",
			});

			inbox.renderDetail();

			expect(detailEl.textContent).toContain("Import");
			expect(detailEl.textContent).toContain("Triggered by:");
			expect(detailEl.textContent).toContain("dataExchange.import.completed");
		});

		it("should navigate to event catalog when source event is clicked", () => {
			state.selectedInboxItem = makeItem({
				sourceEvent: "dataExchange.import.completed",
			});

			inbox.renderDetail();

			const eventLink = detailEl.querySelector(".ft-nav-link") as HTMLElement;
			expect(eventLink).toBeTruthy();
			expect(eventLink.textContent).toBe("dataExchange.import.completed");
			eventLink.click();

			expect(deps.navigateToEvent).toHaveBeenCalledWith("dataExchange.import.completed");
		});

		it("should call dismiss when dismiss button is clicked", () => {
			state.selectedInboxItem = makeItem({ id: "item-42" });

			inbox.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			const dismissBtn = buttons.find((b) => b.textContent?.includes("Dismiss"));
			expect(dismissBtn).toBeTruthy();
			dismissBtn!.click();

			expect(deps.inboxService.dismiss).toHaveBeenCalledWith("item-42");
		});

		it("should show 'Mark read' button only for unread items", () => {
			state.selectedInboxItem = makeItem({ read: false });
			inbox.renderDetail();

			const buttons = Array.from(detailEl.querySelectorAll("button"));
			expect(buttons.some((b) => b.textContent?.includes("Mark read"))).toBe(true);

			// Re-render with read item
			state.selectedInboxItem = makeItem({ read: true });
			inbox.renderDetail();

			const readButtons = Array.from(detailEl.querySelectorAll("button"));
			expect(readButtons.some((b) => b.textContent?.includes("Mark read"))).toBe(false);
		});

		it("should highlight selected item with active background", () => {
			const item = makeItem({ id: "selected-item" });
			state.inboxItems = [
				item,
				makeItem({ id: "other-item", title: "Other" }),
			];
			state.selectedInboxItem = item;

			inbox.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect((rows[0] as HTMLElement).classList.contains("ft-catalog-row-active")).toBe(true);
			expect((rows[0] as HTMLElement).style.backgroundColor).toBe("var(--background-modifier-hover)");
			expect((rows[1] as HTMLElement).classList.contains("ft-catalog-row-active")).toBe(false);
		});

		it("should omit description section when empty", () => {
			state.selectedInboxItem = makeItem({ description: "" });

			inbox.renderDetail();

			const paragraphs = detailEl.querySelectorAll("p");
			expect(paragraphs).toHaveLength(0);
		});
	});
});
