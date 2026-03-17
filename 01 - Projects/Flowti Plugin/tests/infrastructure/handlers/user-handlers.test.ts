// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerUserHandlers } from "../../../src/infrastructure/handlers/user-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/user/flowti-user-dashboard";
import "../../../src/components/user/flowti-user-sessions";
import "../../../src/components/user/flowti-user-inbox";
import "../../../src/components/user/flowti-user-commands";
import "../../../src/components/user/flowti-user-preferences";
import "../../../src/components/user/flowti-user-health";

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createMockUserService() {
	return {
		getUser: vi.fn(() => ({ id: "u1", name: "Test User" })),
	};
}

function createMockHubRegistry() {
	return {
		getAll: vi.fn(() => []),
		openHub: vi.fn(),
	};
}

function createMockInboxService() {
	return {
		getItems: vi.fn(() => []),
		getUnreadCount: vi.fn(() => 0),
		markRead: vi.fn(),
		markAllRead: vi.fn(),
		clearAll: vi.fn(),
		dismiss: vi.fn(),
	};
}

function createMockSessionService() {
	return {
		getSessions: vi.fn(() => []),
		getActiveSession: vi.fn(() => null),
		getSessionById: vi.fn(() => null),
		getSavedTemplates: vi.fn(() => []),
	};
}

function createMockNudgeService() {
	return {
		getConfigs: vi.fn(() => []),
		isDismissedToday: vi.fn(() => false),
	};
}

function createMockOnboardingService() {
	return {
		shouldShowCallout: vi.fn(() => false),
		isCalloutDismissed: vi.fn(() => true),
	};
}

function createMockTrainService() {
	return {
		getAllTrains: vi.fn(() => []),
		getActiveTrain: vi.fn(() => undefined),
	};
}

function createMockCommandRegistry() {
	return {
		getCommandsMeta: vi.fn(() => []),
	};
}

