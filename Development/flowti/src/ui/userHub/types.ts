/**
 * Type definitions for the User Hub view and its components.
 */

import type { InboxService } from "../../domain/inbox/InboxService";
import type { SessionService } from "../../domain/session/SessionService";
import type { Session } from "../../domain/session/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IUserService } from "../../domain/user/types";

// Re-export InboxItem from domain (single source of truth)
import type { InboxItem } from "../../domain/inbox/types";
export type { InboxItem } from "../../domain/inbox/types";

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────

export type UserHubTab = "inbox" | "sessions" | "preferences";

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

export interface UserHubState {
	inboxItems: InboxItem[];
	selectedInboxItem: InboxItem | null;
	inboxEnabledSources: string[];
	sessions: Session[];
	activeSession: Session | null;
	selectedSession: Session | null;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const SOURCE_EVENT_LABELS: Record<string, string> = {
	"subscription.matched": "Watcher",
	"dataExchange.import.completed": "Import",
	"dataExchange.import.failed": "Import Error",
	"dataExchange.export.completed": "Export",
	"dataExchange.pipeline.completed": "Pipeline",
	"dataExchange.pipeline.failed": "Pipeline Error",
};

/** Returns a human-readable label for an inbox item's source event. */
export function formatSourceEvent(sourceEvent: string): string {
	return SOURCE_EVENT_LABELS[sourceEvent] ?? sourceEvent;
}

/** Formats an ISO timestamp as a short time string (HH:MM). */
export function formatTime(timestamp: string): string {
	return new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────────
// Component deps
// ─────────────────────────────────────────────────────────────

export interface UserHubComponentDeps {
	getState: () => UserHubState;
	setState: (partial: Partial<UserHubState>) => void;
	eventBus: IEventBus;
	inboxService: InboxService;
	sessionService: SessionService;
	userService: IUserService;
	scheduleRender: () => void;
	/** Navigate to a specific event type in the Event Catalog. */
	navigateToEvent: (eventType: string) => void;
	/** Open the New Session creation modal. Optionally pre-fills a focus file. */
	openNewSessionModal: (initialFocusFile?: string) => void;
	/** Open a file in the workspace. */
	openFile: (filePath: string) => void;
	/** Open the Save Template modal for any session. */
	openSaveTemplateModal: (session: Session) => void;
	/** Open the Session Workspace view in a new leaf. Optionally targets a specific session. */
	openSessionWorkspace: (sessionId?: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Session display helpers
// ─────────────────────────────────────────────────────────────

export const SESSION_STATUS_LABELS: Record<string, string> = {
	prepared: "Ready",
	active: "Active",
	paused: "Paused",
	completed: "Completed",
	archived: "Archived",
};

export const SESSION_TYPE_LABELS: Record<string, string> = {
	"vault-hygiene": "Vault Hygiene",
	"event-storming": "Event Storming",
	"service-design": "Service Design",
	"requirements-refinement": "Requirements",
	"backlog-structuring": "Backlog",
	"knowledge-cleanup": "Cleanup",
};
