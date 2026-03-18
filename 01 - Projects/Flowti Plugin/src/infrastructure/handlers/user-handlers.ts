/**
 * Handler registration for UserHub tabs.
 *
 * Bridges UserService, HubRegistry, InboxService, SessionService,
 * NudgeService, OnboardingService, TrainService, CommandRegistry → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import type { EventType, FlowtiEventMap } from "../events/events";
import { setProps } from "./handler-utils";

// Side-effect imports: register Lit custom elements
import "../../components/user/flowti-user-dashboard.js";
import "../../components/user/flowti-user-sessions.js";
import "../../components/user/flowti-user-inbox.js";
import "../../components/user/flowti-user-commands.js";
import "../../components/user/flowti-user-preferences.js";
import "../../components/user/flowti-user-health.js";

/** Session action event names keyed by action string. */
const SESSION_ACTION_EVENTS: Record<string, string> = {
	start: "session.start",
	pause: "session.pause",
	resume: "session.resume",
	end: "session.complete",
};

export interface UserHandlerDeps {
	userService: {
		getUser: () => { id: string; name: string } | null;
	};
	hubRegistry: {
		getAll: () => readonly { getHubId: () => string; getDisplayName: () => string; getIcon: () => string; getSummary: () => { stats: Array<{ label: string; value: string }> } }[];
		openHub: (hubId: string, tabId?: string, detail?: string) => void;
	};
	inboxService: {
		getItems: () => readonly unknown[];
		getUnreadCount: () => number;
		markRead: (id: string) => void;
		dismiss: (id: string) => void;
	};
	sessionService: {
		getSessions: () => readonly unknown[];
		getActiveSession: () => unknown | null;
	};
	nudgeService: {
		getConfigs: () => readonly unknown[];
		isDismissedToday: (id: string) => boolean;
	};
	onboardingService: {
		shouldShowCallout: (id: string) => boolean;
	};
	trainService: {
		getAllTrains: () => readonly unknown[];
		getActiveTrain: () => unknown | undefined;
	};
	commandRegistry: {
		getCommandsMeta: () => readonly unknown[];
	};
	settingsProvider: {
		getSettings: () => {
			inboxEnabledSources: string[];
			sessionActivityFilterGlobal: string[];
			customSessionTypes: Record<string, unknown>;
			trainFolder: string;
			defaultTrainDuration: number;
			trainMaxThoughts: number;
			trainAutoOpenTimeline: boolean;
		};
	};
	eventBus: IEventBus;
}