describe("registerUserHandlers", () => {
	let registry: PluginHandlerRegistry;
	let eventBus: IEventBus;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		eventBus = createMockEventBus();
		registerUserHandlers(registry, {
			userService: createMockUserService() as never,
			hubRegistry: createMockHubRegistry() as never,
			inboxService: createMockInboxService() as never,
			sessionService: createMockSessionService() as never,
			nudgeService: createMockNudgeService() as never,
			onboardingService: createMockOnboardingService() as never,
			trainService: createMockTrainService() as never,
			commandRegistry: createMockCommandRegistry() as never,
			eventBus,
		});
	});

	it("registers all 6 tab handlers", () => {
		expect(registry.getTabHandler("user:dashboard")).toBeDefined();
		expect(registry.getTabHandler("user:sessions")).toBeDefined();
		expect(registry.getTabHandler("user:inbox")).toBeDefined();
		expect(registry.getTabHandler("user:commands")).toBeDefined();
		expect(registry.getTabHandler("user:preferences")).toBeDefined();
		expect(registry.getTabHandler("user:health")).toBeDefined();
	});

	describe("dashboard handler", () => {
		it("creates flowti-user-dashboard element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:dashboard")!(container, { tabId: "dashboard", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-dashboard");
			expect(el).not.toBeNull();
		});

		it("wires navigate-hub event to hubRegistry.openHub", () => {
			const hubRegistry = createMockHubRegistry();
			const reg = new PluginHandlerRegistry();
			registerUserHandlers(reg, {
				userService: createMockUserService() as never,
				hubRegistry: hubRegistry as never,
				inboxService: createMockInboxService() as never,
				sessionService: createMockSessionService() as never,
				nudgeService: createMockNudgeService() as never,
				onboardingService: createMockOnboardingService() as never,
				trainService: createMockTrainService() as never,
				commandRegistry: createMockCommandRegistry() as never,
				eventBus,
			});
			const container = document.createElement("div");
			reg.getTabHandler("user:dashboard")!(container, { tabId: "dashboard", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-dashboard")!;
			el.dispatchEvent(new CustomEvent("navigate-hub", { detail: { hubId: "event-catalog" }, bubbles: true }));
			expect(hubRegistry.openHub).toHaveBeenCalledWith("event-catalog");
		});
	});

	describe("sessions handler", () => {
		it("creates flowti-user-sessions element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:sessions")!(container, { tabId: "sessions", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-sessions");
			expect(el).not.toBeNull();
		});

		it("sets sessions property from service", () => {
			const sessions = [{ id: "s1", title: "Test", status: "running" }];
			const sessionService = createMockSessionService();
			sessionService.getSessions.mockReturnValue(sessions as never);

			const reg = new PluginHandlerRegistry();
			registerUserHandlers(reg, {
				userService: createMockUserService() as never,
				hubRegistry: createMockHubRegistry() as never,
				inboxService: createMockInboxService() as never,
				sessionService: sessionService as never,
				nudgeService: createMockNudgeService() as never,
				onboardingService: createMockOnboardingService() as never,
				trainService: createMockTrainService() as never,
				commandRegistry: createMockCommandRegistry() as never,
				eventBus,
			});

			const container = document.createElement("div");
			reg.getTabHandler("user:sessions")!(container, { tabId: "sessions", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-sessions") as unknown as { sessions: unknown[] };
			expect(el.sessions).toEqual(sessions);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:sessions")!(container, { tabId: "sessions", viewId: "user-hub", eventBus, searchText: "review" });
			const el = container.querySelector("flowti-user-sessions") as unknown as { searchText: string };
			expect(el.searchText).toBe("review");
		});

		it("wires session-action to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:sessions")!(container, { tabId: "sessions", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-sessions")!;
			el.dispatchEvent(new CustomEvent("session-action", { detail: { sessionId: "s1", action: "pause" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("session.pause", { sessionId: "s1" });
		});
	});

	describe("inbox handler", () => {
		it("creates flowti-user-inbox element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:inbox")!(container, { tabId: "inbox", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-inbox");
			expect(el).not.toBeNull();
		});

		it("wires mark-read to inboxService", () => {
			const inboxService = createMockInboxService();
			const reg = new PluginHandlerRegistry();
			registerUserHandlers(reg, {
				userService: createMockUserService() as never,
				hubRegistry: createMockHubRegistry() as never,
				inboxService: inboxService as never,
				sessionService: createMockSessionService() as never,
				nudgeService: createMockNudgeService() as never,
				onboardingService: createMockOnboardingService() as never,
				trainService: createMockTrainService() as never,
				commandRegistry: createMockCommandRegistry() as never,
				eventBus,
			});

			const container = document.createElement("div");
			reg.getTabHandler("user:inbox")!(container, { tabId: "inbox", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-inbox")!;
			el.dispatchEvent(new CustomEvent("mark-read", { detail: { itemId: "i1" }, bubbles: true }));
			expect(inboxService.markRead).toHaveBeenCalledWith("i1");
		});

		it("wires dismiss to inboxService", () => {
			const inboxService = createMockInboxService();
			const reg = new PluginHandlerRegistry();
			registerUserHandlers(reg, {
				userService: createMockUserService() as never,
				hubRegistry: createMockHubRegistry() as never,
				inboxService: inboxService as never,
				sessionService: createMockSessionService() as never,
				nudgeService: createMockNudgeService() as never,
				onboardingService: createMockOnboardingService() as never,
				trainService: createMockTrainService() as never,
				commandRegistry: createMockCommandRegistry() as never,
				eventBus,
			});

			const container = document.createElement("div");
			reg.getTabHandler("user:inbox")!(container, { tabId: "inbox", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-inbox")!;
			el.dispatchEvent(new CustomEvent("dismiss", { detail: { itemId: "i1" }, bubbles: true }));
			expect(inboxService.dismiss).toHaveBeenCalledWith("i1");
		});
	});

	describe("commands handler", () => {
		it("creates flowti-user-commands element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:commands")!(container, { tabId: "commands", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-commands");
			expect(el).not.toBeNull();
		});

		it("wires execute-command to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:commands")!(container, { tabId: "commands", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-commands")!;
			el.dispatchEvent(new CustomEvent("execute-command", { detail: { commandId: "cmd-1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("command.execute.request", { commandId: "cmd-1" });
		});
	});

	describe("preferences handler", () => {
		it("creates flowti-user-preferences element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:preferences")!(container, { tabId: "preferences", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-preferences");
			expect(el).not.toBeNull();
		});
	});

	describe("health handler", () => {
		it("creates flowti-user-health element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:health")!(container, { tabId: "health", viewId: "user-hub", eventBus });
			const el = container.querySelector("flowti-user-health");
			expect(el).not.toBeNull();
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("user:health")!(container, { tabId: "health", viewId: "user-hub", eventBus, searchText: "domain" });
			const el = container.querySelector("flowti-user-health") as unknown as { searchText: string };
			expect(el.searchText).toBe("domain");
		});
	});
});
