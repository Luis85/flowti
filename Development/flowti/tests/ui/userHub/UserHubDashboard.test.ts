// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { UserHubDashboard, type UserHubDashboardDeps } from "../../../src/ui/userHub/UserHubDashboard";
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

function makeSessionService(activeSession: Session | null = null, dailySession: Session | null = null): SessionService {
	return {
		getSessions: vi.fn(() => []),
		getActiveSession: vi.fn(() => activeSession),
		getDailySession: vi.fn(() => dailySession),
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

			expect(container.textContent).toContain("Your inbox is empty");
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

			expect(container.textContent).toContain("3 unread");
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

		it("should show source event badge on rows", () => {
			const items = [
				makeItem({ sourceEvent: "dataExchange.import.completed" }),
				makeItem({ id: "item-2", sourceEvent: "subscription.matched" }),
			];
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				inboxService: makeInboxService(items, 0),
			}));

			dashboard.render();

			const badges = container.querySelectorAll(".ft-badge");
			const badgeTexts = Array.from(badges).map((b) => b.textContent);
			expect(badgeTexts).toContain("Import");
			expect(badgeTexts).toContain("Watcher");
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

			const rows = container.querySelectorAll(".ft-catalog-row");
			expect(rows).toHaveLength(2);
			expect((rows[0] as HTMLElement).style.fontWeight).toBe("600");
			expect((rows[1] as HTMLElement).style.fontWeight).not.toBe("600");
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

			const rows = container.querySelectorAll(".ft-catalog-row");
			expect((rows[0] as HTMLElement).style.borderLeft).toContain("var(--interactive-accent)");
			expect((rows[1] as HTMLElement).style.borderLeft).not.toContain("var(--interactive-accent)");
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

			const rows = container.querySelectorAll(".ft-catalog-row");
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

			const row = container.querySelector(".ft-catalog-row") as HTMLElement;
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
		it("should render stat cards for each provider stat", () => {
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

			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
			}));

			dashboard.render();

			// Should show prefixed labels
			expect(container.textContent).toContain("Hub A — Events");
			expect(container.textContent).toContain("Hub A — Domains");
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

			expect(container.textContent).not.toContain("User Hub — Items");
			expect(container.textContent).toContain("Event Catalog — Items");
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

			expect(container.textContent).not.toContain("Your Hubs");
		});

		it("should call openHub with tabId when stat card is clicked", () => {
			const hubRegistry = makeHubRegistry([
				makeProvider({
					getHubId: () => "event-catalog",
					getDisplayName: () => "Event Catalog",
					getSummary: () => ({
						stats: [
							{ label: "Events", value: "42", icon: "list", tabId: "events" },
						],
						healthLevel: "healthy",
						actionItemCount: 0,
					}),
				}),
			]);

			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: hubRegistry as never,
				eventBus,
			}));

			dashboard.render();

			// Find the stat card and click it
			const statCards = container.querySelectorAll(".ft-stat-card");
			expect(statCards.length).toBeGreaterThanOrEqual(1);
			(statCards[0] as HTMLElement).click();

			expect(hubRegistry.openHub).toHaveBeenCalledWith("event-catalog", "events");
		});

		it("should call openHub without tabId for stats lacking tabId", () => {
			const hubRegistry = makeHubRegistry([
				makeProvider({
					getHubId: () => "event-catalog",
					getDisplayName: () => "Event Catalog",
					getSummary: () => ({
						stats: [
							{ label: "Some Stat", value: "8", icon: "tag" },
						],
						healthLevel: "healthy",
						actionItemCount: 0,
					}),
				}),
			]);

			const dashboard = new UserHubDashboard(container, makeDeps({
				hubRegistry: hubRegistry as never,
				eventBus,
			}));

			dashboard.render();

			const statCards = container.querySelectorAll(".ft-stat-card");
			expect(statCards.length).toBeGreaterThanOrEqual(1);
			(statCards[0] as HTMLElement).click();

			expect(hubRegistry.openHub).toHaveBeenCalledWith("event-catalog", undefined);
		});
	});

	// ── Quick actions ───────────────────────────────────────

	describe("quick actions", () => {
		it("should render 7 quick action buttons", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus }));

			dashboard.render();

			// Quick actions use ft-nav-link class; inbox "View all" also uses it
			// With empty inbox, only quick actions should produce ft-nav-link
			const actions = container.querySelectorAll(".ft-nav-link");
			expect(actions).toHaveLength(7);
		});

		it("should navigate to sessions tab on Sessions click", () => {
			const navigateToTab = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, navigateToTab }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			(actions[0] as HTMLElement).click();

			expect(navigateToTab).toHaveBeenCalledWith("sessions");
		});

		it("should navigate to inbox tab on Inbox click", () => {
			const navigateToTab = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, navigateToTab }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			(actions[1] as HTMLElement).click();

			expect(navigateToTab).toHaveBeenCalledWith("inbox");
		});

		it("should navigate to preferences tab on Preferences click", () => {
			const navigateToTab = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, navigateToTab }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			(actions[2] as HTMLElement).click();

			expect(navigateToTab).toHaveBeenCalledWith("preferences");
		});

		it("should emit ui.openEventCatalog on Event Catalog click", async () => {
			const spy = vi.fn();
			eventBus.on("ui.openEventCatalog", spy);

			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			(actions[3] as HTMLElement).click();

			// Allow async event emission to settle
			await new Promise((r) => setTimeout(r, 10));

			expect(spy).toHaveBeenCalled();
		});

		it("should show New Session button when onCreateSession is provided", () => {
			const onCreateSession = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, onCreateSession }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			expect(actions).toHaveLength(8);
			expect(actions[0].textContent).toContain("New Session");
		});

		it("should call onCreateSession when New Session button is clicked", () => {
			const onCreateSession = vi.fn();
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus, onCreateSession }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			(actions[0] as HTMLElement).click();

			expect(onCreateSession).toHaveBeenCalled();
		});

		it("should not show New Session button when onCreateSession is absent", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({ eventBus }));

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			expect(actions).toHaveLength(7);
			const labels = Array.from(actions).map((a) => a.textContent);
			expect(labels.every((l) => !l?.includes("New Session"))).toBe(true);
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

	// ── Daily session indicator ──────────────────────────────

	describe("daily session indicator", () => {
		it("should render daily session indicator when daily session exists", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				title: "Daily Tracking",
				activity: [
					{ timestamp: new Date().toISOString(), action: "modified", path: "notes/test.md" },
					{ timestamp: new Date().toISOString(), action: "created", path: "notes/new.md" },
				],
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-daily-session")).toBeTruthy();
			expect(container.textContent).toContain("Daily Tracking");
			expect(container.textContent).toContain("Active");
			expect(container.textContent).toContain("2 files");
		});

		it("should not render daily session indicator when no daily session", () => {
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, null),
			}));

			dashboard.render();

			expect(container.querySelector(".ft-daily-session")).toBeNull();
		});

		it("should skip daily indicator when daily IS the active session", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				title: "Daily Tracking",
			});
			// daily is also the active session
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(daily, daily),
			}));

			dashboard.render();

			// Active session card should exist, but daily indicator should not
			expect(container.querySelector(".ft-active-session")).toBeTruthy();
			expect(container.querySelector(".ft-daily-session")).toBeNull();
		});

		it("should show grouped file names instead of raw activity count", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				title: "Daily Tracking",
				activity: [
					{ timestamp: "2026-02-18T10:00:00Z", action: "modified", path: "notes/test.md" },
					{ timestamp: "2026-02-18T10:01:00Z", action: "modified", path: "notes/test.md" },
					{ timestamp: "2026-02-18T10:02:00Z", action: "created", path: "notes/new.md" },
				],
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			}));

			dashboard.render();

			// Should show "2 files" (grouped) instead of "3 activities" (raw)
			expect(container.textContent).toContain("2 files");
			expect(container.textContent).not.toContain("3 activities");
			// Should show individual file names
			expect(container.textContent).toContain("test.md");
			expect(container.textContent).toContain("new.md");
		});

		it("should show action badges on grouped activity rows", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				activity: [
					{ timestamp: "2026-02-18T10:00:00Z", action: "modified", path: "notes/test.md" },
					{ timestamp: "2026-02-18T10:01:00Z", action: "created", path: "notes/new.md" },
				],
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			}));

			dashboard.render();

			expect(container.textContent).toContain("modified");
			expect(container.textContent).toContain("created");
		});

		it("should show count badge for files with multiple events", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				activity: [
					{ timestamp: "2026-02-18T10:00:00Z", action: "modified", path: "notes/test.md" },
					{ timestamp: "2026-02-18T10:01:00Z", action: "modified", path: "notes/test.md" },
					{ timestamp: "2026-02-18T10:02:00Z", action: "modified", path: "notes/test.md" },
				],
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			}));

			dashboard.render();

			expect(container.textContent).toContain("×3");
		});

		it("should show '+N more files' when more than 5 files", () => {
			const activity = Array.from({ length: 7 }, (_, i) => ({
				timestamp: `2026-02-18T10:0${i}:00Z`,
				action: "modified" as const,
				path: `notes/file-${i}.md`,
			}));
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				activity,
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			}));

			dashboard.render();

			expect(container.textContent).toContain("+2 more files");
		});

		it("should show no activity preview when no activity", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
				activity: [],
			});
			const dashboard = new UserHubDashboard(container, makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			}));

			dashboard.render();

			expect(container.textContent).not.toContain("files");
			expect(container.textContent).not.toContain("more");
		});

		it("should open workspace on daily indicator click", () => {
			const daily = makeActiveSession({
				id: "daily-1",
				type: "daily-tracking",
			});
			const deps = makeDeps({
				eventBus,
				sessionService: makeSessionService(null, daily),
			});
			const dashboard = new UserHubDashboard(container, deps);

			dashboard.render();

			const card = container.querySelector(".ft-daily-session") as HTMLElement;
			card.click();

			expect(deps.openSessionWorkspace).toHaveBeenCalledWith("daily-1");
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
