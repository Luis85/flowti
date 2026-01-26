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
import type { Feature } from "../features/types";
import type { Idea } from "../ideas/types";
import type { JTBD } from "../jtbd/types";
import type { LogEntry } from "../logger/types";
import type { Requirement } from "../requirements/types";
import type { FlowtiSettings } from "../settings/settings";
import type { Solution } from "../solutions/types";
import type { FlowtiUser } from "../user/types";

/**
 * Map of all event types to their payload types.
 *
 * This is the central registry for all events in the application.
 * The key is the event type string, the value is the payload type.
 */
export interface FlowtiEventMap {
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
	// User Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a new user is created */
	"user.created": { user: FlowtiUser };
	/** Emitted when user data is updated */
	"user.updated": { user: FlowtiUser };
	/** Emitted when user data is loaded from storage */
	"user.loaded": { user: FlowtiUser };

	// ─────────────────────────────────────────────────────────────
	// Settings Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when settings are changed */
	"settings.changed": { settings: FlowtiSettings };
	/** Emitted when settings are loaded from storage */
	"settings.loaded": { settings: FlowtiSettings };

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
	// Solution Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a new solution is created */
	"solution.created": { solution: Solution };
	/** Emitted when a solution is loaded from storage */
	"solution.loaded": { solution: Solution };
	/** Emitted when a solution is updated */
	"solution.updated": { solution: Solution };
	/** Emitted when a solution is deleted */
	"solution.deleted": { solutionId: string };
	/** Emitted when a solution is selected in the explorer */
	"solution.selected": { solutionId: string };

	// ─────────────────────────────────────────────────────────────
	// Idea Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a new idea is created */
	"idea.created": { idea: Idea };
	/** Emitted when an idea is loaded from storage */
	"idea.loaded": { idea: Idea };
	/** Emitted when an idea is updated */
	"idea.updated": { idea: Idea };
	/** Emitted when an idea is deleted */
	"idea.deleted": { ideaId: string; solutionId: string };

	// ─────────────────────────────────────────────────────────────
	// Requirement Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a new requirement is created */
	"requirement.created": { requirement: Requirement };
	/** Emitted when a requirement is loaded from storage */
	"requirement.loaded": { requirement: Requirement };
	/** Emitted when a requirement is updated */
	"requirement.updated": { requirement: Requirement };
	/** Emitted when a requirement is deleted */
	"requirement.deleted": { requirementId: string; solutionId: string };

	// ─────────────────────────────────────────────────────────────
	// JTBD (Jobs to be Done) Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a new JTBD is created */
	"jtbd.created": { jtbd: JTBD };
	/** Emitted when a JTBD is loaded from storage */
	"jtbd.loaded": { jtbd: JTBD };
	/** Emitted when a JTBD is updated */
	"jtbd.updated": { jtbd: JTBD };
	/** Emitted when a JTBD is deleted */
	"jtbd.deleted": { jtbdId: string; solutionId: string };

	// ─────────────────────────────────────────────────────────────
	// Feature Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a new feature is created */
	"feature.created": { feature: Feature };
	/** Emitted when a feature is loaded from storage */
	"feature.loaded": { feature: Feature };
	/** Emitted when a feature is updated */
	"feature.updated": { feature: Feature };
	/** Emitted when a feature is deleted */
	"feature.deleted": { featureId: string; solutionId: string };

	// ─────────────────────────────────────────────────────────────
	// Canvas Events
	// ─────────────────────────────────────────────────────────────

	/** Emitted when a canvas is generated */
	"canvas.generated": { solutionId: string; canvasPath: string; type: string };
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
