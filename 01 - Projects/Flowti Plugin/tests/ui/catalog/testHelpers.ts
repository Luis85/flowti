/**
 * Reusable test helpers for catalog component tests.
 *
 * Provides mock factories for CatalogComponentDeps and CatalogState
 * so each component test can focus on behavior, not setup boilerplate.
 */

import { vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { CatalogComponentDeps, CatalogState } from "../../../src/ui/catalog/types";
import { App } from "obsidian";

export function createDefaultCatalogState(overrides?: Partial<CatalogState>): CatalogState {
	return {
		discoveredEvents: [],
		excludedTypes: new Set<string>(),
		notifiedTypes: new Set<string>(),
		subscriptions: [],
		definitions: [],
		domainEntries: [],
		serviceEntries: [],
		categoryEntries: [],
		flowEntries: [],
		systemEntries: [],
		actorEntries: [],
		productEntries: [],
		catalogCategories: [],
		catalogDomains: [],
		catalogServices: [],
		showSystemEvents: false,
		collapsedCategories: new Set<string>(),
		docsRootPath: "03 - Resources/Documentation/Reference",
		entityPaths: {
			events: { subfolder: "Events", overridePath: "" },
			domains: { subfolder: "Domains", overridePath: "" },
			services: { subfolder: "Services", overridePath: "" },
			categories: { subfolder: "Categories", overridePath: "" },
			flows: { subfolder: "Flows", overridePath: "" },
			systems: { subfolder: "Systems", overridePath: "" },
			actors: { subfolder: "Actors", overridePath: "" },
			products: { subfolder: "Products", overridePath: "" },
		},
		filterText: "",
		...overrides,
	};
}

export function createMockCatalogDeps(overrides?: Partial<CatalogComponentDeps> & { state?: Partial<CatalogState> }): CatalogComponentDeps {
	const eventBus: IEventBus = overrides?.eventBus ?? new EventBus();
	const state = createDefaultCatalogState(overrides?.state);

	const mockApp = new App() as App & {
		vault: {
			getAbstractFileByPath: ReturnType<typeof vi.fn>;
		};
	};
	mockApp.vault = {
		getAbstractFileByPath: vi.fn().mockReturnValue(null),
	} as unknown as typeof mockApp.vault;

	return {
		app: overrides?.app ?? mockApp,
		vaultQuery: overrides?.vaultQuery ?? {
			getFileByPath: vi.fn().mockReturnValue(null),
			getFrontmatter: vi.fn().mockReturnValue(null),
			resolveLinks: vi.fn().mockReturnValue([]),
			getAllFiles: vi.fn().mockReturnValue([]),
		} as unknown as CatalogComponentDeps["vaultQuery"],
		workspace: overrides?.workspace ?? {
			openFile: vi.fn(),
			openFileInNewLeaf: vi.fn(),
			openLink: vi.fn(),
			openView: vi.fn(),
		} as unknown as CatalogComponentDeps["workspace"],
		eventBus,
		getState: overrides?.getState ?? vi.fn(() => state),
		navigation: overrides?.navigation ?? {
			navigateToTab: vi.fn(),
			navigateToEvent: vi.fn(),
			navigateToDomain: vi.fn(),
			navigateToService: vi.fn(),
			navigateToFlow: vi.fn(),
			navigateToSystem: vi.fn(),
			navigateToActor: vi.fn(),
			navigateToProduct: vi.fn(),
			openActivityLog: vi.fn(),
			openSubscriptionManager: vi.fn(),
		},
		scheduleRender: overrides?.scheduleRender ?? vi.fn(),
		getEntityFolder: overrides?.getEntityFolder ?? vi.fn(() => "docs/Domains"),
		createEntity: overrides?.createEntity ?? vi.fn(),
	};
}
