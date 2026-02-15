// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { UserHubActivity } from "../../../src/ui/userHub/UserHubActivity";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { HubRegistry } from "../../../src/domain/hub/HubRegistry";

// ── Helpers ──────────────────────────────────────────────────

function makeState(): UserHubState {
	return {
		inboxItems: [],
		activityLog: [],
		selectedInboxItem: null,
		selectedActivity: null,
	};
}

function makeDeps(eventBus: IEventBus, state: UserHubState): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus,
		hubRegistry: {} as HubRegistry,
		scheduleRender: vi.fn(),
	};
}

describe("UserHubActivity", () => {
	let eventBus: IEventBus;
	let state: UserHubState;
	let deps: UserHubComponentDeps;
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;
	let activity: UserHubActivity;

	beforeEach(() => {
		eventBus = new EventBus();
		state = makeState();
		deps = makeDeps(eventBus, state);
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		activity = new UserHubActivity(masterEl, detailEl, deps);
	});

	// ── Event capture ───────────────────────────────────────

	describe("startCapture", () => {
		it("should capture non-internal events via wildcard listener", async () => {
			const unsub = activity.startCapture();

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(state.activityLog).toHaveLength(1);
			expect(state.activityLog[0].type).toBe("file.created");
			unsub();
		});

		it("should skip internal events (log.*, ui.*, settings.*, etc.)", async () => {
			const unsub = activity.startCapture();

			await eventBus.emit("log.entry", { level: "info", message: "test", context: "test", timestamp: new Date().toISOString() });
			await eventBus.emit("ui.openEventCatalog", {});
			await eventBus.emit("settings.loaded", { settings: {} as never });

			expect(state.activityLog).toHaveLength(0);
			unsub();
		});

		it("should prepend new entries (newest first)", async () => {
			const unsub = activity.startCapture();

			await eventBus.emit("file.created", { path: "a.md", source: "user" });
			await eventBus.emit("file.created", { path: "b.md", source: "user" });

			expect(state.activityLog[0].type).toBe("file.created");
			// Second event is at index 0 (newest first)
			expect(state.activityLog).toHaveLength(2);
			unsub();
		});

		it("should cap activity log at 200 entries", async () => {
			const unsub = activity.startCapture();

			// Pre-fill with 199 entries
			state.activityLog = Array.from({ length: 199 }, (_, i) => ({
				type: `test.event.${i}`,
				category: "Test",
				description: "",
				payload: {},
				timestamp: new Date().toISOString(),
			}));

			// Emit 5 more — should stay capped at 200
			for (let i = 0; i < 5; i++) {
				await eventBus.emit("file.created", { path: `file${i}.md`, source: "user" });
			}

			expect(state.activityLog.length).toBeLessThanOrEqual(200);
			unsub();
		});

		it("should call scheduleRender on each captured event", async () => {
			const unsub = activity.startCapture();

			await eventBus.emit("file.created", { path: "a.md", source: "user" });

			expect(deps.scheduleRender).toHaveBeenCalledOnce();
			unsub();
		});

		it("should return an unsubscribe function that stops capture", async () => {
			const unsub = activity.startCapture();
			unsub();

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(state.activityLog).toHaveLength(0);
		});

		it("should populate category from catalog", async () => {
			const unsub = activity.startCapture();

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			// file.created is in the catalog under "File Notifications"
			expect(state.activityLog[0].category).toBe("File Notifications");
			unsub();
		});
	});

	// ── renderMaster ────────────────────────────────────────

	describe("renderMaster", () => {
		it("should render empty state when no activity", () => {
			activity.renderMaster("");

			expect(masterEl.textContent).toContain("No activity yet");
		});

		it("should render activity rows", () => {
			state.activityLog = [
				{ type: "file.created", category: "Lifecycle", description: "", payload: {}, timestamp: new Date().toISOString() },
				{ type: "file.modified", category: "Lifecycle", description: "", payload: {}, timestamp: new Date().toISOString() },
			];

			activity.renderMaster("");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(2);
		});

		it("should filter by event type", () => {
			state.activityLog = [
				{ type: "file.created", category: "Lifecycle", description: "", payload: {}, timestamp: new Date().toISOString() },
				{ type: "subscription.created", category: "Subscription", description: "", payload: {}, timestamp: new Date().toISOString() },
			];

			activity.renderMaster("subscription");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(1);
		});

		it("should filter by category", () => {
			state.activityLog = [
				{ type: "file.created", category: "Lifecycle", description: "", payload: {}, timestamp: new Date().toISOString() },
				{ type: "subscription.created", category: "Subscription", description: "", payload: {}, timestamp: new Date().toISOString() },
			];

			activity.renderMaster("lifecycle");

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(1);
		});

		it("should mark selected entry as active", () => {
			const entry = { type: "file.created", category: "Lifecycle", description: "", payload: {}, timestamp: new Date().toISOString() };
			state.activityLog = [entry];
			state.selectedActivity = entry;

			activity.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row")!;
			expect(row.classList.contains("ft-catalog-row-active")).toBe(true);
		});

		it("should set selectedActivity and scheduleRender on row click", () => {
			const entry = { type: "file.created", category: "Lifecycle", description: "", payload: {}, timestamp: new Date().toISOString() };
			state.activityLog = [entry];

			activity.renderMaster("");

			const row = masterEl.querySelector(".ft-catalog-row") as HTMLElement;
			row.click();

			expect(state.selectedActivity).toBe(entry);
			expect(deps.scheduleRender).toHaveBeenCalled();
		});
	});

	// ── renderDetail ────────────────────────────────────────

	describe("renderDetail", () => {
		it("should render placeholder when no entry is selected", () => {
			activity.renderDetail();

			expect(detailEl.textContent).toContain("Select an event to view details");
		});

		it("should render selected entry details", () => {
			state.selectedActivity = {
				type: "file.created",
				category: "Lifecycle",
				description: "A file was created",
				payload: { path: "test.md" },
				timestamp: new Date().toISOString(),
			};

			activity.renderDetail();

			expect(detailEl.textContent).toContain("file.created");
			expect(detailEl.textContent).toContain("Lifecycle");
			expect(detailEl.textContent).toContain("A file was created");
		});

		it("should render payload as JSON", () => {
			state.selectedActivity = {
				type: "file.created",
				category: "Lifecycle",
				description: "",
				payload: { path: "test.md" },
				timestamp: new Date().toISOString(),
			};

			activity.renderDetail();

			const pre = detailEl.querySelector("pre");
			expect(pre).not.toBeNull();
			expect(pre!.textContent).toContain("test.md");
		});
	});
});
