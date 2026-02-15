import { describe, it, expect, beforeEach } from "vitest";
import { EventCatalogProvider } from "../../../src/domain/hub/EventCatalogProvider";
import { DataExchangeProvider } from "../../../src/domain/hub/DataExchangeProvider";
import { UserHubProvider } from "../../../src/domain/hub/UserHubProvider";
import { EVENT_CATALOG } from "../../../src/infrastructure/events/catalog";
import { VIEW_TYPE_EVENT_CATALOG } from "../../../src/ui/EventCatalogView";
import { VIEW_TYPE_DATA_EXCHANGE_HUB } from "../../../src/ui/DataExchangeHubView";
import { VIEW_TYPE_USER_HUB } from "../../../src/ui/UserHubView";
import type { ViewStateProvider } from "../../../src/infrastructure/views/registry";
import type { IUserService } from "../../../src/domain/user/types";

// ── Fixtures ─────────────────────────────────────────────────

function makeViewState(overrides?: Partial<ViewStateProvider>): ViewStateProvider {
	return {
		getSettings: () => ({}) as never,
		getExcludedTypes: () => [],
		getNotifiedTypes: () => [],
		getDiscoveredEvents: () => [],
		collapsedCategories: new Set(),
		...overrides,
	};
}

function makeUserService(name?: string): IUserService {
	return {
		getUser: () => name ? { name } : null,
		hasUser: () => !!name,
		createUser: () => Promise.resolve(),
		load: () => Promise.resolve(),
		updateUserName: () => Promise.resolve(),
	} as unknown as IUserService;
}

function makeDataExchangeService(imports = 0, exports = 0, pipelines = 0) {
	return {
		getSavedImportConfigs: () => Array.from({ length: imports }, (_, i) => ({ id: `imp-${i}` })),
		getSavedExportConfigs: () => Array.from({ length: exports }, (_, i) => ({ id: `exp-${i}` })),
		getSavedPipelines: () => Array.from({ length: pipelines }, (_, i) => ({ id: `pip-${i}` })),
	};
}

// ── EventCatalogProvider ─────────────────────────────────────

describe("EventCatalogProvider", () => {
	let provider: EventCatalogProvider;
	let state: ViewStateProvider;

	beforeEach(() => {
		state = makeViewState();
		provider = new EventCatalogProvider(state);
	});

	it("should return correct hub metadata", () => {
		expect(provider.getHubId()).toBe("event-catalog");
		expect(provider.getViewType()).toBe(VIEW_TYPE_EVENT_CATALOG);
		expect(provider.getDisplayName()).toBe("Event Catalog");
		expect(provider.getIcon()).toBe("list");
	});

	it("should return 4 stats", () => {
		const summary = provider.getSummary();
		expect(summary.stats).toHaveLength(4);
		expect(summary.stats.map((s) => s.label)).toEqual(["Events", "Domains", "Services", "Categories"]);
	});

	it("should count events including discovered events", () => {
		const discovered = [{ type: "custom.event" }, { type: "custom.other" }] as never[];
		state = makeViewState({ getDiscoveredEvents: () => discovered });
		provider = new EventCatalogProvider(state);

		const summary = provider.getSummary();
		const eventsStat = summary.stats.find((s) => s.label === "Events")!;
		expect(Number(eventsStat.value)).toBe(EVENT_CATALOG.length + 2);
	});

	it("should include tabId on navigable stats", () => {
		const summary = provider.getSummary();

		expect(summary.stats[0]).toMatchObject({ label: "Events", tabId: "events" });
		expect(summary.stats[1]).toMatchObject({ label: "Domains", tabId: "domains" });
		expect(summary.stats[2]).toMatchObject({ label: "Services", tabId: "services" });
	});

	it("should NOT include tabId on Categories stat", () => {
		const summary = provider.getSummary();
		const categoriesStat = summary.stats.find((s) => s.label === "Categories")!;
		expect(categoriesStat.tabId).toBeUndefined();
	});

	it("should report healthy status", () => {
		const summary = provider.getSummary();
		expect(summary.healthLevel).toBe("healthy");
		expect(summary.actionItemCount).toBe(0);
	});
});

// ── DataExchangeProvider ─────────────────────────────────────

describe("DataExchangeProvider", () => {
	it("should return correct hub metadata", () => {
		const provider = new DataExchangeProvider(makeDataExchangeService() as never);

		expect(provider.getHubId()).toBe("data-exchange");
		expect(provider.getViewType()).toBe(VIEW_TYPE_DATA_EXCHANGE_HUB);
		expect(provider.getDisplayName()).toBe("Data Exchange");
		expect(provider.getIcon()).toBe("arrow-left-right");
	});

	it("should return 3 stats with correct values", () => {
		const provider = new DataExchangeProvider(makeDataExchangeService(3, 5, 2) as never);
		const summary = provider.getSummary();

		expect(summary.stats).toHaveLength(3);
		expect(summary.stats[0]).toMatchObject({ label: "Imports", value: "3", icon: "file-input" });
		expect(summary.stats[1]).toMatchObject({ label: "Exports", value: "5", icon: "file-output" });
		expect(summary.stats[2]).toMatchObject({ label: "Pipelines", value: "2", icon: "workflow" });
	});

	it("should include tabId on all stats", () => {
		const provider = new DataExchangeProvider(makeDataExchangeService() as never);
		const summary = provider.getSummary();

		expect(summary.stats[0]).toMatchObject({ label: "Imports", tabId: "imports" });
		expect(summary.stats[1]).toMatchObject({ label: "Exports", tabId: "exports" });
		expect(summary.stats[2]).toMatchObject({ label: "Pipelines", tabId: "pipelines" });
	});

	it("should report zero counts when no configs exist", () => {
		const provider = new DataExchangeProvider(makeDataExchangeService(0, 0, 0) as never);
		const summary = provider.getSummary();

		for (const stat of summary.stats) {
			expect(stat.value).toBe("0");
		}
	});

	it("should report healthy status", () => {
		const provider = new DataExchangeProvider(makeDataExchangeService() as never);
		const summary = provider.getSummary();
		expect(summary.healthLevel).toBe("healthy");
		expect(summary.actionItemCount).toBe(0);
	});
});

// ── UserHubProvider ──────────────────────────────────────────

describe("UserHubProvider", () => {
	it("should return correct hub metadata", () => {
		const provider = new UserHubProvider(makeUserService("Alice"));

		expect(provider.getHubId()).toBe("user-hub");
		expect(provider.getViewType()).toBe(VIEW_TYPE_USER_HUB);
		expect(provider.getDisplayName()).toBe("User Hub");
		expect(provider.getIcon()).toBe("home");
	});

	it("should show user name when user exists", () => {
		const provider = new UserHubProvider(makeUserService("Bob"));
		const summary = provider.getSummary();

		expect(summary.stats).toHaveLength(1);
		expect(summary.stats[0]).toMatchObject({ label: "User", value: "Bob", icon: "user" });
	});

	it("should show 'Not set' when no user exists", () => {
		const provider = new UserHubProvider(makeUserService());
		const summary = provider.getSummary();

		expect(summary.stats[0].value).toBe("Not set");
	});

	it("should report healthy status", () => {
		const provider = new UserHubProvider(makeUserService());
		const summary = provider.getSummary();
		expect(summary.healthLevel).toBe("healthy");
		expect(summary.actionItemCount).toBe(0);
	});
});
