// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { UserHubDashboard, type UserHubDashboardDeps } from "../../../src/ui/userHub/UserHubDashboard";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";
import type { HubDashboardProvider } from "../../../src/domain/hub/types";
import type { IUserService } from "../../../src/domain/user/types";
import type { InboxItem } from "../../../src/domain/inbox/types";
import type { InboxService } from "../../../src/domain/inbox/InboxService";
import type { SessionService } from "../../../src/domain/session/SessionService";
import type { Session } from "../../../src/domain/session/types";

// ── Helpers ──────────────────────────────────────────────────

function makeProvider(overrides?: Partial<HubDashboardProvider>): HubDashboardProvider {
	return {
		getHubId: () => "test-hub",
		getViewType: () => "test-hub-view",
		getDisplayName: () => "Test Hub",
		getIcon: () => "list",
		getSummary: () => ({
			stats: [
				{ label: "Items", value: "5", icon: "list", tabId: "items" },
			],
			healthLevel: "healthy" as const,
			actionItemCount: 0,
		}),
		...overrides,
	};
}

function makeHubRegistry(providers: HubDashboardProvider[]) {
	return {
		getAll: () => providers,
		openHub: vi.fn().mockResolvedValue(undefined),
	};
}

function makeUserService(name?: string): IUserService {
	return {
		getUser: () => name ? { name } : null,
	} as IUserService;
}

function makeInboxService(items: InboxItem[] = [], unreadCount = 0): InboxService {
	return {
		getItems: vi.fn(() => items),
		getUnreadCount: vi.fn(() => unreadCount),
		markRead: vi.fn(async () => {}),
		dismiss: vi.fn(async () => {}),
		clearAll: vi.fn(async () => {}),
	} as never;
}

function makeSessionService(activeSession: Session | null = null): SessionService {
	return {
		getSessions: vi.fn(() => []),
		getActiveSession: vi.fn(() => activeSession),
	} as never;
}

function makeActiveSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Active Sprint",
		status: "active",
		durationMinutes: 25,
		createdAt: new Date("2026-02-16T10:00:00").toISOString(),
		startedAt: new Date("2026-02-16T10:00:00").toISOString(),
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: null,
		timeline: [],
		goals: [],
		links: [],
		notesFile: null,
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
		...overrides,
	};
}

function makeItem(overrides?: Partial<InboxItem>): InboxItem {
	return {
		id: "item-1",
		type: "info",
		title: "Test item",
		description: "Some description",
		sourceEvent: "dataExchange.export.completed",
		sourceHub: "data-exchange",
		timestamp: new Date("2026-02-15T10:23:00").toISOString(),
		read: false,
		...overrides,
	};
}

function makeDeps(overrides?: Partial<UserHubDashboardDeps>): UserHubDashboardDeps {
	return {
		userService: makeUserService("Alice"),
		hubRegistry: makeHubRegistry([]) as never,
		eventBus: new EventBus(),
		inboxService: makeInboxService(),
		sessionService: makeSessionService(),
		navigateToTab: vi.fn(),
		onInboxItemClick: vi.fn(),
		openSessionWorkspace: vi.fn(),
		getSettings: () => ({ ...DEFAULT_SETTINGS }),
		...overrides,
	};
}

