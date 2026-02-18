import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { Session } from "../../domain/session/types";

/** Shared dependency interface for all session workspace panel components. */
export interface SessionPanelDeps {
	eventBus: IEventBus;
	getSession: () => Session;
	app: App;
	openFile: (path: string) => void;
	revealFolder: (path: string) => void;
	updateActivityFilter: (sessionId: string, filter: string[]) => void;
}
