import type { App } from "obsidian";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import type { IEventBus } from "../../infrastructure/events/types";
import type { FileSystemClient } from "../../infrastructure/filesystem/FileSystemClient";
import type { DiscoveredEvent } from "../../domain/discovery/types";
import type { Subscription } from "../../domain/subscription/types";
import type { EventDefinition } from "../../domain/eventDefinition/types";
import type { CatalogCategoryConfig, EntityPaths } from "../../domain/settings/settings";
import type { EntityType } from "../eventDocTemplate";

// ─────────────────────────────────────────────────────────────
// Entity entry interfaces
// ─────────────────────────────────────────────────────────────

export interface SystemEntry {
	name: string;
	description: string;
	domains: string[];
	services: string[];
	filePath: string;
	events: EventCatalogEntry[];
}

export interface FlowEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
	resolvedEvents: EventCatalogEntry[];
}

export interface ActorEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
	resolvedEvents: EventCatalogEntry[];
}

export interface ProductEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
	resolvedEvents: EventCatalogEntry[];
}

export interface DomainEntry {
	name: string;
	description: string;
	services: string[];
	categories: string[];
	events: EventCatalogEntry[];
	filePath: string | null;
	configuredCount: number;
	visibleCount: number;
	visible: boolean;
	isSystem: boolean;
	isArea: boolean;
}

export interface ServiceEntry {
	name: string;
	description: string;
	domains: string[];
	events: EventCatalogEntry[];
	filePath: string | null;
	configuredCount: number;
	visible: boolean;
	isSystem: boolean;
}

export interface CategoryEntry {
	name: string;
	description: string;
	domains: string[];
	services: string[];
	events: EventCatalogEntry[];
	filePath: string | null;
	visible: boolean;
}

// ─────────────────────────────────────────────────────────────
// Shared state & dependency interfaces
// ─────────────────────────────────────────────────────────────

export interface CatalogState {
	discoveredEvents: DiscoveredEvent[];
	excludedTypes: Set<string>;
	notifiedTypes: Set<string>;
	subscriptions: Subscription[];
	definitions: EventDefinition[];
	domainEntries: DomainEntry[];
	serviceEntries: ServiceEntry[];
	categoryEntries: CategoryEntry[];
	flowEntries: FlowEntry[];
	systemEntries: SystemEntry[];
	actorEntries: ActorEntry[];
	productEntries: ProductEntry[];
	catalogCategories: CatalogCategoryConfig[];
	catalogDomains: CatalogCategoryConfig[];
	catalogServices: CatalogCategoryConfig[];
	showSystemEvents: boolean;
	collapsedCategories: Set<string>;
	docsRootPath: string;
	entityPaths: EntityPaths;
	filterText: string;
}

export interface NavigationCallbacks {
	navigateToTab: (tab: string) => void;
	navigateToEvent: (eventType: string) => void;
	navigateToDomain: (domain: string) => void;
	navigateToService: (service: string) => void;
	navigateToFlow: (flow: string) => void;
	navigateToSystem: (system: string) => void;
	navigateToActor: (actor: string) => void;
	navigateToProduct: (product: string) => void;
	openActivityLog: () => void;
	openSubscriptionManager: () => void;
}

export interface CatalogComponentDeps {
	app: App;
	eventBus: IEventBus;
	fileSystemClient: FileSystemClient;
	getState: () => CatalogState;
	navigation: NavigationCallbacks;
	scheduleRender: () => void;
	getEntityFolder: (entity: EntityType) => string;
	createEntity: (entityType: EntityType, name: string, options?: { category?: string }) => void;
}
