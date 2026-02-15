// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubInbox } from "../../../src/ui/userHub/UserHubInbox";
import type { UserHubState, UserHubComponentDeps, InboxItem } from "../../../src/ui/userHub/types";
import type { HubRegistry } from "../../../src/domain/hub/HubRegistry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Helpers ──────────────────────────────────────────────────

function makeItem(overrides?: Partial<InboxItem>): InboxItem {
	return {
		id: "item-1",
		type: "info",
		title: "Test Item",
		description: "A test inbox item",
		sourceHub: "event-catalog",
		timestamp: new Date().toISOString(),
		read: false,
		...overrides,
	};
}

function makeState(): UserHubState {
	return {
		inboxItems: [],
		activityLog: [],
		selectedInboxItem: null,
		selectedActivity: null,
	};
}

function makeDeps(state: UserHubState): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus: {} as IEventBus,
		hubRegistry: {} as HubRegistry,
		scheduleRender: vi.fn(),
	};
}

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

		it("should omit description section when empty", () => {
			state.selectedInboxItem = makeItem({ description: "" });

			inbox.renderDetail();

			const paragraphs = detailEl.querySelectorAll("p");
			expect(paragraphs).toHaveLength(0);
		});
	});
});
