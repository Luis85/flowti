/**
 * Runtime event catalog for Flowti.
 *
 * Provides human-readable metadata for all events defined in
 * {@link FlowtiEventMap}. The catalog is **type-checked against
 * FlowtiEventMap** via `satisfies Record<keyof FlowtiEventMap, ...>`,
 * so adding a new event without catalog metadata is a compile error.
 *
 * TypeScript interfaces are erased at runtime — this catalog makes
 * event metadata available for UI components like the Event Catalog
 * View and Event Log View.
 */

import type { FlowtiEventMap } from "./events";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Data flow direction for an event.
 */
export type EventDirection =
	| "Plugin → Listeners"
	| "Service → EventBridge"
	| "EventBridge → Service"
	| "EventBridge → Services"
	| "Service → Listeners"
	| "View → Plugin"
	| "Internal";

/**
 * Metadata stored per event type in the catalog.
 */
export interface EventCatalogMeta {
	/** Human-readable category for grouping */
	category: EventCategory;
	/** Short description of when/why this event fires */
	description: string;
	/** Data flow direction */
	direction: EventDirection;
	/** Source domain (e.g. "infrastructure", "user", "settings") */
	domain: string;
	/** Service(s) that emit or handle this event */
	services: string;
}

/**
 * A catalog entry enriched with its event type key.
 * Uses wider types than EventCatalogMeta to accommodate
 * discovered user-land events alongside system events.
 */
export interface EventCatalogEntry {
	/** Event type key (system events match FlowtiEventMap keys; discovered events use arbitrary names) */
	type: string;
	/** Human-readable category for grouping */
	category: string;
	/** Short description of when/why this event fires */
	description: string;
	/** Data flow direction */
	direction: string;
	/** Source domain (e.g. "infrastructure", "user", "settings") */
	domain: string;
	/** Service(s) that emit or handle this event */
	services: string;
}

/**
 * All event categories in display order.
 */
