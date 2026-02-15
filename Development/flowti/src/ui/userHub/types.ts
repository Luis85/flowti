/**
 * Type definitions for the User Hub view and its components.
 */

import type { HubRegistry } from "../../domain/hub/HubRegistry";
import type { IEventBus } from "../../infrastructure/events/types";

// ─────────────────────────────────────────────────────────────
// Tab & State
// ─────────────────────────────────────────────────────────────

/** Tabs available in the User Hub (excluding the implicit "dashboard"). */
export type UserTab = "inbox" | "activity";

export interface InboxItem {
	id: string;
	type: "action" | "info";
	title: string;
	description: string;
	sourceHub: string;
	timestamp: string;
	read: boolean;
}

export interface ActivityLogEntry {
	type: string;
	category: string;
	description: string;
	payload: unknown;
	timestamp: string;
}

export interface UserHubState {
	inboxItems: InboxItem[];
	activityLog: ActivityLogEntry[];
	selectedInboxItem: InboxItem | null;
	selectedActivity: ActivityLogEntry | null;
}

// ─────────────────────────────────────────────────────────────
// Component deps
// ─────────────────────────────────────────────────────────────

export interface UserHubComponentDeps {
	getState: () => UserHubState;
	setState: (partial: Partial<UserHubState>) => void;
	eventBus: IEventBus;
	hubRegistry: HubRegistry;
	scheduleRender: () => void;
}
