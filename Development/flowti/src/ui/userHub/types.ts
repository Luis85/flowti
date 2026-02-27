/**
 * Type definitions for the User Hub view and its components.
 */

import type { App } from "obsidian";
import type { InboxService } from "../../domain/inbox/InboxService";
import type { NudgeService } from "../../domain/nudge/NudgeService";
import type { SessionService } from "../../domain/session/SessionService";
import type { Session } from "../../domain/session/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IUserService } from "../../domain/user/types";
import type { FlowtiSettings } from "../../domain/settings/settings";
import type { ICommandRegistry } from "../../infrastructure/commands/types";
import type { HubRegistry } from "../../domain/hub/HubRegistry";

// Re-export InboxItem from domain (single source of truth)
import type { InboxItem } from "../../domain/inbox/types";
export type { InboxItem } from "../../domain/inbox/types";

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────

export type UserHubTab = "sessions" | "inbox" | "commands" | "preferences";

export type PreferencesCategory = "dashboard" | "profile" | "inbox" | "sessions" | "nudges" | "trains";

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
	/** Latest snapshot of plugin settings — synced from settings.changed events. */
	settings: FlowtiSettings;
	/** Currently selected preferences category. */
	selectedPreferencesCategory: PreferencesCategory | null;
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
	"inbox.vaultFolder.noteDetected": "Vault Folder",
	"capture.note.created": "Quick Capture",
	"signal.sync.completed": "Signal Sync",
	"signal.sync.failed": "Signal Sync Error",
	"train.thought.added": "Train Thought",
	"train.completed": "Train Completed",
};

/** Returns a human-readable label for an inbox item's source event. */
export function formatSourceEvent(sourceEvent: string): string {
	return SOURCE_EVENT_LABELS[sourceEvent] ?? sourceEvent;
}

/** Formats an ISO timestamp as a short time string. Shows "HH:MM" for today, "MMM D HH:MM" for older. */
export function formatTime(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	if (isToday) {
		return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	}
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
		+ " " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────────
// Component deps
// ─────────────────────────────────────────────────────────────

export interface UserHubComponentDeps {
	getState: () => UserHubState;
	setState: (partial: Partial<UserHubState>) => void;
	eventBus: IEventBus;
	/** Obsidian App instance (for vault folder suggestions). */
	app: App;
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
	/** Open the Session Workspace view in a new leaf. Optionally targets a specific session and location. */
	openSessionWorkspace: (sessionId?: string, location?: "tab" | "sidebar") => void;
	/** Export a session template as a JSON file (browser download). */
	exportTemplateAsFile: (templateId: string) => void;
	/** Import a session template from a JSON file (native file picker). */
	importTemplateFromFile: () => void;
	/** Returns the latest FlowtiSettings snapshot (read-only). */
	getSettings: () => FlowtiSettings;
	/** Optional NudgeService for nudge preferences panel. */
	nudgeService?: NudgeService;
	/** Optional TrainService for train-aware session panels. */
	trainService?: TrainService;
	/** Command registry for the Commands tab. */
	commandRegistry?: ICommandRegistry;
	/** Hub registry for dashboard preferences. */
	hubRegistry?: HubRegistry;
}

// ─────────────────────────────────────────────────────────────
// Session display helpers
// ─────────────────────────────────────────────────────────────

export const SESSION_STATUS_LABELS: Record<string, string> = {
	prepared: "Ready",
	active: "Active",
	running: "Active",
	paused: "Paused",
	reviewing: "Reviewing",
	completed: "Completed",
	archived: "Archived",
};

export const SESSION_TYPE_LABELS: Record<string, string> = {
	"documentation": "Documentation",
	"vault-hygiene": "Vault Hygiene",
	"event-storming": "Event Storming",
	"service-design": "Service Design",
	"domain-design": "Domain Design",
	"requirements-refinement": "Requirements",
	"backlog-structuring": "Backlog",
	"knowledge-cleanup": "Cleanup",
	"train-of-thought": "Train of Thought",
};