export function registerUserHandlers(
	registry: PluginHandlerRegistry,
	deps: UserHandlerDeps,
): void {
	// ── Dashboard handler ─────────────────────────────────

	registry.registerTabHandler("user:dashboard", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-user-dashboard");

		// Build hub stats from registry
		const hubStats = deps.hubRegistry.getAll()
			.filter((p) => p.getHubId() !== "user-hub")
			.map((p) => ({
				hubId: p.getHubId(),
				label: p.getDisplayName(),
				icon: p.getIcon(),
				statItems: p.getSummary().stats,
			}));

		// Build inbox preview (max 5)
		const inboxItems = deps.inboxService.getItems().slice(0, 5);

		// Get active session
		const activeSession = deps.sessionService.getActiveSession();

		// Show welcome if not dismissed
		const showWelcome = deps.onboardingService.shouldShowCallout("user-hub-welcome");

		setProps(el, {
			hubStats,
			inboxPreview: inboxItems,
			activeSession,
			showWelcome,
		});

		el.addEventListener("navigate-hub", ((e: CustomEvent) => {
			const { hubId } = e.detail as { hubId: string };
			deps.hubRegistry.openHub(hubId);
		}) as EventListener);

		el.addEventListener("open-inbox", () => {
			void deps.eventBus.emit("ui.navigateTab", { viewId: "user-hub", tabId: "inbox" });
		});

		el.addEventListener("select-inbox-item", ((e: CustomEvent) => {
			const { itemId } = e.detail as { itemId: string };
			void deps.eventBus.emit("ui.inboxItemSelected", { itemId });
		}) as EventListener);

		el.addEventListener("open-session", ((e: CustomEvent) => {
			const { sessionId } = e.detail as { sessionId: string };
			void deps.eventBus.emit("ui.openSessionWorkspace", { sessionId });
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Sessions handler ──────────────────────────────────

	registry.registerTabHandler("user:sessions", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-user-sessions");

		const sessions = deps.sessionService.getSessions();
		setProps(el, { sessions });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("session-selected", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.sessionSelected", e.detail as FlowtiEventMap["ui.sessionSelected"]);
		}) as EventListener);

		el.addEventListener("session-action", ((e: CustomEvent) => {
			const { sessionId, action } = e.detail as { sessionId: string; action: string };
			const eventName = SESSION_ACTION_EVENTS[action];
			if (eventName) {
				void deps.eventBus.emit(eventName as EventType, { sessionId } as FlowtiEventMap[EventType]);
			}
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Inbox handler ─────────────────────────────────────

	registry.registerTabHandler("user:inbox", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-user-inbox");

		const items = deps.inboxService.getItems();
		setProps(el, { items });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("item-selected", ((e: CustomEvent) => {
			const { itemId } = e.detail as { itemId: string };
			void deps.eventBus.emit("ui.inboxItemSelected", { itemId });
		}) as EventListener);

		el.addEventListener("mark-read", ((e: CustomEvent) => {
			const { itemId } = e.detail as { itemId: string };
			void deps.inboxService.markRead(itemId);
		}) as EventListener);

		el.addEventListener("dismiss", ((e: CustomEvent) => {
			const { itemId } = e.detail as { itemId: string };
			void deps.inboxService.dismiss(itemId);
		}) as EventListener);

		el.addEventListener("action", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.inboxAction", e.detail as FlowtiEventMap["ui.inboxAction"]);
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Commands handler ──────────────────────────────────

	registry.registerTabHandler("user:commands", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-user-commands");

		const commands = deps.commandRegistry.getCommandsMeta();
		setProps(el, { commands });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("execute-command", ((e: CustomEvent) => {
			const { commandId } = e.detail as { commandId: string };
			void deps.eventBus.emit("command.execute.request", { commandId });
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Preferences handler ───────────────────────────────

	registry.registerTabHandler("user:preferences", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-user-preferences");

		// Build settings from actual settings provider and nudge service
		const nudgeConfigs = deps.nudgeService.getConfigs();
		const currentSettings = deps.settingsProvider.getSettings();
		setProps(el, {
			settings: {
				sources: { enabled: currentSettings.inboxEnabledSources },
				session: {
					activityFilterGlobal: currentSettings.sessionActivityFilterGlobal,
					customTypes: currentSettings.customSessionTypes,
				},
				train: {
					folder: currentSettings.trainFolder,
					defaultDuration: currentSettings.defaultTrainDuration,
					maxThoughts: currentSettings.trainMaxThoughts,
					autoOpenTimeline: currentSettings.trainAutoOpenTimeline,
				},
				nudge: { configs: nudgeConfigs },
			},
			activePanel: "",
		});

		el.addEventListener("setting-changed", ((e: CustomEvent) => {
			void deps.eventBus.emit("settings.changed", e.detail as FlowtiEventMap["settings.changed"]);
		}) as EventListener);

		el.addEventListener("panel-switched", ((e: CustomEvent) => {
			const { panelId } = e.detail as { panelId: string };
			setProps(el, { activePanel: panelId });
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Health handler ────────────────────────────────────

	registry.registerTabHandler("user:health", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-user-health");

		setProps(el, {
			healthItems: [],
			searchText: "",
			selectedId: null,
		});
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("item-selected", ((e: CustomEvent) => {
			void deps.eventBus.emit("catalog.health.selected", e.detail as FlowtiEventMap["catalog.health.selected"]);
		}) as EventListener);

		container.appendChild(el);
	});
}
