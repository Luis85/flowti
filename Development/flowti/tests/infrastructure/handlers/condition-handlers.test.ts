import { describe, it, expect, beforeEach } from "vitest";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { registerConditionHandlers, type ConditionHandlerDeps } from "../../../src/infrastructure/handlers/condition-handlers";

describe("registerConditionHandlers", () => {
	let registry: PluginHandlerRegistry;
	let deps: ConditionHandlerDeps;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		deps = {
			trainService: {
				getActiveTrain: () => null,
			},
			sessionService: {
				getActiveSession: () => null,
			},
			installerService: {
				isInstalled: () => false,
			},
		};
	});

	it("registers all 6 condition handlers", () => {
		registerConditionHandlers(registry, deps);
		expect(registry.getCondition("no-active-train")).toBeDefined();
		expect(registry.getCondition("train-not-paused")).toBeDefined();
		expect(registry.getCondition("train-not-running")).toBeDefined();
		expect(registry.getCondition("no-active-session")).toBeDefined();
		expect(registry.getCondition("session-not-paused")).toBeDefined();
		expect(registry.getCondition("is-installed")).toBeDefined();
	});

	describe("no-active-train", () => {
		it("returns true when no active train", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-train")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when active train exists", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-train")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("train-not-paused", () => {
		it("returns true when train is running (not paused)", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when train is paused", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "paused" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});

		it("returns true when no active train", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});
	});

	describe("train-not-running", () => {
		it("returns true when train is paused", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "paused" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-running")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when train is running", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-running")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("no-active-session", () => {
		it("returns true when no active session", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-session")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when active session exists", () => {
			deps.sessionService.getActiveSession = () => ({ id: "s1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-session")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("session-not-paused", () => {
		it("returns true when session is running", () => {
			deps.sessionService.getActiveSession = () => ({ id: "s1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("session-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when session is paused", () => {
			deps.sessionService.getActiveSession = () => ({ id: "s1", status: "paused" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("session-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("is-installed", () => {
		it("returns true when installed", () => {
			deps.installerService.isInstalled = () => true;
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("is-installed")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when not installed", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("is-installed")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});
});
