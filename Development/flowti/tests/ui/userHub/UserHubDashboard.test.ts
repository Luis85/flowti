// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { UserHubDashboard } from "../../../src/ui/userHub/UserHubDashboard";
import type { HubDashboardProvider, HubSummary } from "../../../src/domain/hub/types";
import type { IUserService } from "../../../src/domain/user/types";

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
			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry([]) as never,
				eventBus,
			});

			dashboard.render();

			expect(container.textContent).toContain("Welcome, Alice");
		});

		it("should show generic greeting when no user", () => {
			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService(),
				hubRegistry: makeHubRegistry([]) as never,
				eventBus,
			});

			dashboard.render();

			expect(container.textContent).toContain("Welcome to Flowti");
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

			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
			});

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

			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
			});

			dashboard.render();

			expect(container.textContent).not.toContain("User Hub — Items");
			expect(container.textContent).toContain("Event Catalog — Items");
		});

		it("should not render hub summaries section when no other providers", () => {
			const providers = [
				makeProvider({ getHubId: () => "user-hub" }),
			];

			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry(providers) as never,
				eventBus,
			});

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

			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: hubRegistry as never,
				eventBus,
			});

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
							{ label: "Categories", value: "8", icon: "tag" },
						],
						healthLevel: "healthy",
						actionItemCount: 0,
					}),
				}),
			]);

			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: hubRegistry as never,
				eventBus,
			});

			dashboard.render();

			const statCards = container.querySelectorAll(".ft-stat-card");
			expect(statCards.length).toBeGreaterThanOrEqual(1);
			(statCards[0] as HTMLElement).click();

			expect(hubRegistry.openHub).toHaveBeenCalledWith("event-catalog", undefined);
		});
	});

	// ── Quick actions ───────────────────────────────────────

	describe("quick actions", () => {
		it("should render 4 quick action buttons", () => {
			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry([]) as never,
				eventBus,
			});

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			expect(actions).toHaveLength(4);
		});

		it("should emit ui.openEventCatalog on Event Catalog click", async () => {
			const spy = vi.fn();
			eventBus.on("ui.openEventCatalog", spy);

			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry([]) as never,
				eventBus,
			});

			dashboard.render();

			const actions = container.querySelectorAll(".ft-nav-link");
			(actions[0] as HTMLElement).click();

			// Allow async event emission to settle
			await new Promise((r) => setTimeout(r, 10));

			expect(spy).toHaveBeenCalled();
		});
	});

	// ── Re-render ───────────────────────────────────────────

	describe("re-render", () => {
		it("should clear and rebuild on subsequent render calls", () => {
			const dashboard = new UserHubDashboard(container, {
				userService: makeUserService("Alice"),
				hubRegistry: makeHubRegistry([]) as never,
				eventBus,
			});

			dashboard.render();
			const firstH2Count = container.querySelectorAll("h2").length;

			dashboard.render();
			const secondH2Count = container.querySelectorAll("h2").length;

			expect(secondH2Count).toBe(firstH2Count);
		});
	});
});
