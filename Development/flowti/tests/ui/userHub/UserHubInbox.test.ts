// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubInbox } from "../../../src/ui/userHub/UserHubInbox";
import { formatSourceEvent, formatTime, type UserHubState, type UserHubComponentDeps, type InboxItem } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { UUID } from "../../../src/utils/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

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
		inboxEnabledSources: [],
		sessions: [],
		activeSession: null,
		selectedSession: null,
		settings: { ...DEFAULT_SETTINGS },
		selectedPreferencesCategory: null,
	};
}

function makeDeps(state: UserHubState): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus: {} as IEventBus,
		app: {} as never,
		inboxService: {
			markRead: vi.fn(async () => {}),
			markAllRead: vi.fn(async () => {}),
			dismiss: vi.fn(async () => {}),
			clearAll: vi.fn(async () => {}),
			getItems: vi.fn(() => []),
			getUnreadCount: vi.fn(() => 0),
		} as never,
		sessionService: {
			getSessions: vi.fn(() => []),
			getActiveSession: vi.fn(() => null),
		} as never,
		userService: {
			load: vi.fn(async () => {}),
			hasUser: vi.fn(() => false),
			getUser: vi.fn(() => null),
			createUser: vi.fn(async (name: string) => ({ id: "user_1" as UUID, name, createdAt: new Date().toISOString() })),
			updateUserName: vi.fn(async () => {}),
		},
		scheduleRender: vi.fn(),
		navigateToEvent: vi.fn(),
		openNewSessionModal: vi.fn(),
		openSaveTemplateModal: vi.fn(),
		openFile: vi.fn(),
		openSessionWorkspace: vi.fn(),
		exportTemplateAsFile: vi.fn(),
		importTemplateFromFile: vi.fn(),
		getSettings: () => state.settings,
	};
}

describe("formatSourceEvent", () => {
	it("should return human-readable labels for known events", () => {
		expect(formatSourceEvent("subscription.matched")).toBe("Watcher");
		expect(formatSourceEvent("dataExchange.import.completed")).toBe("Import");
		expect(formatSourceEvent("dataExchange.import.failed")).toBe("Import Error");
		expect(formatSourceEvent("dataExchange.export.completed")).toBe("Export");
	});

	it("should return human-readable labels for pipeline events", () => {
		expect(formatSourceEvent("dataExchange.pipeline.completed")).toBe("Pipeline");
		expect(formatSourceEvent("dataExchange.pipeline.failed")).toBe("Pipeline Error");
	});

	it("should return human-readable label for capture events", () => {
		expect(formatSourceEvent("capture.note.created")).toBe("Quick Capture");
	});

	it("should return raw event name for unknown events", () => {
		expect(formatSourceEvent("custom.event")).toBe("custom.event");
	});

	it("should return human-readable labels for signal sync events", () => {
		expect(formatSourceEvent("signal.sync.completed")).toBe("Signal Sync");
		expect(formatSourceEvent("signal.sync.failed")).toBe("Signal Sync Error");
	});
});

describe("formatTime", () => {
	it("should show only time for today's items", () => {
		const now = new Date();
		const result = formatTime(now.toISOString());
		// Should NOT contain a month abbreviation — just time
		expect(result).toMatch(/\d{1,2}:\d{2}/);
		// The result should be short (time only, no date prefix)
		expect(result.length).toBeLessThanOrEqual(8);
	});

	it("should show date and time for items from previous days", () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const result = formatTime(yesterday.toISOString());
		// Should be longer than time-only (includes date prefix)
		expect(result.length).toBeGreaterThan(8);
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
			expect(row.classList.contains("ft-inbox-row-unread")).toBe(true);
		});

		it("should not bold read items", () => {
			state.inboxItems = [makeItem({ read: true })];
			inbox.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			expect(row.classList.contains("ft-inbox-row-unread")).toBe(false);
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

		it("should show 'Mark all read' button when unread items exist", () => {
			state.inboxItems = [
				makeItem({ id: "1", read: false }),
				makeItem({ id: "2", read: false }),
			];
			inbox.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const markAllBtn = buttons.find((b) => b.textContent?.includes("Mark all read"));
			expect(markAllBtn).toBeTruthy();
		});

		it("should hide 'Mark all read' button when all items are read", () => {
			state.inboxItems = [
				makeItem({ id: "1", read: true }),
				makeItem({ id: "2", read: true }),
			];
			inbox.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const markAllBtn = buttons.find((b) => b.textContent?.includes("Mark all read"));
			expect(markAllBtn).toBeUndefined();
		});

		it("should call markAllRead when 'Mark all read' button is clicked", () => {
			state.inboxItems = [makeItem({ read: false })];
			inbox.renderMaster("");

			const buttons = Array.from(masterEl.querySelectorAll("button"));
			const markAllBtn = buttons.find((b) => b.textContent?.includes("Mark all read"));
			expect(markAllBtn).toBeTruthy();
			markAllBtn!.click();

			expect(deps.inboxService.markAllRead).toHaveBeenCalledOnce();
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
			expect((rows[0] as HTMLElement).classList.contains("ft-session-row-selected")).toBe(true);
			expect((rows[1] as HTMLElement).classList.contains("ft-catalog-row-active")).toBe(false);
		});

		it("should omit description section when empty", () => {
			state.selectedInboxItem = makeItem({ description: "" });

			inbox.renderDetail();

			const paragraphs = detailEl.querySelectorAll("p");
			expect(paragraphs).toHaveLength(0);
		});

		it("should render clickable file link when item has filePath", () => {
			state.selectedInboxItem = makeItem({
				filePath: "inbox/My Idea.md",
			});

			inbox.renderDetail();

			const links = detailEl.querySelectorAll(".ft-nav-link");
			const fileLink = Array.from(links).find((el) =>
				el.textContent === "inbox/My Idea.md",
			) as HTMLElement;
			expect(fileLink).toBeTruthy();
			fileLink.click();

			expect(deps.openFile).toHaveBeenCalledWith("inbox/My Idea.md");
		});

		it("should not render file link when item has no filePath", () => {
			state.selectedInboxItem = makeItem();

			inbox.renderDetail();

			// Only the source event nav-link should exist, not a file link
			const links = detailEl.querySelectorAll(".ft-nav-link");
			expect(links).toHaveLength(1);
			expect(links[0].textContent).toContain(state.selectedInboxItem!.sourceEvent);
		});
	});
});