export const EVENT_CATEGORIES = [
	"Plugin Lifecycle",
	"Service Lifecycle",
	"Commands",
	"Views",
	"Logging",
	"Errors",
	"File Requests",
	"File Responses",
	"File Notifications",
	"Folder Notifications",
	"Event-File Notifications",
	"Frontmatter Requests",
	"Frontmatter Responses",
	"Workspace",
	"Metadata",
	"User",
	"Settings",
	"Installer",
	"Discovery",
	"Event Filter",
	"Event Notify",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// ─────────────────────────────────────────────────────────────
// Catalog data — keyed by FlowtiEventMap
//
// `satisfies` ensures every key in FlowtiEventMap has an entry.
// Adding a new event to FlowtiEventMap without adding it here
// will produce a compile error.
// ─────────────────────────────────────────────────────────────

const CATALOG_DATA = {
	// ── Plugin Lifecycle ─────────────────────────────────────
	"plugin.loading":   { category: "Plugin Lifecycle", description: "Plugin starts loading", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin" },
	"plugin.loaded":    { category: "Plugin Lifecycle", description: "Plugin has fully loaded", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin" },
	"plugin.ready":     { category: "Plugin Lifecycle", description: "Plugin is ready (layout ready, user loaded)", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin" },
	"plugin.unloading": { category: "Plugin Lifecycle", description: "Plugin starts unloading", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin" },
	"plugin.unloaded":  { category: "Plugin Lifecycle", description: "Plugin has fully unloaded", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin" },

	// ── Service Lifecycle ────────────────────────────────────
	"service.registered":  { category: "Service Lifecycle", description: "A service was registered with the container", direction: "Internal", domain: "infrastructure", services: "ServiceContainer" },
	"service.initialized": { category: "Service Lifecycle", description: "A service completed initialization", direction: "Internal", domain: "infrastructure", services: "ServiceContainer" },
	"service.disposed":    { category: "Service Lifecycle", description: "A service was disposed", direction: "Internal", domain: "infrastructure", services: "ServiceContainer" },
	"service.error":       { category: "Service Lifecycle", description: "A service failed to initialize", direction: "Internal", domain: "infrastructure", services: "ServiceContainer" },

	// ── Commands ─────────────────────────────────────────────
	"command.registered": { category: "Commands", description: "A command was registered", direction: "Internal", domain: "infrastructure", services: "CommandRegistry" },
	"command.executing":  { category: "Commands", description: "A command started executing", direction: "Internal", domain: "infrastructure", services: "CommandRegistry" },
	"command.executed":   { category: "Commands", description: "A command completed successfully", direction: "Internal", domain: "infrastructure", services: "CommandRegistry" },
	"command.failed":     { category: "Commands", description: "A command failed", direction: "Internal", domain: "infrastructure", services: "CommandRegistry" },

	// ── Views ────────────────────────────────────────────────
	"view.registered": { category: "Views", description: "A view was registered", direction: "Internal", domain: "infrastructure", services: "ViewRegistry" },

	// ── Logging ──────────────────────────────────────────────
	"log.entry": { category: "Logging", description: "A log entry was created", direction: "Service → Listeners", domain: "infrastructure", services: "LoggerService" },
	"log.error": { category: "Logging", description: "An error was logged", direction: "Service → Listeners", domain: "infrastructure", services: "LoggerService" },

	// ── Errors ───────────────────────────────────────────────
	"error.occurred": { category: "Errors", description: "An error occurred", direction: "Service → Listeners", domain: "infrastructure", services: "ErrorService" },
	"error.handled":  { category: "Errors", description: "An error was handled/recovered", direction: "Service → Listeners", domain: "infrastructure", services: "ErrorService" },

	// ── File Requests ────────────────────────────────────────
	"file.create.request": { category: "File Requests", description: "Request to create a new file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"file.read.request":   { category: "File Requests", description: "Request to read a file's content", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"file.update.request": { category: "File Requests", description: "Request to update a file's content", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"file.delete.request": { category: "File Requests", description: "Request to delete a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"file.move.request":   { category: "File Requests", description: "Request to move a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"file.rename.request": { category: "File Requests", description: "Request to rename a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },

	// ── File Responses ───────────────────────────────────────
	"file.create.response": { category: "File Responses", description: "Response after file creation", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"file.read.response":   { category: "File Responses", description: "Response after file read", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"file.update.response": { category: "File Responses", description: "Response after file update", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"file.delete.response": { category: "File Responses", description: "Response after file deletion", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"file.move.response":   { category: "File Responses", description: "Response after file move", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"file.rename.response": { category: "File Responses", description: "Response after file rename", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },

	// ── File Notifications ───────────────────────────────────
	"file.created":  { category: "File Notifications", description: "A file was created in the vault", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"file.modified": { category: "File Notifications", description: "A file was modified", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"file.deleted":  { category: "File Notifications", description: "A file was deleted", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"file.renamed":  { category: "File Notifications", description: "A file was renamed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },

	// ── Folder Notifications ─────────────────────────────────
	"folder.created": { category: "Folder Notifications", description: "A folder was created", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"folder.deleted": { category: "Folder Notifications", description: "A folder was deleted", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"folder.renamed": { category: "Folder Notifications", description: "A folder was renamed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },

	// ── Event-File Notifications ─────────────────────────────
	"event.file.triggered": { category: "Event-File Notifications", description: "A file with type=\"Event\" frontmatter triggered a vault action", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },

	// ── Frontmatter Requests ─────────────────────────────────
	"frontmatter.get.request":    { category: "Frontmatter Requests", description: "Request to read frontmatter", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"frontmatter.update.request": { category: "Frontmatter Requests", description: "Request to merge frontmatter fields", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },
	"frontmatter.set.request":    { category: "Frontmatter Requests", description: "Request to replace entire frontmatter", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient" },

	// ── Frontmatter Responses ────────────────────────────────
	"frontmatter.get.response":    { category: "Frontmatter Responses", description: "Response after frontmatter read", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"frontmatter.update.response": { category: "Frontmatter Responses", description: "Response after frontmatter update", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },
	"frontmatter.set.response":    { category: "Frontmatter Responses", description: "Response after frontmatter set", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge" },

	// ── Workspace ────────────────────────────────────────────
	"workspace.leaf-changed":   { category: "Workspace", description: "The active leaf (tab/view) changed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"workspace.file-opened":    { category: "Workspace", description: "A file was opened in the editor", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"workspace.layout-changed": { category: "Workspace", description: "The workspace layout changed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },

	// ── Metadata ─────────────────────────────────────────────
	"metadata.changed":  { category: "Metadata", description: "File metadata (frontmatter, tags, links) was updated", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },
	"metadata.resolved": { category: "Metadata", description: "All metadata references in the vault resolved", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge" },

	// ── User Domain ──────────────────────────────────────────
	"user.created": { category: "User", description: "A new user profile was created", direction: "Service → Listeners", domain: "user", services: "UserService" },
	"user.updated": { category: "User", description: "A user profile was updated", direction: "Service → Listeners", domain: "user", services: "UserService" },
	"user.loaded":  { category: "User", description: "A user profile was loaded from storage", direction: "Service → Listeners", domain: "user", services: "UserService" },

	// ── Settings Domain ──────────────────────────────────────
	"settings.changed":                 { category: "Settings", description: "Plugin settings were changed", direction: "Service → Listeners", domain: "settings", services: "SettingsService" },
	"settings.loaded":                  { category: "Settings", description: "Plugin settings were loaded", direction: "Service → Listeners", domain: "settings", services: "SettingsService" },
	"settings.updateCatalogCategories": { category: "Settings", description: "Update catalog category order/visibility", direction: "View → Plugin", domain: "settings", services: "EventCatalogView" },
	"settings.updateCollapsedCategories": { category: "Settings", description: "Update collapsed category state", direction: "View → Plugin", domain: "settings", services: "EventCatalogView" },

	// ── Installer Domain ─────────────────────────────────────
	"installer.started":        { category: "Installer", description: "Installation pipeline started", direction: "Service → Listeners", domain: "installer", services: "InstallerService" },
	"installer.step.started":   { category: "Installer", description: "An installer step started", direction: "Service → Listeners", domain: "installer", services: "InstallerService" },
	"installer.step.completed": { category: "Installer", description: "An installer step completed", direction: "Service → Listeners", domain: "installer", services: "InstallerService" },
	"installer.completed":      { category: "Installer", description: "Installation pipeline completed", direction: "Service → Listeners", domain: "installer", services: "InstallerService" },
	"installer.failed":         { category: "Installer", description: "Installation pipeline failed", direction: "Service → Listeners", domain: "installer", services: "InstallerService" },
	"installer.loaded":         { category: "Installer", description: "Installer state was loaded from storage", direction: "Service → Listeners", domain: "installer", services: "InstallerService" },

	// ── Discovery Domain ─────────────────────────────────────
	"discovery.loaded":  { category: "Discovery", description: "Discovery state was loaded from storage", direction: "Service → Listeners", domain: "discovery", services: "DiscoveryService" },
	"discovery.updated": { category: "Discovery", description: "A user-land event was discovered or updated", direction: "Service → Listeners", domain: "discovery", services: "DiscoveryService" },
	"discovery.create":  { category: "Discovery", description: "Create a new custom event manually", direction: "Service → Listeners", domain: "discovery", services: "DiscoveryService" },
	"discovery.remove":  { category: "Discovery", description: "Request removal of a discovered event", direction: "Service → Listeners", domain: "discovery", services: "DiscoveryService" },
	"discovery.removed": { category: "Discovery", description: "A discovered event was removed", direction: "Service → Listeners", domain: "discovery", services: "DiscoveryService" },

	// ── Event Filter Domain ──────────────────────────────────
	"eventFilter.loaded":         { category: "Event Filter", description: "Event filter state was loaded from storage", direction: "Service → Listeners", domain: "eventFilter", services: "EventFilterService" },
	"eventFilter.changed":        { category: "Event Filter", description: "Event exclusion list was updated", direction: "Service → Listeners", domain: "eventFilter", services: "EventFilterService" },
	"eventFilter.toggle":         { category: "Event Filter", description: "Toggle a single event type's exclusion", direction: "Service → Listeners", domain: "eventFilter", services: "EventFilterService" },
	"eventFilter.toggleCategory": { category: "Event Filter", description: "Toggle all event types in a category", direction: "Service → Listeners", domain: "eventFilter", services: "EventFilterService" },

	// ── Event Notify Domain ─────────────────────────────────
	"eventNotify.loaded":  { category: "Event Notify", description: "Event notify state was loaded from storage", direction: "Service → Listeners", domain: "eventNotify", services: "EventNotificationService" },
	"eventNotify.changed": { category: "Event Notify", description: "Event notification list was updated", direction: "Service → Listeners", domain: "eventNotify", services: "EventNotificationService" },
	"eventNotify.toggle":  { category: "Event Notify", description: "Toggle a single event type's notification", direction: "Service → Listeners", domain: "eventNotify", services: "EventNotificationService" },
	"eventNotify.fired":   { category: "Event Notify", description: "A notified event fired (triggers Notice popup)", direction: "Service → Listeners", domain: "eventNotify", services: "EventNotificationService" },
} satisfies Record<keyof FlowtiEventMap, EventCatalogMeta>;

// ─────────────────────────────────────────────────────────────
// Derived exports
// ─────────────────────────────────────────────────────────────

/**
 * Complete runtime catalog of all Flowti events.
 * Derived from the type-checked internal catalog data.
 */
export const EVENT_CATALOG: EventCatalogEntry[] = (
	Object.keys(CATALOG_DATA) as Array<keyof typeof CATALOG_DATA>
).map((type) => ({ type, ...CATALOG_DATA[type] }));

/**
 * Lookup map for O(1) access by event type.
 */
const CATALOG_MAP = new Map<string, EventCatalogEntry>(
	EVENT_CATALOG.map((entry) => [entry.type, entry])
);

/**
 * Returns all catalog entries for a given category.
 */
export function getEventsByCategory(category: string): EventCatalogEntry[] {
	return EVENT_CATALOG.filter((entry) => entry.category === category);
}

/**
 * Returns the category for a given event type, or undefined if not found.
 */
export function getEventCategory(type: string): string | undefined {
	return CATALOG_MAP.get(type)?.category;
}

/**
 * Returns the catalog entry for a given event type, or undefined if not found.
 */
export function getEventEntry(type: string): EventCatalogEntry | undefined {
	return CATALOG_MAP.get(type);
}
