import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { Session } from "../../domain/session/types";

export const VIEW_TYPE_SESSION_WORKSPACE = "flowti-session-workspace";

/** Shared dependency interface for all session workspace panel components. */
export interface SessionPanelDeps {
	eventBus: IEventBus;
	getSession: () => Session;
	app: App;
	openFile: (path: string) => void;
	revealFolder: (path: string) => void;
	updateActivityFilter: (sessionId: string, filter: string[]) => void;
}
