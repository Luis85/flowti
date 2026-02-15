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
// Shared constants
// ─────────────────────────────────────────────────────────────

/**
 * Event type prefixes considered internal/infrastructure.
 * Services that use wildcard listeners should skip events matching these
 * prefixes to avoid infinite loops and unnecessary processing.
 *
 * Individual services may extend this list with their own namespace prefix
 * (e.g., `["ingestion."]`) via `isSkippedEvent()`.
 */
export const INTERNAL_EVENT_PREFIXES = [
	"log.",
	"error.",
	"plugin.",
	"service.",
	"command.",
	"view.",
	"settings.",
	"ui.",
] as const;

/**
 * Returns true if the given event type should be skipped by wildcard listeners.
 * @param type - The event type string to check.
 * @param extraPrefixes - Additional prefixes to skip (e.g., the service's own namespace).
 */
export function isSkippedEvent(type: string, extraPrefixes?: readonly string[]): boolean {
	for (const prefix of INTERNAL_EVENT_PREFIXES) {
		if (type.startsWith(prefix)) return true;
	}
	if (extraPrefixes) {
		for (const prefix of extraPrefixes) {
			if (type.startsWith(prefix)) return true;
		}
	}
	return false;
}

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
 * Stability level for an event contract.
 */
export type EventStability = "stable" | "evolving" | "experimental";

/**
 * Visibility level indicating the intended audience.
 */
