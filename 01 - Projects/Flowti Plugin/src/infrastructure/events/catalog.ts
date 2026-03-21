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
	"perf.",
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
	"Inbox",
	"Session",
	"Nudge",
	"Signal",
	"Capture",
	"Train",
	"Canvas",
	"Analytics",
	"Onboarding",
	"Performance",
	"Notification",
	"Modal",
	"Catalog",
	"Journey Builder",
	"Test Management",
	"Feature Lifecycle",
	"Process",
	"Agent",
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
	"plugin.loaded":    { category: "Plugin Lifecycle", description: "Sync shell ready (onload); domain work follows after layout", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"plugin.deferred.start": { category: "Plugin Lifecycle", description: "workspace.onLayoutReady — deferred startup (domain services, hubs)", direction: "Plugin → Listeners", domain: "infrastructure", services: "Plugin", tags: ["system"] },
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
	"command.execute.request": { category: "Commands", description: "Command execution requested from UI", direction: "Internal", domain: "infrastructure", services: "CommandRegistry", tags: ["system"] },

	// ── Views ────────────────────────────────────────────────
	"view.registered": { category: "Views", description: "A view was registered", direction: "Internal", domain: "infrastructure", services: "ViewRegistry", tags: ["system"] },

	// ── Logging ──────────────────────────────────────────────
	"log.entry": { category: "Logging", description: "A log entry was created", direction: "Service → Listeners", domain: "infrastructure", services: "LoggerService", tags: ["system"] },
	"log.error": { category: "Logging", description: "An error was logged", direction: "Service → Listeners", domain: "infrastructure", services: "LoggerService", tags: ["system"] },

	// ── Errors ───────────────────────────────────────────────
	"error.occurred": { category: "Errors", description: "An error occurred", direction: "Service → Listeners", domain: "infrastructure", services: "ErrorService", tags: ["system"] },

	// ── File Requests ────────────────────────────────────────
	"file.create.request": { category: "File Requests", description: "Request to create a new file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.read.request":   { category: "File Requests", description: "Request to read a file's content", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.update.request": { category: "File Requests", description: "Request to update a file's content", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.delete.request": { category: "File Requests", description: "Request to delete a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.move.request":   { category: "File Requests", description: "Request to move a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.rename.request": { category: "File Requests", description: "Request to rename a file", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"file.list.request":   { category: "File Requests", description: "Request to list files in a folder", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },
	"folder.ensure.request": { category: "File Requests", description: "Request to ensure a folder exists", direction: "Service → EventBridge", domain: "infrastructure", services: "FileSystemClient", tags: ["system"] },

	// ── File Responses ───────────────────────────────────────
	"file.create.response": { category: "File Responses", description: "Response after file creation", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.read.response":   { category: "File Responses", description: "Response after file read", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.update.response": { category: "File Responses", description: "Response after file update", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.delete.response": { category: "File Responses", description: "Response after file deletion", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.move.response":   { category: "File Responses", description: "Response after file move", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.rename.response": { category: "File Responses", description: "Response after file rename", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"file.list.response":   { category: "File Responses", description: "Response after listing folder contents", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },
	"folder.ensure.response": { category: "File Responses", description: "Response after ensuring folder exists", direction: "EventBridge → Service", domain: "infrastructure", services: "EventBridge", tags: ["system"] },

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
	"settings.updateInboxEnabledSources": { category: "Settings", description: "Update inbox notification source events", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateCustomSessionTypes": { category: "Settings", description: "Update custom session type configurations", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateCustomOutputTemplates": { category: "Settings", description: "Update custom output templates for session artifacts", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateSessionActivityFilter": { category: "Settings", description: "Update session activity filter folders", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateInboxWatchedFolders": { category: "Settings", description: "Update inbox watched folder configuration", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateInboxTriageTargetFolder": { category: "Settings", description: "Update inbox triage target folder path", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateDefaultTrainDuration": { category: "Settings", description: "Update default train duration preference", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateTrainFolder": { category: "Settings", description: "Update train folder path", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateTrainAutoOpenTimeline": { category: "Settings", description: "Update auto-open timeline preference", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateTrainMaxThoughts":  { category: "Settings", description: "Update max thoughts per train", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateTrainCanvasEnabled": { category: "Settings", description: "Toggle train canvas auto-generation", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateTrainCanvasAutoOpen": { category: "Settings", description: "Toggle auto-open canvas on train start", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateAnalyticsFolder": { category: "Settings", description: "Update analytics folder path", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateJourneyFolder": { category: "Settings", description: "Update journey builder folder path", direction: "View → Plugin", domain: "settings", services: "FlowtiSettingTab", tags: ["system"] },
	"settings.updateUserHubConfig":  { category: "Settings", description: "Update User Hub dashboard configuration", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateInboxAutoRoutingEnabled": { category: "Settings", description: "Toggle inbox auto-routing", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.updateInboxRoutingRules": { category: "Settings", description: "Update inbox type-based routing rules", direction: "View → Plugin", domain: "settings", services: "UserHubPreferences", tags: ["system"] },
	"settings.saveFailed":             { category: "Settings", description: "Settings persistence failed", direction: "Service → Listeners", domain: "settings", services: "SettingsService", tags: ["system"] },

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
	"dataExchange.export.progress":  { category: "Data Exchange", description: "Per-file progress during export", direction: "Service → Listeners", domain: "dataExchange", services: "ExportService", tags: ["system"] },
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
	"ui.openDataExchangeHub":     { category: "UI Commands", description: "Open the Data Exchange Hub", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openUserHub":             { category: "UI Commands", description: "Open the User Hub", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openSubscriptionManager": { category: "UI Commands", description: "Open the Watcher Manager modal", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openCsvImport":           { category: "UI Commands", description: "Open CSV import view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openExport":              { category: "UI Commands", description: "Open export view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openQuickCapture":        { category: "UI Commands", description: "Open the Quick Capture modal", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.captureIdea":             { category: "UI Commands", description: "Capture an idea directly from User Hub", direction: "View → Plugin", domain: "ui", services: "CaptureService", tags: ["system"] },
	"ui.startTrain":              { category: "UI Commands", description: "Start a Train of Thoughts serial capture session", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openTrainView":           { category: "UI Commands", description: "Open the Train Main View", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.toggleTrainTimeline":     { category: "UI Commands", description: "Toggle the Train Timeline Sidebar", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.resumeTrain":             { category: "UI Commands", description: "Resume the active paused train", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.completeTrain":           { category: "UI Commands", description: "Complete the active running/paused train", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openTrainCanvas":         { category: "UI Commands", description: "Open canvas for the active train", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openTrainTimeline":       { category: "UI Commands", description: "Open train timeline sidebar for the active train", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openTrainHub":            { category: "UI Commands", description: "Open the Train Hub view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.startCanvasSession":      { category: "UI Commands", description: "Start a guided canvas session from a template", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openAnalyticsHub":        { category: "UI Commands", description: "Open the Analytics Hub view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.openTestManagementHub":   { category: "UI Commands", description: "Open the Test Management Hub view", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.runJourney":              { category: "UI Commands", description: "Run a journey definition from the vault", direction: "View → Plugin", domain: "journey-executor", services: "JourneyExecutorService" },
	"ui.opened":                  { category: "UI Commands", description: "A UI view or modal was opened", direction: "Internal", domain: "ui", services: "UiCommandService", tags: ["system"] },
	"ui.navigateTab":             { category: "UI Commands", description: "Navigate to a specific tab within a hub view", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.openFile":                { category: "UI Commands", description: "Open a file in the vault", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.openSessionWorkspace":    { category: "UI Commands", description: "Open a session workspace view", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.openSessionWorkspaceSidebar": { category: "UI Commands", description: "Open session workspace in sidebar", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.createExport":            { category: "UI Commands", description: "Create a new export configuration", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.createImport":            { category: "UI Commands", description: "Create a new import configuration", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.createPropertyDoc":       { category: "UI Commands", description: "Create a property documentation", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.createSession":           { category: "UI Commands", description: "Create a new session", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.deleteExport":            { category: "UI Commands", description: "Delete an export configuration", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.deleteImport":            { category: "UI Commands", description: "Delete an import configuration", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.deleteTrain":             { category: "UI Commands", description: "Delete a train", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.editExport":              { category: "UI Commands", description: "Edit an export configuration", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.editImport":              { category: "UI Commands", description: "Edit an import configuration", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.exportCsv":               { category: "UI Commands", description: "Export data as CSV", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.exportTab":               { category: "UI Commands", description: "Export data as tab-delimited", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.importCanvas":            { category: "UI Commands", description: "Import from Obsidian canvas", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.importCsv":               { category: "UI Commands", description: "Import data from CSV", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.inboxAction":             { category: "UI Commands", description: "Perform an action on an inbox item", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.inboxItemSelected":       { category: "UI Commands", description: "An inbox item was selected", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.openInstaller":           { category: "UI Commands", description: "Open the installer wizard", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.pauseTrain":              { category: "UI Commands", description: "Pause an active train", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.resumeSession":           { category: "UI Commands", description: "Resume a paused session", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.runCanvasImport":         { category: "UI Commands", description: "Execute a canvas import", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.runExport":               { category: "UI Commands", description: "Execute an export operation", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.runImport":               { category: "UI Commands", description: "Execute an import operation", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectCanvas":            { category: "UI Commands", description: "Select a canvas config for viewing", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectExport":            { category: "UI Commands", description: "Select an export config for viewing", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectImport":            { category: "UI Commands", description: "Select an import config for viewing", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectPipeline":          { category: "UI Commands", description: "Select a data pipeline", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectProperty":          { category: "UI Commands", description: "Select a property for viewing", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectReport":            { category: "UI Commands", description: "Select a report for viewing", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.selectType":              { category: "UI Commands", description: "Select a type for viewing", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.sessionSelected":         { category: "UI Commands", description: "A session was selected in the list", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.signalSync":              { category: "UI Commands", description: "Trigger signal synchronization", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },
	"ui.syncSignal":              { category: "UI Commands", description: "Sync a signal (alternate event name)", direction: "View → Plugin", domain: "ui", services: "Handler layer", tags: ["system"] },

	// ── Hub ──────────────────────────────────────────────────
	"hub.opened":      { category: "Hub", description: "A hub view was opened", direction: "View → Plugin", domain: "hub", services: "BaseHubView", tags: ["system"] },
	"hub.closed":      { category: "Hub", description: "A hub view was closed", direction: "View → Plugin", domain: "hub", services: "BaseHubView", tags: ["system"] },
	"hub.tab.changed": { category: "Hub", description: "The active tab changed within a hub", direction: "View → Plugin", domain: "hub", services: "BaseHubView", tags: ["system"] },
	"hub.navigate":    { category: "Hub", description: "Cross-hub navigation request", direction: "Service → Listeners", domain: "hub", services: "HubRegistry", tags: ["system"] },

	// ── Inbox ─────────────────────────────────────────────────
	"inbox.loaded":       { category: "Inbox", description: "Inbox state loaded from storage", direction: "Service → Listeners", domain: "inbox", services: "InboxService", tags: ["system"] },
	"inbox.itemAdded":    { category: "Inbox", description: "New item added to inbox", direction: "Service → Listeners", domain: "inbox", services: "InboxService", tags: [] },
	"inbox.itemsChanged": { category: "Inbox", description: "Inbox items changed (read/dismiss/clear)", direction: "Service → Listeners", domain: "inbox", services: "InboxService", tags: ["system"] },
	"inbox.refresh":      { category: "Inbox", description: "Request re-emit of inbox state", direction: "View → Plugin", domain: "inbox", services: "InboxService", tags: ["system"] },
	"inbox.vaultFolder.noteDetected": { category: "Inbox", description: "An untyped note was detected in a watched vault folder", direction: "Service → Listeners", domain: "inbox", services: "InboxService" },
	"inbox.vaultFolder.noteTriaged": { category: "Inbox", description: "A vault folder inbox item was triaged (frontmatter applied, optionally routed)", direction: "Service → Listeners", domain: "inbox", services: "InboxService" },
	"inbox.file.routed":  { category: "Inbox", description: "A file was auto-routed to a target folder based on its type", direction: "Service → Listeners", domain: "inbox", services: "InboxService" },

	// ── Session ───────────────────────────────────────────────
	"session.create":          { category: "Session", description: "Command to create a new session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.start":           { category: "Session", description: "Command to start a session timer", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.pause":           { category: "Session", description: "Command to pause an active session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.resume":          { category: "Session", description: "Command to resume a paused session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.complete":        { category: "Session", description: "Command to complete a session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.archive":         { category: "Session", description: "Command to archive a completed session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.delete":          { category: "Session", description: "Command to delete a session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.refresh":         { category: "Session", description: "Request re-emit of session state", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.created":         { category: "Session", description: "A new session was created", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.started":         { category: "Session", description: "Session timer was started", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.paused":          { category: "Session", description: "Session was paused", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.resumed":         { category: "Session", description: "Session was resumed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.completed":       { category: "Session", description: "Session was completed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.archived":        { category: "Session", description: "Session was archived", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.deleted":         { category: "Session", description: "Session was deleted", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.loaded":          { category: "Session", description: "Session state loaded from storage", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.timer.tick":      { category: "Session", description: "Timer tick with remaining/elapsed time", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.timer.completed": { category: "Session", description: "Session timer reached zero", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.artifact.added":  { category: "Session", description: "Artifact recorded during active session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.goal.add":        { category: "Session", description: "Command: add a goal to a session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.goal.toggle":     { category: "Session", description: "Command: toggle a goal's completed state", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.goal.remove":     { category: "Session", description: "Command: remove a goal from a session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.goal.added":      { category: "Session", description: "Goal added to session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.goal.toggled":    { category: "Session", description: "Goal completed state toggled", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.goal.removed":    { category: "Session", description: "Goal removed from session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.goal.reorder":    { category: "Session", description: "Command: reorder goals", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.goal.reordered":  { category: "Session", description: "Goals reordered in session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.duration.update":  { category: "Session", description: "Command: update session duration", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.duration.updated": { category: "Session", description: "Session duration updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.notes.update":    { category: "Session", description: "Command: update session notes", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.notes.updated":   { category: "Session", description: "Session notes updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.notesFile.set":    { category: "Session", description: "Command: set session notes file", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.notesFile.updated": { category: "Session", description: "Session notes file path updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.notes.synced":     { category: "Session", description: "Session notes file synced to disk", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.notes.syncFailed": { category: "Session", description: "Session notes file sync failed", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.notes.reverseSynced": { category: "Session", description: "Session state updated from notes file edits", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.canvasFile.set":    { category: "Session", description: "Command: set session canvas file", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.canvasFile.updated": { category: "Session", description: "Session canvas file path updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.link.add":        { category: "Session", description: "Command: add a link to a session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.link.remove":     { category: "Session", description: "Command: remove a link from a session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.link.added":      { category: "Session", description: "Link added to session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.link.removed":    { category: "Session", description: "Link removed from session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.activity.tracked": { category: "Session", description: "Vault file event tracked in session activity log", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.activity.filter.updated": { category: "Session", description: "Per-session activity folder filter updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.paths.updated":   { category: "Session", description: "Session file/folder paths reconciled after rename", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.context.bind":        { category: "Session", description: "Command: bind a context to a session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.context.unbind":      { category: "Session", description: "Command: unbind a context from a session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.context.changeType":  { category: "Session", description: "Command: change a context binding type", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.context.bound":       { category: "Session", description: "Context binding added to session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.context.unbound":     { category: "Session", description: "Context binding removed from session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.context.typeChanged": { category: "Session", description: "Context binding type changed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.decision.record":   { category: "Session", description: "Command: record a decision during session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.decision.remove":   { category: "Session", description: "Command: remove a decision from session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.decision.recorded": { category: "Session", description: "Decision recorded in session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.decision.removed":  { category: "Session", description: "Decision removed from session", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.state.save":      { category: "Session", description: "Command: capture workspace state for session", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.state.saved":     { category: "Session", description: "Workspace state captured and persisted", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.state.restore":   { category: "Session", description: "Command: restore workspace state for session", direction: "Service → Listeners", domain: "session", services: "SessionService", tags: ["system"] },
	"session.state.restored":  { category: "Session", description: "Workspace state restored in workspace", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.output.generate":  { category: "Session", description: "Command: generate output artifact from session", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.output.generated": { category: "Session", description: "Output artifact generated and persisted", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.type.configure":  { category: "Session", description: "Command: configure a session type", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.type.configured": { category: "Session", description: "Session type config updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.type.create":     { category: "Session", description: "Command: create a custom session type", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.type.created":    { category: "Session", description: "Custom session type created", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.template.exported": { category: "Session", description: "A session template was exported to JSON", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.template.imported": { category: "Session", description: "A session template was imported from JSON", direction: "Service → Listeners", domain: "session", services: "SessionService" },

	// ── Session v2: Intent, Energy, Lifecycle (ADR-031) ──────
	"session.intent.set":         { category: "Session", description: "Command: set session intent (prepared/paused)", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.intent.updated":     { category: "Session", description: "Session intent was set or updated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.mode.set":           { category: "Session", description: "Session execution mode was set", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.energy.set":         { category: "Session", description: "Command: set session energy level", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.energy.changed":     { category: "Session", description: "Session energy level changed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.task.add":           { category: "Session", description: "Command: add task to execution plan", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.task.toggle":        { category: "Session", description: "Command: toggle task completed state", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.task.remove":        { category: "Session", description: "Command: remove task from execution plan", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.task.reorder":       { category: "Session", description: "Command: reorder execution tasks", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.task.added":         { category: "Session", description: "Execution task added to session plan", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.task.completed":     { category: "Session", description: "Execution task marked completed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.task.removed":       { category: "Session", description: "Execution task removed from session plan", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.task.reordered":     { category: "Session", description: "Execution tasks reordered", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.reflection.add":     { category: "Session", description: "Command: add reflection entry to session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.reflection.remove":  { category: "Session", description: "Command: remove reflection entry from session", direction: "View → Plugin", domain: "session", services: "SessionService", tags: ["system"] },
	"session.reflection.added":   { category: "Session", description: "Structured reflection entry added", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.reflection.removed": { category: "Session", description: "Structured reflection entry removed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.review.started":     { category: "Session", description: "Session entered reviewing state", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.closure.started":    { category: "Session", description: "Closure ritual began (reviewing state)", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.closure.completed":  { category: "Session", description: "Closure ritual completed", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.reflection.capReached": { category: "Session", description: "Reflection cap reached (MAX_REFLECTIONS)", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.task.capReached":    { category: "Session", description: "Execution task cap reached (MAX_EXECUTION_TASKS)", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.overload.detected":  { category: "Session", description: "Cognitive overload thresholds exceeded", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.documentation.generated": { category: "Session", description: "Session completion summary document generated", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.feature.bind":    { category: "Session", description: "Command to bind a session to a feature", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.feature.bound":   { category: "Session", description: "Session was bound to a feature", direction: "Service → Listeners", domain: "session", services: "SessionService" },
	"session.feature.unbind":  { category: "Session", description: "Command to unbind a session from its feature", direction: "View → Plugin", domain: "session", services: "SessionService" },
	"session.feature.unbound": { category: "Session", description: "Session was unbound from its feature", direction: "Service → Listeners", domain: "session", services: "SessionService" },

	// ── Nudge ─────────────────────────────────────────────────
	"nudge.configure":  { category: "Nudge", description: "Command to add or update a nudge config", direction: "View → Plugin", domain: "nudge", services: "NudgeService", tags: ["system"] },
	"nudge.configured": { category: "Nudge", description: "A nudge config was added or updated", direction: "Service → Listeners", domain: "nudge", services: "NudgeService", tags: ["system"] },
	"nudge.remove":     { category: "Nudge", description: "Command to remove a nudge config", direction: "View → Plugin", domain: "nudge", services: "NudgeService", tags: ["system"] },
	"nudge.removed":    { category: "Nudge", description: "A nudge config was removed", direction: "Service → Listeners", domain: "nudge", services: "NudgeService", tags: ["system"] },
	"nudge.triggered":  { category: "Nudge", description: "A nudge fired at its scheduled time", direction: "Service → Listeners", domain: "nudge", services: "NudgeService", tags: [] },
	"nudge.dismiss":    { category: "Nudge", description: "Command to dismiss a nudge for today", direction: "View → Plugin", domain: "nudge", services: "NudgeService", tags: ["system"] },
	"nudge.dismissed":  { category: "Nudge", description: "A nudge was dismissed for today", direction: "Service → Listeners", domain: "nudge", services: "NudgeService", tags: ["system"] },
	"nudge.loaded":     { category: "Nudge", description: "Nudge state loaded from storage", direction: "Service → Listeners", domain: "nudge", services: "NudgeService", tags: ["system"] },

	// ── Signal ────────────────────────────────────────────────
	"signal.configured":        { category: "Signal", description: "A signal connection was created or updated", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.removed":           { category: "Signal", description: "A signal connection was removed", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.connection.tested": { category: "Signal", description: "Connection test completed", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.sync.started":      { category: "Signal", description: "Sync operation started", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.sync.progress":     { category: "Signal", description: "Per-item sync progress", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.sync.completed":    { category: "Signal", description: "Sync operation completed successfully", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.sync.failed":       { category: "Signal", description: "Sync operation failed", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.item.created":      { category: "Signal", description: "A new work item note was created", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.item.updated":      { category: "Signal", description: "An existing work item note was updated", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.loaded":            { category: "Signal", description: "Signal state loaded from storage", direction: "Service → Listeners", domain: "signal", services: "SignalService", tags: ["system"] },
	"signal.auth.expired":      { category: "Signal", description: "PAT token expired or invalid (401 detected)", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.connection.failed": { category: "Signal", description: "Network connection to signal source failed", direction: "Service → Listeners", domain: "signal", services: "SignalService" },
	"signal.health.checked":    { category: "Signal", description: "A health check was performed on a signal connection", direction: "Service → Listeners", domain: "signal", services: "SignalDiagnosticsService" },
	"signal.health.changed":    { category: "Signal", description: "Health status transitioned (e.g. healthy → degraded)", direction: "Service → Listeners", domain: "signal", services: "SignalDiagnosticsService" },

	// ── Capture ──────────────────────────────────────────────────
	"capture.idea.created":     { category: "Capture", description: "An idea was captured via Quick Capture", direction: "Service → Listeners", domain: "capture", services: "CaptureService" },
	"capture.feedback.created": { category: "Capture", description: "Feedback was captured via Quick Capture", direction: "Service → Listeners", domain: "capture", services: "CaptureService" },
	"capture.note.created":     { category: "Capture", description: "A note was created via Quick Capture (any type)", direction: "Service → Listeners", domain: "capture", services: "CaptureService" },

	// ── Train ────────────────────────────────────────────────────
	"train.started":        { category: "Train", description: "A train-of-thought capture session started", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.thought.added":  { category: "Train", description: "A thought was captured and linked in the train", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.paused":         { category: "Train", description: "Train capture was paused", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.resumed":        { category: "Train", description: "Train capture was resumed", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.completed":      { category: "Train", description: "Train capture was completed", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.thought.activated": { category: "Train", description: "A thought was navigated to in a view", direction: "View → Plugin", domain: "train", services: "TrainMainView" },
	"train.thought.renamed":   { category: "Train", description: "A thought was renamed (title + vault note)", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.branch.merged":     { category: "Train", description: "A branch was merged into a target thought", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.branch.merge.undone": { category: "Train", description: "A branch merge was undone", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.canvas.created":    { category: "Train", description: "A train canvas was created for the first time", direction: "Service → Listeners", domain: "train", services: "TrainCanvasSyncService" },
	"train.canvas.synced":     { category: "Train", description: "A train canvas was synced from graph state", direction: "Service → Listeners", domain: "train", services: "TrainCanvasSyncService" },
	"train.canvas.reconciled": { category: "Train", description: "A train canvas was reconciled (node count mismatch corrected)", direction: "Service → Listeners", domain: "train", services: "TrainCanvasSyncService" },
	"train.summary.created":   { category: "Train", description: "A train summary document was generated on completion", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.renamed":           { category: "Train", description: "A train was renamed", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.deleted":           { category: "Train", description: "A train was deleted from history", direction: "Service → Listeners", domain: "train", services: "TrainService" },
	"train.branch.status.changed": { category: "Train", description: "A branch status label was changed (exploring/stale/promising)", direction: "Service → Listeners", domain: "train", services: "TrainService" },

	// ── Canvas ───────────────────────────────────────────────────
	"canvas.import.started":   { category: "Canvas", description: "A canvas import operation started", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.import.progress":  { category: "Canvas", description: "Per-node progress during canvas import", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.import.completed": { category: "Canvas", description: "A canvas import operation completed", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.import.failed":    { category: "Canvas", description: "A canvas import operation failed", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.entity.detected":  { category: "Canvas", description: "A canvas node was resolved to a Flowti entity", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.legend.detected":  { category: "Canvas", description: "A Legend group with color-to-type mappings was detected", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.config.saved":     { category: "Canvas", description: "An import configuration was saved", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.loaded":           { category: "Canvas", description: "Canvas state loaded from storage", direction: "Service → Listeners", domain: "canvas", services: "CanvasService" },
	"canvas.template.created": { category: "Canvas", description: "Canvas created from a template", direction: "Service → Listeners", domain: "canvas", services: "CanvasTemplateService" },
	"canvas.session.started":  { category: "Canvas", description: "Canvas session monitor started tracking", direction: "Service → Listeners", domain: "canvas", services: "CanvasSessionMonitor" },
	"canvas.session.activity": { category: "Canvas", description: "Canvas session node stats changed", direction: "Service → Listeners", domain: "canvas", services: "CanvasSessionMonitor" },
	"canvas.session.completed": { category: "Canvas", description: "Canvas session completed", direction: "Service → Listeners", domain: "canvas", services: "CanvasSessionMonitor" },

	// ── Analytics ────────────────────────────────────────────
	"analytics.loaded":          { category: "Analytics", description: "Analytics domain loaded from storage", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService", tags: ["system"] },
	"analytics.query.started":   { category: "Analytics", description: "Analytics query execution started", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.completed": { category: "Analytics", description: "Analytics query completed successfully", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.failed":    { category: "Analytics", description: "Analytics query failed", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.saved":     { category: "Analytics", description: "Analytics query saved to persistence", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.deleted":   { category: "Analytics", description: "Saved analytics query removed", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },

	// ── Analytics Dashboards ─────────────────────────────
	"analytics.dashboard.created":      { category: "Analytics", description: "A new dashboard was created", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.updated":      { category: "Analytics", description: "An existing dashboard was updated", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.deleted":      { category: "Analytics", description: "A dashboard was deleted", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.tile.added":   { category: "Analytics", description: "A tile was added to a dashboard", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.tile.removed": { category: "Analytics", description: "A tile was removed from a dashboard", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.tile.updated": { category: "Analytics", description: "A tile was updated within a dashboard", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.refreshed":    { category: "Analytics", description: "A dashboard's tiles were refreshed", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.favorited":        { category: "Analytics", description: "A saved query's favorite status was toggled", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.favorited":    { category: "Analytics", description: "A dashboard's favorite status was toggled", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.defaultChanged": { category: "Analytics", description: "The default dashboard was changed", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.renamed":          { category: "Analytics", description: "A saved query was renamed", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.query.duplicated":       { category: "Analytics", description: "A saved query was duplicated", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.dashboard.tile.reordered": { category: "Analytics", description: "A dashboard tile was reordered", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.template.saved":         { category: "Analytics", description: "A dashboard was saved as a reusable template", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.template.used":          { category: "Analytics", description: "A new dashboard was created from a template", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.measurement.created":    { category: "Analytics", description: "A measurement was created", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.measurement.updated":    { category: "Analytics", description: "A measurement was updated", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.measurement.deleted":    { category: "Analytics", description: "A measurement was deleted", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.measurement.favorited":  { category: "Analytics", description: "A measurement's favorite status was toggled", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },
	"analytics.reset":                  { category: "Analytics", description: "All analytics data was reset (queries, dashboards, templates, measurements)", direction: "Service → Listeners", domain: "analytics", services: "AnalyticsService" },

	// ── Analytics UI Commands ────────────────────────────────
	"analytics.ui.addTile":             { category: "Analytics", description: "Add a tile to a dashboard", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.createMeasurement":   { category: "Analytics", description: "Create a new measurement", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.deleteMeasurement":   { category: "Analytics", description: "Delete a measurement", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.deleteQuery":         { category: "Analytics", description: "Delete a saved query", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.measurementSelected": { category: "Analytics", description: "A measurement was selected", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.navigateBreadcrumb": { category: "Analytics", description: "Navigate via breadcrumb in analytics view", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.removeTile":          { category: "Analytics", description: "Remove a tile from a dashboard", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.renameDashboard":     { category: "Analytics", description: "Rename a dashboard", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.runQuery":            { category: "Analytics", description: "Execute an analytics query", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.saveQuery":           { category: "Analytics", description: "Save an analytics query", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },
	"analytics.ui.selectQuery":         { category: "Analytics", description: "A query was selected in the list", direction: "View → Plugin", domain: "analytics", services: "AnalyticsHandlers" },

	// ── Onboarding events ─────────────────────────────────────

	"onboarding.started":        { category: "Onboarding", description: "Onboarding initialised after first install", direction: "Service → Listeners", domain: "onboarding", services: "OnboardingService" },
	"onboarding.step.completed": { category: "Onboarding", description: "An onboarding milestone was completed", direction: "Service → Listeners", domain: "onboarding", services: "OnboardingService" },
	"onboarding.completed":      { category: "Onboarding", description: "All onboarding milestones completed", direction: "Service → Listeners", domain: "onboarding", services: "OnboardingService" },
	"onboarding.reset":          { category: "Onboarding", description: "Onboarding state was reset from Settings", direction: "Service → Listeners", domain: "onboarding", services: "OnboardingService" },

	// ── Performance Observability ────────────────────────────

	"perf.storage.loaded":   { category: "Performance", description: "TypedStorage load completed with timing", direction: "Internal", domain: "infrastructure", services: "TypedStorage", tags: ["system"] },
	"perf.storage.saved":    { category: "Performance", description: "TypedStorage save completed with timing", direction: "Internal", domain: "infrastructure", services: "TypedStorage", tags: ["system"] },
	"perf.startup.shell":    { category: "Performance", description: "Sync onload duration (plugin.loading → plugin.loaded)", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.startup.layoutGap": { category: "Performance", description: "Wall time plugin.loaded → onLayoutReady (Obsidian layout)", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.startup.service":  { category: "Performance", description: "Domain service startup load completed", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.startup.total":    { category: "Performance", description: "All services startup completed", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.startup.phase":    { category: "Performance", description: "Startup phase timing (e.g. domain load, hub registry)", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.startup.segment":  { category: "Performance", description: "Wall-clock segment inside domain service load", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.startup.breakdown": { category: "Performance", description: "Structured startup profile snapshot after profiling", direction: "Internal", domain: "infrastructure", services: "Plugin", tags: ["system"] },
	"perf.query.executed":   { category: "Performance", description: "Analytics query execution completed", direction: "Internal", domain: "infrastructure", services: "AnalyticsService", tags: ["system"] },
	"perf.alert":            { category: "Performance", description: "Performance metric exceeded threshold", direction: "Internal", domain: "infrastructure", services: "PerfAggregator", tags: ["system"] },
	"perf.event.dispatched": { category: "Performance", description: "Event dispatched to all handlers with timing", direction: "Internal", domain: "infrastructure", services: "EventBus", tags: ["system"] },
	"perf.installer.total":  { category: "Performance", description: "Installer pipeline completed all steps", direction: "Internal", domain: "installer", services: "InstallerService", tags: ["system"] },
	"perf.installer.step":   { category: "Performance", description: "Individual installer step completed", direction: "Internal", domain: "installer", services: "InstallerService", tags: ["system"] },
	"perf.csv.parsed":       { category: "Performance", description: "CSV content parsed by CsvParser", direction: "Internal", domain: "dataExchange", services: "ImportService", tags: ["system"] },
	"perf.import.completed": { category: "Performance", description: "Full import pipeline completed", direction: "Internal", domain: "dataExchange", services: "ImportService", tags: ["system"] },
	"perf.view.opened":      { category: "Performance", description: "Hub view finished opening", direction: "Internal", domain: "ui", services: "BaseHubView", tags: ["system"] },
	"perf.agentWorld.sample": { category: "Performance", description: "Agent world simulation perf window sample", direction: "Internal", domain: "game", services: "AgentWorld", tags: ["system"] },
	"perf.agentWorld.slowFrame": { category: "Performance", description: "Agent world simulation frame exceeded threshold", direction: "Internal", domain: "game", services: "AgentWorld", tags: ["system"] },
	"perf.agentWorld.engine.start": { category: "Performance", description: "Agent World Excalibur cold start completed", direction: "Internal", domain: "game", services: "AgentWorld", tags: ["system"] },

	// ── Notification ───────────────────────────────────────
	"notice.show":               { category: "Notification", description: "Show a plain notice to the user", direction: "Internal", domain: "ui", services: "NoticeService", tags: ["system"] },
	"notice.success":            { category: "Notification", description: "Show a success notice to the user", direction: "Internal", domain: "ui", services: "NoticeService", tags: ["system"] },
	"notice.error":              { category: "Notification", description: "Show an error notice to the user", direction: "Internal", domain: "ui", services: "NoticeService", tags: ["system"] },
	"notice.throttled":          { category: "Notification", description: "Show a throttled/batched notice (deduplicated by key)", direction: "Internal", domain: "ui", services: "NoticeService", tags: ["system"] },
	"notice.prompt":             { category: "Notification", description: "Show an interactive prompt with configurable buttons", direction: "Internal", domain: "ui", services: "NoticeService", tags: ["system"] },
	"notice.prompt.responded":   { category: "Notification", description: "A prompt button was clicked", direction: "Internal", domain: "ui", services: "NoticeService", tags: ["system"] },

	// ── Modal ──────────────────────────────────────────────
	"modal.opened":              { category: "Modal", description: "A modal was opened by ModalService", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },
	"modal.closed":              { category: "Modal", description: "A modal was closed", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },
	"ui.openTextPrompt":         { category: "Modal", description: "Request to open a text input prompt modal", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },
	"modal.textPrompt.submitted": { category: "Modal", description: "A text prompt was submitted with a value", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },
	"modal.textPrompt.cancelled": { category: "Modal", description: "A text prompt was cancelled without submitting", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },
	"ui.openManualQa":           { category: "Modal", description: "Request to open a manual QA checkpoint modal", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },
	"modal.manualQa.responded":  { category: "Modal", description: "Operator clicked pass or fail in the manual QA modal", direction: "Internal", domain: "ui", services: "ModalService", tags: ["system"] },

	// ── Catalog ──────────────────────────────────────────────
	"catalog.actors.selected":  { category: "Catalog", description: "An actor was selected in the catalog", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },
	"catalog.domains.selected": { category: "Catalog", description: "A domain was selected in the catalog", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },
	"catalog.event.selected":   { category: "Catalog", description: "An event was selected in the catalog events tab", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },
	"catalog.flows.selected":   { category: "Catalog", description: "A flow was selected in the catalog", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },
	"catalog.health.selected":  { category: "Catalog", description: "Health was selected in the catalog", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },
	"catalog.services.selected": { category: "Catalog", description: "A service was selected in the catalog", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },
	"catalog.systems.selected": { category: "Catalog", description: "A system was selected in the catalog", direction: "View → Plugin", domain: "catalog", services: "CatalogHandlers" },

	// ── Journey Builder ───────────────────────────────────
	"journey-builder.opened":           { category: "Journey Builder", description: "Journey Builder sidebar was opened", direction: "Plugin → Listeners", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.create-new":       { category: "Journey Builder", description: "User clicked Create New Journey", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.open-existing":    { category: "Journey Builder", description: "User clicked Open Existing Journey", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.metadata.updated": { category: "Journey Builder", description: "Journey metadata was updated", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.step.added":       { category: "Journey Builder", description: "A step was added to the journey", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.step.updated":     { category: "Journey Builder", description: "A step was updated (title, description, etc.)", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.action.added":     { category: "Journey Builder", description: "An action was added to a step", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.exported":         { category: "Journey Builder", description: "Journey was exported to JSON and test file", direction: "Service → Listeners", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.canvas.sync-requested": { category: "Journey Builder", description: "Canvas sync was requested with current definition", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.canvas.synced":    { category: "Journey Builder", description: "Companion canvas file was written/updated", direction: "Service → Listeners", domain: "journey-builder", services: "JourneyBuilderService" },
	"journey-builder.canvas.changed":   { category: "Journey Builder", description: "Companion canvas file was modified externally (reverse sync)", direction: "Service → Listeners", domain: "journey-builder", services: "JourneyBuilderService" },
	"journey-builder.preview.started":       { category: "Journey Builder", description: "Preview run started", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.preview.step-completed": { category: "Journey Builder", description: "Preview run step completed with pass/fail", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.preview.completed":     { category: "Journey Builder", description: "Preview run finished with totals", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.import-requested": { category: "Journey Builder", description: "User selected a journey file to import", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderSidebar" },
	"journey-builder.imported":              { category: "Journey Builder", description: "Journey JSON was read and is ready for hydration", direction: "Service → Listeners", domain: "journey-builder", services: "JourneyBuilderService" },
	"journey-builder.import-failed":        { category: "Journey Builder", description: "Journey import failed (file read error or validation failure)", direction: "Service → Listeners", domain: "journey-builder", services: "JourneyBuilderService" },
	"journey-builder.import-from-system":   { category: "Journey Builder", description: "Import a journey definition from the system", direction: "View → Plugin", domain: "journey-builder", services: "JourneyBuilderHandler" },
	"ui.openJourneyBuilder":                { category: "UI Commands", description: "Open the Journey Builder sidebar", direction: "View → Plugin", domain: "ui", services: "UiCommandService", tags: ["system"] },

	// ── Test Management Events ────────────────────────────────
	"test-mgmt.hub.loaded":                 { category: "Test Management", description: "Test Management Hub loaded with current state", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.journey.registered":         { category: "Test Management", description: "Journey registered in the test management registry", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.journey.deregistered":       { category: "Test Management", description: "Journey removed from the test management registry", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.journey.status-changed":     { category: "Test Management", description: "Journey status changed (passing/failing/stale/never-run)", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.journey.run-completed":      { category: "Test Management", description: "Journey run result recorded", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.coverage.computed":          { category: "Test Management", description: "PRD coverage matrix recomputed", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.compliance.checked":         { category: "Test Management", description: "ISO compliance check completed", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.pyramid.updated":            { category: "Test Management", description: "Test pyramid state updated", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },
	"test-mgmt.review.requested":           { category: "Test Management", description: "Three Amigos review requested for a journey", direction: "Service → Listeners", domain: "test-management", services: "TestManagementService" },

	// Journey Executor (4 events)
	"journey-executor.run.started":         { category: "Test Management", description: "Journey execution started", direction: "Service → Listeners", domain: "journey-executor", services: "JourneyExecutorService" },
	"journey-executor.run.step-completed":  { category: "Test Management", description: "Journey step completed during execution", direction: "Service → Listeners", domain: "journey-executor", services: "JourneyExecutorService" },
	"journey-executor.run.step-retried":    { category: "Test Management", description: "Journey step retried after failure", direction: "Service → Listeners", domain: "journey-executor", services: "JourneyExecutorService" },
	"journey-executor.run.completed":       { category: "Test Management", description: "Journey execution completed", direction: "Service → Listeners", domain: "journey-executor", services: "JourneyExecutorService" },
	"journey-executor.run.failed":          { category: "Test Management", description: "Journey execution failed or cancelled", direction: "Service → Listeners", domain: "journey-executor", services: "JourneyExecutorService" },

	// ── Feature Lifecycle ────────────────────────────────────
	"feature.stage.changed":                { category: "Feature Lifecycle", description: "Feature stage changed via advance action", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"feature.gate.passed":                  { category: "Feature Lifecycle", description: "All gate checks passed for a stage transition", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"feature.gate.failed":                  { category: "Feature Lifecycle", description: "Gate check run with failures", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"feature.scored":                       { category: "Feature Lifecycle", description: "FRI or prioritization scores saved", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"feature.session.started":              { category: "Feature Lifecycle", description: "User started a session on a feature", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"feature.session.ended":                { category: "Feature Lifecycle", description: "User ended a session on a feature", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"review.session.created":               { category: "Feature Lifecycle", description: "Three Amigos review document created for a feature", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },
	"review.session.scored":                { category: "Feature Lifecycle", description: "TASM scores detected in a review document", direction: "Service → Listeners", domain: "featureLifecycle", services: "FeatureLifecycleService" },

	// ── Process Management ────────────────────────────────────
	"process.opened":                       { category: "Process", description: "Process canvas opened for viewing", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.created":                      { category: "Process", description: "New process definition created", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.updated":                      { category: "Process", description: "Process definition updated (re-scanned)", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.node.added":                   { category: "Process", description: "Node added to a process", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.node.updated":                 { category: "Process", description: "Node updated in a process", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.node.removed":                 { category: "Process", description: "Node removed from a process", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.edge.created":                 { category: "Process", description: "Edge created between process nodes", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.edge.removed":                 { category: "Process", description: "Edge removed from process", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.compiled":                     { category: "Process", description: "Process compiled (validated and ready)", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.canvas.synced":                { category: "Process", description: "Process canvas synced (re-parsed from file)", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.execution.started":            { category: "Process", description: "Process execution started for a feature", direction: "Service → Listeners", domain: "process", services: "ProcessService" },
	"process.execution.completed":          { category: "Process", description: "Process execution completed for a feature", direction: "Service → Listeners", domain: "process", services: "ProcessService" },

	// ── Agent Events ─────────────────────────────────────────────
	"agent.status.changed":                 { category: "Agent", description: "Agent activity status changed", direction: "Service → Listeners", domain: "agents", services: "CliExecutor", tags: ["agent"] },
	"agent.message.received":               { category: "Agent", description: "New message received from LLM agent", direction: "Service → Listeners", domain: "agents", services: "CliExecutor", tags: ["agent"] },
	"agent.message.sent":                   { category: "Agent", description: "User sent a message to agent", direction: "Service → Listeners", domain: "agents", services: "AgentHandler", tags: ["agent"] },
	"agent.thinking":                       { category: "Agent", description: "Agent is thinking (streaming chain-of-thought)", direction: "Service → Listeners", domain: "agents", services: "CliExecutor", tags: ["agent"] },
	"agent.tool.started":                   { category: "Agent", description: "Agent started using a tool", direction: "Service → Listeners", domain: "agents", services: "CliExecutor", tags: ["agent"] },
	"agent.tool.completed":                 { category: "Agent", description: "Agent tool call completed", direction: "Service → Listeners", domain: "agents", services: "CliExecutor", tags: ["agent"] },
	"agent.mode.switched":                  { category: "Agent", description: "User switched conversation view mode", direction: "Service → Listeners", domain: "agents", services: "AgentHandler", tags: ["agent"] },
	"agent.team.toggled":                   { category: "Agent", description: "Team mode toggled on/off", direction: "Service → Listeners", domain: "agents", services: "AgentHandler", tags: ["agent"] },
	"agent.canvas.synced":                  { category: "Agent", description: "Agent conversation synced to canvas file", direction: "Service → Listeners", domain: "agents", services: "CanvasSync", tags: ["agent", "canvas"] },
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
