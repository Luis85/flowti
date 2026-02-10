/**
 * Event definitions for the Flowti application.
 *
 * Add new events here to extend the event system.
 * Each event follows the xstate v5 convention: `{ type, payload }`.
 *
 * @example Adding a new event
 * ```typescript
 * // 1. Add the event to FlowtiEventMap
 * export interface FlowtiEventMap {
 *   "task.created": { task: Task };
 *   "task.completed": { taskId: string };
 * }
 *
 * // 2. Use it with full type safety
 * eventBus.emit("task.created", { task: newTask });
 * eventBus.on("task.completed", (event) => {
 *   console.log(event.payload.taskId); // Type-safe!
 * });
 * ```
 */

import type { FlowtiErrorInfo } from "../errors/types";
import type { LogEntry } from "../logger/types";
import type { DiscoveryEventMap } from "../../domain/discovery/events";
import type { EventFilterEventMap } from "../../domain/eventFilter/events";
import type { EventNotifyEventMap } from "../../domain/eventNotify/events";
import type { InstallerEventMap } from "../../domain/installer/events";
import type { UserEventMap } from "../../domain/user/events";
import type { SettingsEventMap } from "../../domain/settings/events";

// ─────────────────────────────────────────────────────────────
// File System Types (defined here to avoid circular imports)
// ─────────────────────────────────────────────────────────────

/**
 * Branded type for request IDs to ensure type safety
 * when correlating requests with responses.
 */
export type RequestId = string & { readonly __brand: "RequestId" };

/**
 * Source of a file system change.
 */
export type FileChangeSource = "user" | "obsidian" | "sync" | "plugin" | "unknown";

/**
 * Base payload for all file request events.
 */
export interface FileRequestBase {
	/** Unique ID to correlate request with response */
	requestId: RequestId;
	/** File path relative to vault root */
	path: string;
}

/**
 * Base payload for all file response events.
 */
export interface FileResponseBase {
	/** Correlates with the original request */
	requestId: RequestId;
	/** Whether the operation succeeded */
	success: boolean;
	/** File path that was operated on */
	path: string;
}

/**
 * Error information for failed file operations.
 */
export interface FileOperationError {
	/** Error code for programmatic handling */
	code: string;
	/** Human-readable error message */
	message: string;
	/** Path of the file that caused the error */
	path: string;
}

/**
 * Map of all event types to their payload types.
 *
 * This is the central registry for all events in the application.
 * The key is the event type string, the value is the payload type.
 */
export interface FlowtiEventMap extends UserEventMap, SettingsEventMap, InstallerEventMap, DiscoveryEventMap, EventFilterEventMap, EventNotifyEventMap {
	// ─────────────────────────────────────────────────────────────
	// Plugin Lifecycle Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when plugin starts loading */
	"plugin.loading": { timestamp: string };
	/** Emitted when plugin has fully loaded */
	"plugin.loaded": { timestamp: string };
	/** Emitted when plugin is ready (layout ready, user loaded) */
	"plugin.ready": { timestamp: string };
	/** Emitted when plugin starts unloading */
	"plugin.unloading": { timestamp: string };
	/** Emitted when plugin has fully unloaded */
	"plugin.unloaded": { timestamp: string };

	// ─────────────────────────────────────────────────────────────
	// Service Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a service is registered */
	"service.registered": { serviceId: string };
	/** Emitted when a service is initialized */
	"service.initialized": { serviceId: string };
	/** Emitted when a service is disposed */
	"service.disposed": { serviceId: string };
	/** Emitted when a service fails to initialize */
	"service.error": { serviceId: string; error: FlowtiErrorInfo };

	// ─────────────────────────────────────────────────────────────
	// Command Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a command is registered */
	"command.registered": { commandId: string; commandName: string };
	/** Emitted when a command starts executing */
	"command.executing": { commandId: string };
	/** Emitted when a command completes successfully */
	"command.executed": { commandId: string; durationMs: number };
	/** Emitted when a command fails */
	"command.failed": { commandId: string; error: FlowtiErrorInfo };

	// ─────────────────────────────────────────────────────────────
	// View Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a view is registered */
	"view.registered": { type: string; displayName: string };

	// ─────────────────────────────────────────────────────────────
	// Log Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted for each log entry (useful for log aggregation) */
	"log.entry": LogEntry;
	/** Emitted when an error is logged */
	"log.error": LogEntry;

	// ─────────────────────────────────────────────────────────────
	// Error Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when an error occurs (for centralized error tracking) */
	"error.occurred": FlowtiErrorInfo;
	/** Emitted when an error is handled/recovered */
	"error.handled": { error: FlowtiErrorInfo; recovered: boolean };

	// ─────────────────────────────────────────────────────────────
	// File Operation Request Events (Service → EventBridge)
	// ─────────────────────────────────────────────────────────────

	/** Request to create a new file */
	"file.create.request": FileRequestBase & {
		/** File content (markdown or text) */
		content: string;
		/** If true, create parent folders if they don't exist */
		createFolders?: boolean;
	};

	/** Request to read a file's content */
	"file.read.request": FileRequestBase;

	/** Request to update an existing file's content */
	"file.update.request": FileRequestBase & {
		/** New content to write */
		content: string;
	};

	/** Request to delete a file */
	"file.delete.request": FileRequestBase;

	/** Request to move a file to a new location */
	"file.move.request": FileRequestBase & {
		/** Destination path relative to vault root */
		newPath: string;
	};

	/** Request to rename a file (same folder, different name) */
	"file.rename.request": FileRequestBase & {
		/** New file name (without path) */
		newName: string;
	};

	// ─────────────────────────────────────────────────────────────
	// File Operation Response Events (EventBridge → Service)
	// ─────────────────────────────────────────────────────────────