describe("UserHubDashboard", () => {
	let eventBus: IEventBus;
	let container: HTMLDivElement;

	beforeEach(() => {
		eventBus = new EventBus();
		container = document.createElement("div");
	});

	// ── Welcome section ─────────────────────────────────────

	describe("welcome section", () => {
		it("should greet the user by name", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				userService: makeUserService("Alice"),
				eventBus,
			}));

			dashboard.render();

			expect(container.textContent).toContain("Welcome, Alice");
		});

		it("should show generic greeting when no user", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				userService: makeUserService(),
				eventBus,
			}));

			dashboard.render();

			expect(container.textContent).toContain("Welcome to Flowti");
		});
	});

	// ── Inbox section ───────────────────────────────────────

	describe("inbox section", () => {
		it("should always render inbox section even when empty", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService([], 0),
			}));

			dashboard.render();

			expect(container.textContent).toContain("Inbox");
			expect(container.querySelector(".ft-inbox-section")).toBeTruthy();
		});

		it("should show empty state message when no items", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService([], 0),
			}));

			dashboard.render();

			expect(container.textContent).toContain("No inbox items");
		});

		it("should render inbox items when items exist", () => {
			const items = [
				makeItem({ id: "1", title: "Import completed: 10 rows" }),
				makeItem({ id: "2", title: "Watcher matched: My Watcher" }),
			];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 1),
			}));

			dashboard.render();

			expect(container.textContent).toContain("Inbox");
			expect(container.textContent).toContain("Import completed: 10 rows");
			expect(container.textContent).toContain("Watcher matched: My Watcher");
		});

		it("should show unread count badge when unread > 0", () => {
			const items = [makeItem()];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 3),
			}));

			dashboard.render();

			// Unread badge shows just the count number
			const badges = container.querySelectorAll(".ft-badge");
			const unreadBadge = Array.from(badges).find((b) => b.textContent === "3");
			expect(unreadBadge).toBeTruthy();
		});

		it("should not show unread badge when unread count is 0", () => {
			const items = [makeItem({ read: true })];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
			}));

			dashboard.render();

			expect(container.textContent).not.toContain("unread");
		});

		it("should show source event text on rows", () => {
			const items = [
				makeItem({ sourceEvent: "dataExchange.import.completed" }),
				makeItem({ id: "item-2", sourceEvent: "subscription.matched" }),
			];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
			}));

			dashboard.render();

			const sources = container.querySelectorAll(".ft-dashboard-inbox-cell-source");
			const sourceTexts = Array.from(sources).map((s) => s.textContent);
			expect(sourceTexts).toContain("Import");
			expect(sourceTexts).toContain("Watcher");
		});

		it("should bold unread items", () => {
			const items = [
				makeItem({ id: "1", read: false, title: "Unread item" }),
				makeItem({ id: "2", read: true, title: "Read item" }),
			];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 1),
			}));

			dashboard.render();

			const rows = container.querySelectorAll(".ft-dashboard-inbox-row");
			expect(rows).toHaveLength(2);
			expect((rows[0] as HTMLElement).classList.contains("ft-dashboard-inbox-unread")).toBe(true);
			expect((rows[1] as HTMLElement).classList.contains("ft-dashboard-inbox-unread")).toBe(false);
		});

		it("should show accent border on unread items", () => {
			const items = [
				makeItem({ id: "1", read: false }),
				makeItem({ id: "2", read: true }),
			];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 1),
			}));

			dashboard.render();

			const rows = container.querySelectorAll(".ft-dashboard-inbox-row");
			expect((rows[0] as HTMLElement).classList.contains("ft-dashboard-inbox-unread")).toBe(true);
			expect((rows[1] as HTMLElement).classList.contains("ft-dashboard-inbox-unread")).toBe(false);
		});

		it("should show at most 5 items", () => {
			const items = Array.from({ length: 7 }, (_, i) =>
				makeItem({ id: `item-${i}`, title: `Item ${i}` }),
			);
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
			}));

			dashboard.render();

			const rows = container.querySelectorAll(".ft-dashboard-inbox-row");
			expect(rows).toHaveLength(5);
		});

		it("should show 'View all' link when more than 5 items", () => {
			const items = Array.from({ length: 8 }, (_, i) =>
				makeItem({ id: `item-${i}`, title: `Item ${i}` }),
			);
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
			}));

			dashboard.render();

			expect(container.textContent).toContain("View all (8)");
		});

		it("should not show 'View all' link when 5 or fewer items", () => {
			const items = Array.from({ length: 3 }, (_, i) =>
				makeItem({ id: `item-${i}`, title: `Item ${i}` }),
			);
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
			}));

			dashboard.render();

			expect(container.textContent).not.toContain("View all");
		});

		it("should call onInboxItemClick with the item when row is clicked", () => {
			const onInboxItemClick = vi.fn();
			const item = makeItem();
			const items = [item];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 1),
				onInboxItemClick,
			}));

			dashboard.render();

			const row = container.querySelector(".ft-dashboard-inbox-row") as HTMLElement;
			row.click();

			expect(onInboxItemClick).toHaveBeenCalledWith(item);
		});

		it("should navigate to inbox tab when 'View all' is clicked", () => {
			const navigateToTab = vi.fn();
			const items = Array.from({ length: 8 }, (_, i) =>
				makeItem({ id: `item-${i}`, title: `Item ${i}` }),
			);
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
				navigateToTab,
			}));

			dashboard.render();

			// The "View all" link is a span with ft-nav-link inside the inbox section
			const navLinks = Array.from(container.querySelectorAll(".ft-nav-link"));
			const viewAllLink = navLinks.find((el) => el.textContent?.includes("View all")) as HTMLElement | undefined;
			expect(viewAllLink).toBeDefined();
			viewAllLink!.click();

			expect(navigateToTab).toHaveBeenCalledWith("inbox");
		});

		it("should call clearAll when clear button is clicked", () => {
			const inboxService = makeInboxService([makeItem()], 0);
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService,
			}));

			dashboard.render();

			const clearBtn = container.querySelector(".ft-inbox-section button") as HTMLElement;
			expect(clearBtn).toBeTruthy();
			clearBtn.click();

			expect(inboxService.clearAll).toHaveBeenCalled();
		});
	});

	// ── Hub summaries ───────────────────────────────────────

	describe("hub summaries", () => {
		it("should render hub rows with inline stats", () => {
			const providers = [
				makeProvider({
					getHubId: () => "hub-a",
					getDisplayName: () => "Hub A",
					getSummary: () => ({
						stats: [
							{ label: "Events", value: "42", icon: "list", tabId: "events" },
							{ label: "Domains", value: "3", icon: "boxes", tabId: "domains" },
						],
						healthLevel: "healthy",
						actionItemCount: 0,
					}),
				}),
			];

			const settings = { ...DEFAULT_SETTINGS, userHubConfig: { ...DEFAULT_SETTINGS.userHubConfig, visibleHubs: ["hub-a"] } };
			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
				getSettings: () => settings,
			}));

			dashboard.render();

			const rows = container.querySelectorAll(".ft-dashboard-hub-row");
			expect(rows).toHaveLength(1);
			expect(container.textContent).toContain("Hub A");
			expect(container.textContent).toContain("42");
			expect(container.textContent).toContain("Events");
			expect(container.textContent).toContain("3");
			expect(container.textContent).toContain("Domains");
		});

		it("should filter out the user-hub provider", () => {
			const providers = [
				makeProvider({ getHubId: () => "user-hub", getDisplayName: () => "User Hub" }),
				makeProvider({ getHubId: () => "event-catalog", getDisplayName: () => "Event Catalog" }),
			];

			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
			}));

			dashboard.render();

			const rows = container.querySelectorAll(".ft-dashboard-hub-row");
			const rowTexts = Array.from(rows).map((r) => r.textContent);
			expect(rowTexts.some((t) => t?.includes("User Hub"))).toBe(false);
			expect(rowTexts.some((t) => t?.includes("Event Catalog"))).toBe(true);
		});

		it("should not render hub summaries section when no other providers", () => {
			const providers = [
				makeProvider({ getHubId: () => "user-hub" }),
			];

			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
			}));

			dashboard.render();

			expect(container.querySelectorAll(".ft-dashboard-hub-row")).toHaveLength(0);
		});

		it("should call openHub when hub row is clicked", () => {
			const hubRegistry = makeHubRegistry([
				makeProvider({
					getHubId: () => "event-catalog",
					getDisplayName: () => "Event Catalog",
				}),
			]);

			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: hubRegistry as never,
				eventBus,
			}));

			dashboard.render();

			const rows = container.querySelectorAll(".ft-dashboard-hub-row");
			expect(rows.length).toBeGreaterThanOrEqual(1);
			(rows[0] as HTMLElement).click();

			expect(hubRegistry.openHub).toHaveBeenCalledWith("event-catalog");
		});
	});

	// ── Quick actions ───────────────────────────────────────

	describe("quick actions", () => {
		it("should render tab and action buttons in separate groups", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus }));

			dashboard.render();

			// Tabs: sessions, inbox, commands, preferences
			const tabs = container.querySelectorAll(".ft-toolbar-tabs .ft-quick-action-btn");
			expect(tabs).toHaveLength(4);
			// Actions: activity-log, watchers (no new-session without onCreateSession)
			const actions = container.querySelectorAll(".ft-toolbar-actions .ft-quick-action-btn");
			expect(actions).toHaveLength(2);
		});

		it("should render hub buttons from registry filtered by toolbarHubs", () => {
			const providers = [makeProvider({ getHubId: () => "event-catalog", getDisplayName: () => "Event Catalog", getIcon: () => "list" })];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry(providers) as never,
			}));

			dashboard.render();

			const hubBtns = container.querySelectorAll(".ft-toolbar-hub-btn");
			expect(hubBtns).toHaveLength(1);
			expect((hubBtns[0] as HTMLElement).title).toBe("Event Catalog");
		});

		it("should hide hub buttons not in toolbarHubs", () => {
			const providers = [makeProvider({ getHubId: () => "event-catalog", getDisplayName: () => "Event Catalog", getIcon: () => "list" })];
			const settings = { ...DEFAULT_SETTINGS, userHubConfig: { ...DEFAULT_SETTINGS.userHubConfig, toolbarHubs: [] } };
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry(providers) as never,
				getSettings: () => settings,
			}));

			dashboard.render();

			const hubBtns = container.querySelectorAll(".ft-toolbar-hub-btn");
			expect(hubBtns).toHaveLength(0);
		});

		it("should navigate to sessions tab on Sessions click", () => {
			const navigateToTab = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, navigateToTab }));

			dashboard.render();

			const btn = Array.from(container.querySelectorAll(".ft-quick-action-btn"))
				.find((el) => (el as HTMLElement).title === "Sessions") as HTMLElement;
			expect(btn).toBeDefined();
			btn.click();

			expect(navigateToTab).toHaveBeenCalledWith("sessions");
		});

		it("should navigate to inbox tab on Inbox click", () => {
			const navigateToTab = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, navigateToTab }));

			dashboard.render();

			const btn = Array.from(container.querySelectorAll(".ft-quick-action-btn"))
				.find((el) => (el as HTMLElement).title === "Inbox") as HTMLElement;
			expect(btn).toBeDefined();
			btn.click();

			expect(navigateToTab).toHaveBeenCalledWith("inbox");
		});

		it("should navigate to preferences tab on Preferences click", () => {
			const navigateToTab = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, navigateToTab }));

			dashboard.render();

			const btn = Array.from(container.querySelectorAll(".ft-quick-action-btn"))
				.find((el) => (el as HTMLElement).title === "Preferences") as HTMLElement;
			expect(btn).toBeDefined();
			btn.click();

			expect(navigateToTab).toHaveBeenCalledWith("preferences");
		});

		it("should open hub when hub button is clicked", async () => {
			const hubRegistry = makeHubRegistry([
				makeProvider({ getHubId: () => "event-catalog", getDisplayName: () => "Event Catalog", getIcon: () => "list" }),
			]);
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: hubRegistry as never,
			}));

			dashboard.render();

			const hubBtn = container.querySelector(".ft-toolbar-hub-btn") as HTMLElement;
			expect(hubBtn).toBeTruthy();
			hubBtn.click();

			await new Promise((r) => setTimeout(r, 10));
			expect(hubRegistry.openHub).toHaveBeenCalledWith("event-catalog");
		});

		it("should show New Session button when onCreateSession is provided", () => {
			const onCreateSession = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, onCreateSession }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-toolbar-actions .ft-quick-action-btn");
			expect(actions).toHaveLength(3);
			const titles = Array.from(actions).map((a) => (a as HTMLElement).title);
			expect(titles).toContain("New session");
		});

		it("should call onCreateSession when New Session button is clicked", () => {
			const onCreateSession = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, onCreateSession }));

			dashboard.render();

			const btn = Array.from(container.querySelectorAll(".ft-quick-action-btn"))
				.find((el) => (el as HTMLElement).title === "New session") as HTMLElement;
			expect(btn).toBeDefined();
			btn.click();

			expect(onCreateSession).toHaveBeenCalled();
		});

		it("should not show New Session button when onCreateSession is absent", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-toolbar-actions .ft-quick-action-btn");
			expect(actions).toHaveLength(2);
			const titles = Array.from(actions).map((a) => (a as HTMLElement).title);
			expect(titles.every((t) => t !== "New session")).toBe(true);
		});

		it("should hide tabs and actions when showQuickActions is false", () => {
			const settings = { ...DEFAULT_SETTINGS, userHubConfig: { ...DEFAULT_SETTINGS.userHubConfig, showQuickActions: false } };
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				getSettings: () => settings,
			}));

			dashboard.render();

			// Hub buttons should still be there, but no tabs or actions
			expect(container.querySelector(".ft-toolbar-tabs")).toBeNull();
			expect(container.querySelector(".ft-toolbar-actions")).toBeNull();
		});

		it("should only show configured toolbar actions", () => {
			const settings = {
				...DEFAULT_SETTINGS,
				userHubConfig: { ...DEFAULT_SETTINGS.userHubConfig, toolbarActions: ["sessions", "inbox"] },
			};
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				getSettings: () => settings,
			}));

			dashboard.render();

			// sessions and inbox are tabs
			const tabs = container.querySelectorAll(".ft-toolbar-tabs .ft-quick-action-btn");
			expect(tabs).toHaveLength(2);
			const titles = Array.from(tabs).map((a) => (a as HTMLElement).title);
			expect(titles).toContain("Sessions");
			expect(titles).toContain("Inbox");
			// No actions should be shown (none configured)
			expect(container.querySelector(".ft-toolbar-actions")).toBeNull();
		});
	});

	// ── Active session card ────────────────────────────────

	describe("active session card", () => {
		it("should render active session card when session is active", () => {
			const session = makeActiveSession();
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-active-session")).toBeTruthy();
			expect(container.textContent).toContain("Active Sprint");
			expect(container.textContent).toContain("Event Storming");
		});

		it("should not render active session card when no active session", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-active-session")).toBeNull();
		});

		it("should emit session.pause when Pause is clicked", async () => {
			const spy = vi.fn();
			eventBus.on("session.pause", spy);

			const session = makeActiveSession({ id: "s1" });
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const buttons = container.querySelectorAll(".ft-active-session button");
			const pauseBtn = Array.from(buttons).find((b) => b.textContent?.includes("Pause"));
			expect(pauseBtn).toBeTruthy();
			(pauseBtn as HTMLElement).click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s1" },
			}));
		});

		it("should emit session.complete when Complete is clicked", async () => {
			const spy = vi.fn();
			eventBus.on("session.complete", spy);

			const session = makeActiveSession({ id: "s2" });
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const buttons = container.querySelectorAll(".ft-active-session button");
			const completeBtn = Array.from(buttons).find((b) => b.textContent?.includes("Complete"));
			expect(completeBtn).toBeTruthy();
			(completeBtn as HTMLElement).click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s2" },
			}));
		});

		it("should open workspace when active session card is clicked", () => {
			const session = makeActiveSession({ id: "s5" });
			const deps = makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			});
			const dashboard = new UserHubDashboard(container, deps);

			dashboard.render();

			const card = container.querySelector(".ft-active-session") as HTMLElement;
			card.click();

			expect(deps.openSessionWorkspace).toHaveBeenCalledWith("s5");
		});

		it("should show Resume button instead of Pause when session is paused", () => {
			const session = makeActiveSession({
				id: "s3",
				status: "paused",
				startedAt: null,
				pausedAt: new Date().toISOString(),
				elapsedBeforePauseMs: 60_000,
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const buttons = container.querySelectorAll(".ft-active-session button");
			const labels = Array.from(buttons).map((b) => b.textContent?.trim());
			expect(labels).toContain("Resume");
			expect(labels).toContain("Complete");
			expect(labels).not.toContain("Pause");
		});

		it("should emit session.resume when Resume is clicked on paused session", async () => {
			const spy = vi.fn();
			eventBus.on("session.resume", spy);

			const session = makeActiveSession({
				id: "s4",
				status: "paused",
				startedAt: null,
				pausedAt: new Date().toISOString(),
				elapsedBeforePauseMs: 60_000,
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const buttons = container.querySelectorAll(".ft-active-session button");
			const resumeBtn = Array.from(buttons).find((b) => b.textContent?.includes("Resume"));
			expect(resumeBtn).toBeTruthy();
			(resumeBtn as HTMLElement).click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({
				payload: { sessionId: "s4" },
			}));
		});

		it("should show Paused badge when session is paused", () => {
			const session = makeActiveSession({
				status: "paused",
				startedAt: null,
				pausedAt: new Date().toISOString(),
				elapsedBeforePauseMs: 60_000,
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const badges = container.querySelectorAll(".ft-active-session .ft-badge");
			const badgeTexts = Array.from(badges).map((b) => b.textContent);
			expect(badgeTexts).toContain("Paused");
		});

		it("should update timer display without full re-render", () => {
			const session = makeActiveSession();
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const timerEl = container.querySelector(".ft-dashboard-session-timer");
			expect(timerEl).toBeTruthy();

			dashboard.updateTimerDisplay(5 * 60 * 1000);

			expect(timerEl!.textContent).toBe("05:00");
		});

		it("should be a no-op for updateTimerDisplay when no active session", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null),
			}));

			dashboard.render();

			// Should not throw
			dashboard.updateTimerDisplay(1000);
		});

		it("should show goal progress badge when session has goals", () => {
			const session = makeActiveSession({
				goals: [
					{ id: "g1", text: "Goal 1", completed: true, completedAt: "2026-02-18T10:00:00Z" },
					{ id: "g2", text: "Goal 2", completed: false, completedAt: null },
					{ id: "g3", text: "Goal 3", completed: true, completedAt: "2026-02-18T10:00:00Z" },
				],
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			expect(container.textContent).toContain("2/3 goals");
		});

		it("should not show goal badge when no goals", () => {
			const session = makeActiveSession({ goals: [] });
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			expect(container.textContent).not.toContain("goals");
		});

		it("should show focus file badge when active session has focusFile", () => {
			const session = makeActiveSession({ focusFile: "docs/features/Hubs PRD.md" });
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const badges = container.querySelectorAll(".ft-active-session .ft-badge");
			const badgeTexts = Array.from(badges).map((b) => b.textContent?.trim());
			const hasFocusBadge = badgeTexts.some((t) => t?.includes("Hubs PRD.md"));
			expect(hasFocusBadge).toBe(true);
		});

		it("should not show focus file badge when focusFile is null", () => {
			const session = makeActiveSession({ focusFile: null });
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(session),
			}));

			dashboard.render();

			const badges = container.querySelectorAll(".ft-active-session .ft-badge");
			// Only type badge should exist (Event Storming), no focus file badge
			expect(badges).toHaveLength(1);
		});
	});

	// ── Next nudge indicator ────────────────────────────────

	describe("next nudge indicator", () => {
		function makeNudgeService(configs: Array<{ id: string; time: string; title: string; sessionType: string; enabled: boolean; durationMinutes: number }>, dismissedIds: string[] = []) {
			return {
				getConfigs: vi.fn(() => configs),
				isDismissedToday: vi.fn((id: string) => dismissedIds.includes(id)),
			} as never;
		}

		it("should show next upcoming nudge when enabled configs exist", () => {
			// Mock Date to a fixed time (10:00)
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-02-18T10:00:00"));
			try {
				const nudgeService = makeNudgeService([
					{ id: "n1", time: "14:00", title: "Afternoon Focus", sessionType: "documentation", enabled: true, durationMinutes: 50 },
				]);

				const dashboard = new UserHubDashboard(container, makeDeps({
					eventBus,
					nudgeService,
				}));

				dashboard.render();

				expect(container.querySelector(".ft-next-nudge")).toBeTruthy();
				expect(container.textContent).toContain("Afternoon Focus");
				expect(container.textContent).toContain("14:00");
			} finally {
				vi.useRealTimers();
			}
		});

		it("should not show nudge indicator when no enabled configs", () => {
			const nudgeService = makeNudgeService([
				{ id: "n1", time: "14:00", title: "Afternoon Focus", sessionType: "documentation", enabled: false, durationMinutes: 50 },
			]);

			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				nudgeService,
			}));

			dashboard.render();

			expect(container.querySelector(".ft-next-nudge")).toBeNull();
		});

		it("should not show nudge indicator when all nudges are dismissed", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-02-18T08:00:00"));
			try {
				const nudgeService = makeNudgeService(
					[{ id: "n1", time: "14:00", title: "Focus", sessionType: "documentation", enabled: true, durationMinutes: 25 }],
					["n1"],
				);

				const dashboard = new UserHubDashboard(container, makeDeps({
					eventBus,
					nudgeService,
				}));

				dashboard.render();

				expect(container.querySelector(".ft-next-nudge")).toBeNull();
			} finally {
				vi.useRealTimers();
			}
		});

		it("should not show nudge indicator when all nudges are in the past", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-02-18T15:00:00"));
			try {
				const nudgeService = makeNudgeService([
					{ id: "n1", time: "09:00", title: "Morning", sessionType: "daily-tracking", enabled: true, durationMinutes: 0 },
					{ id: "n2", time: "14:00", title: "Afternoon", sessionType: "documentation", enabled: true, durationMinutes: 50 },
				]);

				const dashboard = new UserHubDashboard(container, makeDeps({
					eventBus,
					nudgeService,
				}));

				dashboard.render();

				expect(container.querySelector(".ft-next-nudge")).toBeNull();
			} finally {
				vi.useRealTimers();
			}
		});

		it("should pick the earliest upcoming nudge when multiple exist", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-02-18T10:00:00"));
			try {
				const nudgeService = makeNudgeService([
					{ id: "n1", time: "16:00", title: "Late", sessionType: "review", enabled: true, durationMinutes: 25 },
					{ id: "n2", time: "12:00", title: "Noon", sessionType: "documentation", enabled: true, durationMinutes: 50 },
				]);

				const dashboard = new UserHubDashboard(container, makeDeps({
					eventBus,
					nudgeService,
				}));

				dashboard.render();

				expect(container.textContent).toContain("Noon");
				expect(container.textContent).toContain("12:00");
			} finally {
				vi.useRealTimers();
			}
		});

		it("should not render when nudgeService is undefined", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
			}));

			dashboard.render();

			expect(container.querySelector(".ft-next-nudge")).toBeNull();
		});
	});

	// ── Empty state hero ────────────────────────────────────

	describe("empty state hero", () => {
		it("should show empty state hero when no content exists", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry([]) as never,
				inboxService: makeInboxService([], 0),
				sessionService: makeSessionService(null),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-empty-state")).toBeTruthy();
			expect(container.textContent).toContain("Welcome to Your Hub");
			expect(container.textContent).toContain("Open Analytics Hub");
			expect(container.textContent).toContain("Start a Session");
		});

		it("should not show empty state hero when inbox has items", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry([]) as never,
				inboxService: makeInboxService([makeItem()], 1),
				sessionService: makeSessionService(null),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-empty-state")).toBeNull();
		});

		it("should not show empty state hero when active session exists", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry([]) as never,
				inboxService: makeInboxService([], 0),
				sessionService: makeSessionService(makeActiveSession()),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-empty-state")).toBeNull();
		});

		it("should not show empty state hero when hub summaries exist", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry([makeProvider({ getHubId: () => "event-catalog" })]) as never,
				inboxService: makeInboxService([], 0),
				sessionService: makeSessionService(null),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-empty-state")).toBeNull();
		});

		it("should emit ui.openAnalyticsHub when Analytics Hub card is clicked", async () => {
			const spy = vi.fn();
			eventBus.on("ui.openAnalyticsHub", spy);

			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry([]) as never,
				inboxService: makeInboxService([], 0),
				sessionService: makeSessionService(null),
			}));

			dashboard.render();

			const cards = container.querySelectorAll(".ft-empty-state .ft-stat-card");
			expect(cards.length).toBe(2);
			(cards[0] as HTMLElement).click();

			await new Promise((r) => setTimeout(r, 10));
			expect(spy).toHaveBeenCalled();
		});

		it("should call onCreateSession when Start a Session card is clicked", () => {
			const onCreateSession = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry([]) as never,
				inboxService: makeInboxService([], 0),
				sessionService: makeSessionService(null),
				onCreateSession,
			}));

			dashboard.render();

			const cards = container.querySelectorAll(".ft-empty-state .ft-stat-card");
			(cards[1] as HTMLElement).click();

			expect(onCreateSession).toHaveBeenCalled();
		});
	});

	// ── Toolbar (quick actions + compact capture) ──────────

	describe("toolbar", () => {
		it("should render toolbar with quick actions and compact capture", () => {
			const onCaptureIdea = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				onCaptureIdea,
			}));

			dashboard.render();

			expect(container.querySelector(".ft-dashboard-toolbar")).toBeTruthy();
			expect(container.querySelector(".ft-idea-capture-compact")).toBeTruthy();
		});

		it("should not render compact idea capture when onCaptureIdea is absent", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				onCaptureIdea: undefined,
			}));

			dashboard.render();

			expect(container.querySelector(".ft-idea-capture-compact")).toBeNull();
		});

	});

	// ── Visible hubs filtering ─────────────────────────────

	describe("visible hubs filtering", () => {
		it("should only show hubs listed in visibleHubs setting", () => {
			const providers = [
				makeProvider({
					getHubId: () => "event-catalog",
					getDisplayName: () => "Event Catalog",
					getSummary: () => ({
						stats: [{ label: "Events", value: "10", icon: "list", tabId: "events" }],
						healthLevel: "healthy" as const,
						actionItemCount: 0,
					}),
				}),
				makeProvider({
					getHubId: () => "analytics",
					getDisplayName: () => "Analytics",
					getSummary: () => ({
						stats: [{ label: "Queries", value: "5", icon: "search", tabId: "queries" }],
						healthLevel: "healthy" as const,
						actionItemCount: 0,
					}),
				}),
			];
			const settings = {
				...DEFAULT_SETTINGS,
				userHubConfig: { ...DEFAULT_SETTINGS.userHubConfig, visibleHubs: ["event-catalog"] },
			};

			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry(providers) as never,
				getSettings: () => settings,
			}));

			dashboard.render();

			// Hub summary rows should only include the visible hub
			const hubRows = container.querySelectorAll(".ft-dashboard-hub-row");
			expect(hubRows).toHaveLength(1);
			const hubRowTexts = Array.from(hubRows).map((r) => r.textContent);
			expect(hubRowTexts[0]).toContain("Event Catalog");
			// Analytics may appear in toolbar hub buttons but NOT in summary rows
			expect(hubRowTexts.some((t) => t?.includes("Analytics"))).toBe(false);
		});

		it("should hide hub summaries section when no visible hubs match", () => {
			const providers = [
				makeProvider({ getHubId: () => "analytics", getDisplayName: () => "Analytics" }),
			];
			const settings = {
				...DEFAULT_SETTINGS,
				userHubConfig: { ...DEFAULT_SETTINGS.userHubConfig, visibleHubs: [] },
			};

			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				hubRegistry: makeHubRegistry(providers) as never,
				getSettings: () => settings,
			}));

			dashboard.render();

			expect(container.textContent).not.toContain("Your hubs");
		});
	});

	// ── Re-render ───────────────────────────────────────────

	describe("re-render", () => {
		it("should clear and rebuild on subsequent render calls", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus }));

			dashboard.render();
			const firstH2Count = container.querySelectorAll("h2").length;

			dashboard.render();
			const secondH2Count = container.querySelectorAll("h2").length;

			expect(secondH2Count).toBe(firstH2Count);
		});
	});
});
