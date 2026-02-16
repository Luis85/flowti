/**
 * Type definitions for the User Hub view and its components.
 */

import type { InboxService } from "../../domain/inbox/InboxService";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IUserService } from "../../domain/user/types";

// Re-export InboxItem from domain (single source of truth)
import type { InboxItem } from "../../domain/inbox/types";
export type { InboxItem } from "../../domain/inbox/types";

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────

export type UserHubTab = "inbox" | "preferences";

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

export interface UserHubState {
	inboxItems: InboxItem[];
	selectedInboxItem: InboxItem | null;
	inboxEnabledSources: string[];
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
	userService: IUserService;
	scheduleRender: () => void;
	/** Navigate to a specific event type in the Event Catalog. */
	navigateToEvent: (eventType: string) => void;
}