	/** Response after file creation */
	"file.create.response": FileResponseBase & {
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after file read */
	"file.read.response": FileResponseBase & {
		/** File content if success is true */
		content?: string;
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after file update */
	"file.update.response": FileResponseBase & {
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after file deletion */
	"file.delete.response": FileResponseBase & {
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after file move */
	"file.move.response": FileResponseBase & {
		/** The new path after move if success is true */
		newPath?: string;
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after file rename */
	"file.rename.response": FileResponseBase & {
		/** The new path after rename if success is true */
		newPath?: string;
		/** Error info if success is false */
		error?: FileOperationError;
	};

	// ─────────────────────────────────────────────────────────────
	// File Notification Events (External changes → Services)
	// ─────────────────────────────────────────────────────────────

	/** Notification: A file was created externally */
	"file.created": {
		/** Path of the created file */
		path: string;
		/** Source of the creation */
		source: FileChangeSource;
	};

	/** Notification: A file was modified externally */
	"file.modified": {
		/** Path of the modified file */
		path: string;
		/** Source of the modification */
		source: FileChangeSource;
	};

	/** Notification: A file was deleted externally */
	"file.deleted": {
		/** Path of the deleted file */
		path: string;
		/** Source of the deletion */
		source: FileChangeSource;
	};

	/** Notification: A file was renamed externally */
	"file.renamed": {
		/** Original path before rename */
		oldPath: string;
		/** New path after rename */
		newPath: string;
		/** Source of the rename */
		source: FileChangeSource;
	};

	// ─────────────────────────────────────────────────────────────
	// Folder Notification Events (External changes → Services)
	// ─────────────────────────────────────────────────────────────

	/** Notification: A folder was created */
	"folder.created": {
		/** Path of the created folder */
		path: string;
		/** Source of the creation */
		source: FileChangeSource;
	};

	/** Notification: A folder was deleted */
	"folder.deleted": {
		/** Path of the deleted folder */
		path: string;
		/** Source of the deletion */
		source: FileChangeSource;
	};

	/** Notification: A folder was renamed */
	"folder.renamed": {
		/** Original path before rename */
		oldPath: string;
		/** New path after rename */
		newPath: string;
		/** Source of the rename */
		source: FileChangeSource;
	};

	// ─────────────────────────────────────────────────────────────
	// Event-File Notifications (Frontmatter-driven events)
	// ─────────────────────────────────────────────────────────────

	/** Notification: A file with frontmatter type="Event" triggered a vault action */
	"event.file.triggered": {
		/** The event name from frontmatter `name`, or derived from basename (lowercase, spaces → dots) */
		eventName: string;
		/** Path of the file that triggered the event */
		path: string;
		/** Which vault action triggered this */
		action: "created" | "modified" | "deleted" | "renamed";
	};

	// ─────────────────────────────────────────────────────────────
	// Frontmatter Request Events (Service → EventBridge)
	// ─────────────────────────────────────────────────────────────

	/** Request to read frontmatter from a file */
	"frontmatter.get.request": FileRequestBase;

	/** Request to update specific frontmatter fields (merge) */
	"frontmatter.update.request": FileRequestBase & {
		/** Partial frontmatter to merge with existing */
		data: Record<string, unknown>;
	};

	/** Request to replace entire frontmatter */
	"frontmatter.set.request": FileRequestBase & {
		/** Complete frontmatter to set */
		data: Record<string, unknown>;
	};

	// ─────────────────────────────────────────────────────────────
	// Frontmatter Response Events (EventBridge → Service)
	// ─────────────────────────────────────────────────────────────

	/** Response after frontmatter read */
	"frontmatter.get.response": FileResponseBase & {
		/** Frontmatter data if success is true */
		data?: Record<string, unknown>;
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after frontmatter update */
	"frontmatter.update.response": FileResponseBase & {
		/** Updated frontmatter data if success is true */
		data?: Record<string, unknown>;
		/** Error info if success is false */
		error?: FileOperationError;
	};

	/** Response after frontmatter set */
	"frontmatter.set.response": FileResponseBase & {
		/** Error info if success is false */
		error?: FileOperationError;
	};

	// ─────────────────────────────────────────────────────────────
	// Workspace Notification Events (Obsidian → EventBridge → Services)
	// ─────────────────────────────────────────────────────────────

	/** The active leaf (tab/view) changed */
	"workspace.leaf-changed": {
		/** The file in the new active leaf, or null for non-file views */
		file: { path: string; basename: string; extension: string } | null;
	};

	/** A file was opened in the editor */
	"workspace.file-opened": {
		/** The opened file, or null when the active file is cleared */
		file: { path: string; basename: string; extension: string } | null;
	};

	/** The workspace layout changed (tabs, splits, sidebar) */
	"workspace.layout-changed": Record<string, never>;

	// ─────────────────────────────────────────────────────────────
	// MetadataCache Notification Events (Obsidian → EventBridge → Services)
	// ─────────────────────────────────────────────────────────────

	/** File metadata was updated (frontmatter, tags, links parsed) */
	"metadata.changed": {
		/** Path of the file whose metadata changed */
		path: string;
		/** Parsed frontmatter, or undefined if none */
		frontmatter: Record<string, unknown> | undefined;
	};

	/** All metadata references in the vault have been resolved */
	"metadata.resolved": Record<string, never>;
}

/**
 * All valid event type strings.
 */
export type EventType = keyof FlowtiEventMap;

/**
 * Wildcard type for listening to all events.
 */
export type WildcardType = "*";

/**
 * Event types including wildcard.
 */
export type SubscribableEventType = EventType | WildcardType;