export type EventVisibility = "user-facing" | "system-internal";

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
	/** Contract stability (defaults to "stable" if omitted) */
	stability?: EventStability;
	/** Intended audience (defaults to "system-internal" if omitted) */
	visibility?: EventVisibility;
	/** Free-form tags for filtering and grouping */
	tags?: string[];
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
	/** Contract stability */
	stability: EventStability;
	/** Intended audience */
	visibility: EventVisibility;
	/** Free-form tags for filtering and grouping */
	tags: string[];
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
	"Watch Rules",
	"File Processing",
	"Transforms",
	"Data Exchange",
	"Documentation",
	"UI Commands",
	"Hub",
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
	"plugin.loading":   { category: "Plugin Lifecycle", description: "Plugin starts loading", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"plugin.loaded":    { category: "Plugin Lifecycle", description: "Plugin has fully loaded", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"plugin.ready":     { category: "Plugin Lifecycle", description: "Plugin is ready (layout ready, user loaded)", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"plugin.unloading": { category: "Plugin Lifecycle", description: "Plugin starts unloading", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"plugin.unloaded":  { category: "Plugin Lifecycle", description: "Plugin has fully unloaded", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },

	// ── Service Lifecycle ────────────────────────────────────
	"service.registered":  { category: "Service Lifecycle", description: "A service was registered with the container", direction: "Internal", domain: "infrastructure", services: "ServiceContainer", tags: ["system"] },
	"service.initialized": { category: "Service Lifecycle", description: "A service completed initialization", direction: "Internal", domain: "infrastructure", services: "ServiceContainer", tags: ["system"] },
	"service.disposed":    { category: "Service Lifecycle", description: "A service was disposed", direction: "Internal", domain: "infrastructure", services: "ServiceContainer", tags: ["system"] },
	"service.error":       { category: "Service Lifecycle", description: "A service failed to initialize", direction: "Internal", domain: "infrastructure", services: "ServiceContainer", tags: ["system"] },

	// ── Commands ─────────────────────────────────────────────
	"command.registered": { category: "Commands", description: "A command was registered", direction: "Internal", domain: "infrastructure", services: "CommandRegistry", tags: ["system"] },
	"command.executing":  { category: "Commands", description: "A command started executing", direction: "Internal", domain: "infrastructure", services: "CommandRegistry", tags: ["system"] },
	"command.executed":   { category: "Commands", description: "A command completed successfully", direction: "Internal", domain: "infrastructure", services: "CommandRegistry", tags: ["system"] },
	"command.failed":     { category: "Commands", description: "A command failed", direction: "Internal", domain: "infrastructure", services: "CommandRegistry", tags: ["system"] },

	// ── Views ────────────────────────────────────────────────
	"view.registered": { category: "Views", description: "A view was registered", direction: "Internal", domain: "infrastructure", services: "ViewRegistry", tags: ["system"] },

	// ── Logging ──────────────────────────────────────────────
	"log.entry": { category: "Logging", description: "A log entry was created", direction: "Service → Listeners", domain: "infrastructure", services: "LoggerService", tags: ["system"] },
	"log.error": { category: "Logging", description: "An error was logged", direction: "Service → Listeners", domain: "infrastructure", services: "LoggerService", tags: ["system"] },

	// ── Errors ───────────────────────────────────────────────
	"error.occurred": { category: "Errors", description: "An error occurred", direction: "Service → Listeners", domain: "infrastructure", services: "ErrorService", tags: ["system"] },
	"error.handled":  { category: "Errors", description: "An error was handled/recovered", direction: "Service → Listeners", domain: "infrastructure", services: "ErrorService", tags: ["system"] },

	// ── File Requests ────────────────────────────────────────
	"file.create.request": { category: "File Requests", description: "Request to create a new file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.read.request":   { category: "File Requests", description: "Request to read a file's content", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.update.request": { category: "File Requests", description: "Request to update a file's content", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.delete.request": { category: "File Requests", description: "Request to delete a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.move.request":   { category: "File Requests", description: "Request to move a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.rename.request": { category: "File Requests", description: "Request to rename a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },

	// ── File Responses ───────────────────────────────────────
	"file.create.response": { category: "File Responses", description: "Response after file creation", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.read.response":   { category: "File Responses", description: "Response after file read", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.update.response": { category: "File Responses", description: "Response after file update", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.delete.response": { category: "File Responses", description: "Response after file deletion", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.move.response":   { category: "File Responses", description: "Response after file move", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.rename.response": { category: "File Responses", description: "Response after file rename", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── File Notifications ───────────────────────────────────
	"file.created":  { category: "File Notifications", description: "A file was created in the vault", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.modified": { category: "File Notifications", description: "A file was modified", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.deleted":  { category: "File Notifications", description: "A file was deleted", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.renamed":  { category: "File Notifications", description: "A file was renamed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── Folder Notifications ─────────────────────────────────
	"folder.created": { category: "Folder Notifications", description: "A folder was created", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"folder.deleted": { category: "Folder Notifications", description: "A folder was deleted", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"folder.renamed": { category: "Folder Notifications", description: "A folder was renamed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── Event-File Notifications ─────────────────────────────
	"event.file.triggered": { category: "Event-File Notifications", description: "A file with type=\"Event\" frontmatter triggered a vault action", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── Frontmatter Requests ─────────────────────────────────
	"frontmatter.get.request":    { category: "Frontmatter Requests", description: "Request to read frontmatter", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"frontmatter.update.request": { category: "Frontmatter Requests", description: "Request to merge frontmatter fields", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"frontmatter.set.request":    { category: "Frontmatter Requests", description: "Request to replace entire frontmatter", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },

	// ── Frontmatter Responses ────────────────────────────────
	"frontmatter.get.response":    { category: "Frontmatter Responses", description: "Response after frontmatter read", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"frontmatter.update.response": { category: "Frontmatter Responses", description: "Response after frontmatter update", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"frontmatter.set.response":    { category: "Frontmatter Responses", description: "Response after frontmatter set", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── Workspace ────────────────────────────────────────────
	"workspace.leaf-changed":   { category: "Workspace", description: "The active leaf (tab/view) changed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"workspace.file-opened":    { category: "Workspace", description: "A file was opened in the editor", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"workspace.layout-changed": { category: "Workspace", description: "The workspace layout changed", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── Metadata ─────────────────────────────────────────────
	"metadata.changed":  { category: "Metadata", description: "File metadata (frontmatter, tags, links) was updated", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"metadata.resolved": { category: "Metadata", description: "All metadata references in the vault resolved", direction: "EventBridge → Services", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

	// ── User Domain ──────────────────────────────────────────
	"user.created": { category: "User", description: "A new user profile was created", direction: "Service → Listeners", domain: "user", services: "UserService" },
	"user.updated": { category: "User", description: "A user profile was updated", direction: "Service → Listeners", domain: "user", services: "UserService" },
	"user.loaded":  { category: "User", description: "A user profile was loaded from storage", direction: "Service → Listeners", domain: "user", services: "UserService" },

	// ── Settings Domain ──────────────────────────────────────
	"settings.changed":                 { category: "Settings", description: "Plugin settings were changed", direction: "Service → Listeners", domain: "settings", services: "SettingsService" },
	"settings.loaded":                  { category: "Settings", description: "Plugin settings were loaded", direction: "Service → Listeners", domain: "settings", services: "SettingsService" },
	"settings.updateCatalogCategories": { category: "Settings", description: "Update catalog category order/visibility", direction: "View → Plugin", domain: "settings", services: "EventCatalogView" },
	"settings.updateCollapsedCategories": { category: "Settings", description: "Update collapsed category state", direction: "View → Plugin", domain: "settings", services: "EventCatalogView" },
	"settings.updateShowSystemEvents":   { category: "Settings", description: "Toggle system events visibility", direction: "View → Plugin", domain: "settings", services: "EventCatalogView" },
	"settings.updateCatalogDomains":     { category: "Settings", description: "Update domain visibility in catalog", direction: "View → Plugin", domain: "settings", services: "EventCatalogView", tags: ["system"] },
	"settings.updateCatalogServices":    { category: "Settings", description: "Update service visibility in catalog", direction: "View → Plugin", domain: "settings", services: "EventCatalogView", tags: ["system"] },

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

	// ── Watch Rules Domain ──────────────────────────────────
	"subscription.loaded":  { category: "Watch Rules", description: "Watcher state was loaded from storage", direction: "Service → Listeners", domain: "subscription", services: "SubscriptionService" },
	"subscription.created": { category: "Watch Rules", description: "A new watcher was created", direction: "Service → Listeners", domain: "subscription", services: "SubscriptionService" },
	"subscription.updated": { category: "Watch Rules", description: "A watcher was updated", direction: "Service → Listeners", domain: "subscription", services: "SubscriptionService" },
	"subscription.deleted": { category: "Watch Rules", description: "A watcher was removed", direction: "Service → Listeners", domain: "subscription", services: "SubscriptionService" },
	"subscription.create":  { category: "Watch Rules", description: "Command to create a new watcher", direction: "View → Plugin", domain: "subscription", services: "SubscriptionService" },
	"subscription.update":  { category: "Watch Rules", description: "Command to update a watcher", direction: "View → Plugin", domain: "subscription", services: "SubscriptionService" },
	"subscription.remove":  { category: "Watch Rules", description: "Command to remove a watcher", direction: "View → Plugin", domain: "subscription", services: "SubscriptionService" },
	"subscription.matched": { category: "Watch Rules", description: "An event matched a watcher's filters", direction: "Service → Listeners", domain: "subscription", services: "SubscriptionService" },
	"subscription.refresh": { category: "Watch Rules", description: "Request to re-emit current watcher state", direction: "View → Plugin", domain: "subscription", services: "SubscriptionService" },

	// ── File Processing Domain ──────────────────────────────
	"ingestion.job.queued":      { category: "File Processing", description: "A file was queued for processing", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.job.started":     { category: "File Processing", description: "File processing started", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.job.completed":   { category: "File Processing", description: "File processing completed successfully", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.job.failed":      { category: "File Processing", description: "File processing failed (may retry)", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.batch.started":   { category: "File Processing", description: "A batch of files started processing", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.batch.completed": { category: "File Processing", description: "A batch of files finished processing", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.stats":           { category: "File Processing", description: "Current file processing statistics", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"ingestion.recovery.completed": { category: "File Processing", description: "Pending files recovered from storage after a crash", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"catchup.started":           { category: "File Processing", description: "Catch-up scanning started", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"catchup.file.found":        { category: "File Processing", description: "A file was found during catch-up that needs processing", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },
	"catchup.completed":         { category: "File Processing", description: "Catch-up scanning completed", direction: "Service → Listeners", domain: "ingestion", services: "IngestionService" },

	// ── Transforms Domain ───────────────────────────────────
	"eventDefinition.loaded":  { category: "Transforms", description: "Transform state was loaded from storage", direction: "Service → Listeners", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.created": { category: "Transforms", description: "A new transform was created", direction: "Service → Listeners", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.updated": { category: "Transforms", description: "A transform was updated", direction: "Service → Listeners", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.deleted": { category: "Transforms", description: "A transform was removed", direction: "Service → Listeners", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.create":  { category: "Transforms", description: "Command to create a new transform", direction: "View → Plugin", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.update":  { category: "Transforms", description: "Command to update a transform", direction: "View → Plugin", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.remove":  { category: "Transforms", description: "Command to remove a transform", direction: "View → Plugin", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.refresh": { category: "Transforms", description: "Request to re-emit current transform state", direction: "View → Plugin", domain: "eventDefinition", services: "EventDefinitionService" },
	"eventDefinition.matched": { category: "Transforms", description: "A transform matched and emitted an output event", direction: "Service → Listeners", domain: "eventDefinition", services: "EventDefinitionService" },

	// ── Data Exchange Domain ────────────────────────────────
	"dataExchange.import.execute":   { category: "Data Exchange", description: "Command to start a CSV import", direction: "View → Plugin", domain: "dataExchange", services: "DataExchangeService", tags: ["system"] },
	"dataExchange.import.started":   { category: "Data Exchange", description: "Import operation has started", direction: "Service → Listeners", domain: "dataExchange", services: "ImportService", tags: ["system"] },
	"dataExchange.import.progress":  { category: "Data Exchange", description: "Progress update during import", direction: "Service → Listeners", domain: "dataExchange", services: "ImportService", tags: ["system"] },
	"dataExchange.import.completed": { category: "Data Exchange", description: "Import operation completed successfully", direction: "Service → Listeners", domain: "dataExchange", services: "ImportService" },
	"dataExchange.import.failed":    { category: "Data Exchange", description: "Import operation failed", direction: "Service → Listeners", domain: "dataExchange", services: "ImportService" },
	"dataExchange.export.execute":   { category: "Data Exchange", description: "Command to start a data export", direction: "View → Plugin", domain: "dataExchange", services: "DataExchangeService", tags: ["system"] },
	"dataExchange.export.started":   { category: "Data Exchange", description: "Export operation has started", direction: "Service → Listeners", domain: "dataExchange", services: "ExportService", tags: ["system"] },
	"dataExchange.export.completed": { category: "Data Exchange", description: "Export operation completed successfully", direction: "Service → Listeners", domain: "dataExchange", services: "ExportService" },
	"dataExchange.export.failed":    { category: "Data Exchange", description: "Export operation failed", direction: "Service → Listeners", domain: "dataExchange", services: "ExportService" },
	"dataExchange.pipeline.execute":         { category: "Data Exchange", description: "Command to start a multi-import pipeline", direction: "View → Plugin", domain: "dataExchange", services: "DataExchangeService", tags: ["system"] },
	"dataExchange.pipeline.started":         { category: "Data Exchange", description: "Pipeline import started", direction: "Service → Listeners", domain: "dataExchange", services: "DataExchangeService", tags: ["system"] },
	"dataExchange.pipeline.sourceCompleted": { category: "Data Exchange", description: "One source completed within a pipeline", direction: "Service → Listeners", domain: "dataExchange", services: "DataExchangeService", tags: ["system"] },
	"dataExchange.pipeline.completed":       { category: "Data Exchange", description: "Multi-import pipeline completed", direction: "Service → Listeners", domain: "dataExchange", services: "DataExchangeService" },
	"dataExchange.pipeline.failed":          { category: "Data Exchange", description: "Multi-import pipeline failed", direction: "Service → Listeners", domain: "dataExchange", services: "DataExchangeService" },
	"dataExchange.config.changed":   { category: "Data Exchange", description: "Saved import/export config created or deleted", direction: "Service → Listeners", domain: "dataExchange", services: "DataExchangeService", tags: ["system"] },

	// ── Documentation ────────────────────────────────────────
	"doc.create":  { category: "Documentation", description: "Command to create a documentation file", direction: "View → Plugin", domain: "docs", services: "DocService", tags: ["system"] },
	"doc.created": { category: "Documentation", description: "Documentation file was created or updated", direction: "Service → Listeners", domain: "docs", services: "DocService" },
	"doc.exists":  { category: "Documentation", description: "Documentation file already exists (no upsert)", direction: "Service → Listeners", domain: "docs", services: "DocService", tags: ["system"] },
	"doc.failed":  { category: "Documentation", description: "Documentation file creation failed", direction: "Service → Listeners", domain: "docs", services: "DocService" },
	"doc.delete":  { category: "Documentation", description: "Command to delete a documentation file", direction: "View → Plugin", domain: "docs", services: "DocService", tags: ["system"] },
	"doc.deleted": { category: "Documentation", description: "Documentation file was deleted", direction: "Service → Listeners", domain: "docs", services: "DocService", tags: ["system"] },

	// ── UI Commands ──────────────────────────────────────────
	"ui.openEventCatalog":        { category: "UI Commands", description: "Open the Event Catalog view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openEventLog":            { category: "UI Commands", description: "Open the Event Log view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openComponentShowcase":   { category: "UI Commands", description: "Open the Component Showcase", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openDataExchangeHub":     { category: "UI Commands", description: "Open the Data Exchange Hub", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openSubscriptionManager": { category: "UI Commands", description: "Open the Watcher Manager modal", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openCsvImport":           { category: "UI Commands", description: "Open CSV import view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openExport":              { category: "UI Commands", description: "Open export view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.opened":                  { category: "UI Commands", description: "A UI view or modal was opened", direction: "Internal", domain: "ui", services: "UiCommandService", tags: ["system"] },

	// ── Hub ──────────────────────────────────────────────────
	"hub.opened":      { category: "Hub", description: "A hub view was opened", direction: "View → Plugin", domain: "hub", services: "BaseHubView", tags: ["system"] },
	"hub.closed":      { category: "Hub", description: "A hub view was closed", direction: "View → Plugin", domain: "hub", services: "BaseHubView", tags: ["system"] },
	"hub.tab.changed": { category: "Hub", description: "The active tab changed within a hub", direction: "View → Plugin", domain: "hub", services: "BaseHubView", tags: ["system"] },
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
).map((type) => {
	const meta: EventCatalogMeta = CATALOG_DATA[type];
	return {
		type,
		...meta,
		stability: meta.stability ?? "stable",
		visibility: meta.visibility ?? "system-internal",
		tags: meta.tags ?? [],
	};
});

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

/**
 * Domain names that should be treated as system domains,
 * even if they only appear in discovered (non-static) events.
 * Includes all domains from the static catalog plus manually registered ones.
 */
export const SYSTEM_DOMAINS: ReadonlySet<string> = new Set([
	...EVENT_CATALOG.map((e) => e.domain),
	"Types",
]);
