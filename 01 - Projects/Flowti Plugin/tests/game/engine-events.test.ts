import { describe, it, expect, vi, beforeEach } from "vitest";
import { wireEvents } from "../../src/game/engine-events.js";
import type { EngineContext } from "../../src/game/engine-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function noop(): void {}

function mockActor() {
	return {
		pos: { x: 100, y: 100 },
		focus: vi.fn(),
		hideLlmIndicator: vi.fn(),
		showLlmIndicator: vi.fn(),
		hideToolIndicator: vi.fn(),
		showToolIndicator: vi.fn(),
	};
}

function createMockContext(): EngineContext {
	const actor = mockActor();

	return {
		engine: {
			currentScene: {
				camera: { pos: { x: 400, y: 250 } },
			},
		},
		provider: {
			onAction: vi.fn(() => noop),
			onConnectionStatus: vi.fn(() => noop),
			onEntityUpdate: vi.fn(() => noop),
		},
		store: {
			agents: [{ name: "alice", mood: "happy", domain: "engineering" }],
			selectedAgent: null,
			followedAgent: null,
			taskLockedAgents: new Set<string>(),
			llmStatus: new Map(),
			setDayPhase: vi.fn(),
			setWeatherState: vi.fn(),
			pushWorldEvent: vi.fn(),
			setConnectionStatus: vi.fn(),
			setAgents: vi.fn(),
			selectAgent: vi.fn(),
			selectTab: vi.fn(),
			pushAgentThought: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		},
		brain: {
			applyEvent: vi.fn(),
			getState: vi.fn(() => ({ state: "idle", params: { socialRadius: 100, quoteFrequency: 0.5 } })),
			walkTo: vi.fn(),
			assignWork: vi.fn(),
			releaseWork: vi.fn(),
			register: vi.fn(),
		},
		bubble: {
			showBubble: vi.fn(),
		},
		talk: {
			silence: vi.fn(),
			activate: vi.fn(),
		},
		particlePool: {
			spawnPreset: vi.fn(),
		},
		emote: {
			onEmote: vi.fn(),
		},
		social: {
			onConversation: vi.fn(),
			onCluster: vi.fn(),
		},
		needs: {
			getAgentNames: vi.fn(() => ["alice"]),
			applyEffect: vi.fn(),
			getMood: vi.fn(() => "happy"),
			getNeeds: vi.fn(() => ({ energy: 50, social: 50, focus: 50, morale: 50 })),
		},
		director: {
			recordInteraction: vi.fn(() => ({ moraleEffect: 0 })),
		},
		sensor: {
			onReaction: vi.fn(),
			pushFeedback: vi.fn(),
		},
		engagement: {
			onEngagement: vi.fn(),
			markTaskCompleted: vi.fn(),
		},
		ritual: {
			onPhase: vi.fn(),
		},
		tool: {
			onResult: vi.fn(),
		},
		dayClock: {
			onPhaseChange: vi.fn(),
		},
		worldAmbience: {
			getWeather: vi.fn(() => "clear"),
		},
		worldEvent: {
			onPhaseChange: vi.fn(),
			registerHandler: vi.fn(),
		},
		memory: {},
		quirk: {},
		relationship: {
			recordConversation: vi.fn(),
			shouldBicker: vi.fn(() => false),
			recordBicker: vi.fn(),
			getOpinions: vi.fn(() => []),
			recordCluster: vi.fn(),
		},
		bt: {},
		registry: {
			isInTransit: vi.fn(() => false),
			setEntityRoom: vi.fn(),
			getScene: vi.fn(),
		},
		roomSwitcher: {},
		cameraSystem: null,
		btWorldState: {},
		btClock: {},
		btDeps: {},
		hubScene: {
			updateConnectionStatus: vi.fn(),
			updateAgents: vi.fn(),
			spawnAgent: vi.fn(),
		},
		officeScene: {},
		villageScene: {},
		stationScene: {},
		roomScenes: {},
		coffeeMachine: { getInteractionPoint: vi.fn(() => ({ x: 680, y: 120 })), pos: { x: 680, y: 120 } },
		whiteboard: { getInteractionPoint: vi.fn(() => ({ x: 400, y: 60 })), pos: { x: 400, y: 60 } },
		snackTable: { pos: { x: 400, y: 380 } },
		waterCooler: {},
		couch: {},
		plant: {},
		noticeBoard: {},
		pets: [],
		allEntities: new Map(),
		cycleConversationCounts: new Map(),
		firedReactiveTriggers: new Map(),
		prevWalkingState: new Map(),
		lastTrailPos: new Map(),
		petReactionCooldowns: new Map(),
		knownEntities: new Set(),
		recentActionIds: new Set(),
		prevCycleCount: 0,
		deltaMs: 0,
		lastTime: 0,
		currentLight: { r: 0, g: 0, b: 0, opacity: 0 },
		findAgentActor: vi.fn(() => actor),
		findCurrentSceneActor: vi.fn(() => actor),
		findNearestAgent: vi.fn(() => null),
		handleAgentSelect: vi.fn(),
		handleSceneChange: vi.fn(),
	} as unknown as EngineContext;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("engine-events", () => {
	let ctx: EngineContext;

	beforeEach(() => {
		ctx = createMockContext();
	});

	describe("wireEvents", () => {
		it("returns a function", () => {
			const cleanup = wireEvents(ctx);
			expect(typeof cleanup).toBe("function");
		});

		it("cleanup does not throw", () => {
			const cleanup = wireEvents(ctx);
			expect(() => cleanup()).not.toThrow();
		});

		it("can be called multiple times without error", () => {
			const cleanup = wireEvents(ctx);
			expect(() => {
				cleanup();
				cleanup();
			}).not.toThrow();
		});
	});

	describe("wireDayClockEvents", () => {
		it("subscribes to dayClock phase changes", () => {
			wireEvents(ctx);
			expect(ctx.dayClock.onPhaseChange).toHaveBeenCalledTimes(1);
		});

		it("phase change callback updates store and scheduler", () => {
			wireEvents(ctx);
			const cb = (ctx.dayClock.onPhaseChange as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("morning-arrival");
			expect(ctx.store.setDayPhase).toHaveBeenCalledWith("morning-arrival");
			expect(ctx.store.pushWorldEvent).toHaveBeenCalledWith("phase-change", "Day phase: morning arrival");
			expect(ctx.worldEvent.onPhaseChange).toHaveBeenCalledWith("morning-arrival");
		});
	});

	describe("wireWorldEvents", () => {
		it("registers world event handlers", () => {
			wireEvents(ctx);
			const registerHandler = ctx.worldEvent.registerHandler as ReturnType<typeof vi.fn>;
			// Should have registered standup, deploy-success, tea-time, end-of-day,
			// eureka, build-break, birthday, power-flicker, new-pr = 9 events
			expect(registerHandler.mock.calls.length).toBe(9);
		});

		it("standup handler transitions idle agents to speaking", () => {
			(ctx.brain.getState as ReturnType<typeof vi.fn>).mockReturnValue({ state: "idle" });
			wireEvents(ctx);
			const registerHandler = ctx.worldEvent.registerHandler as ReturnType<typeof vi.fn>;
			const standupCall = registerHandler.mock.calls.find(
				(call: unknown[]) => call[0] === "standup",
			);
			expect(standupCall).toBeDefined();
			// Execute the handler
			standupCall![1]();
			expect(ctx.store.pushWorldEvent).toHaveBeenCalledWith("standup", "Morning Standup");
			expect(ctx.brain.applyEvent).toHaveBeenCalledWith("alice", "speaking");
		});
	});

	describe("wireEmoteEvents", () => {
		it("subscribes to emote system", () => {
			wireEvents(ctx);
			expect(ctx.emote.onEmote).toHaveBeenCalledTimes(1);
		});

		it("emote callback shows mood bubble", () => {
			wireEvents(ctx);
			const cb = (ctx.emote.onEmote as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", 0);
			expect(ctx.bubble.showBubble).toHaveBeenCalled();
			const args = (ctx.bubble.showBubble as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(args[0]).toBe("alice");
			expect(args[1]).toBe("thought");
		});
	});

	describe("wireConversationEvents", () => {
		it("subscribes to social conversations and clusters", () => {
			wireEvents(ctx);
			expect(ctx.social.onConversation).toHaveBeenCalledTimes(1);
			expect(ctx.social.onCluster).toHaveBeenCalledTimes(1);
		});

		it("conversation callback transitions agents to speaking", () => {
			wireEvents(ctx);
			const cb = (ctx.social.onConversation as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", "bob", "Hello!", "Hey!");
			expect(ctx.brain.applyEvent).toHaveBeenCalledWith("alice", "speaking");
			expect(ctx.brain.applyEvent).toHaveBeenCalledWith("bob", "speaking");
			expect(ctx.bubble.showBubble).toHaveBeenCalled();
		});

		it("conversation is skipped when agent is in transit", () => {
			(ctx.registry.isInTransit as ReturnType<typeof vi.fn>).mockReturnValue(true);
			wireEvents(ctx);
			const cb = (ctx.social.onConversation as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", "bob", "Hello!", "Hey!");
			expect(ctx.brain.applyEvent).not.toHaveBeenCalled();
		});

		it("conversation tracks cycle counts", () => {
			wireEvents(ctx);
			const cb = (ctx.social.onConversation as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", "bob", "Hello!", "Hey!");
			expect(ctx.cycleConversationCounts.get("alice")).toBe(1);
			expect(ctx.cycleConversationCounts.get("bob")).toBe(1);
		});
	});

	describe("wireSensorEvents", () => {
		it("subscribes to sensor reactions", () => {
			wireEvents(ctx);
			expect(ctx.sensor.onReaction).toHaveBeenCalledTimes(1);
		});

		it("reaction with bubble shows bubble", () => {
			wireEvents(ctx);
			const cb = (ctx.sensor.onReaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", bubble: { kind: "thought", text: "Hmm" }, needsEffect: null });
			expect(ctx.bubble.showBubble).toHaveBeenCalledWith("alice", "thought", "Hmm", expect.anything(), expect.anything(), 5000, true);
		});

		it("reaction with needs effect applies effect", () => {
			wireEvents(ctx);
			const cb = (ctx.sensor.onReaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", bubble: null, needsEffect: { morale: 5 } });
			expect(ctx.needs.applyEffect).toHaveBeenCalledWith("alice", { morale: 5 });
		});
	});

	describe("wireEngagementEvents", () => {
		it("subscribes to engagement system", () => {
			wireEvents(ctx);
			expect(ctx.engagement.onEngagement).toHaveBeenCalledTimes(1);
		});

		it("engagement callback shows bubble", () => {
			wireEvents(ctx);
			const cb = (ctx.engagement.onEngagement as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", tier: 1, bubbleKind: "thought", text: "Hey!" });
			expect(ctx.bubble.showBubble).toHaveBeenCalled();
		});

		it("tier 2+ engagement walks agent toward camera", () => {
			wireEvents(ctx);
			const cb = (ctx.engagement.onEngagement as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", tier: 2, bubbleKind: "speech", text: "Come here!" });
			expect(ctx.brain.walkTo).toHaveBeenCalledWith("alice", expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
		});
	});

	describe("wireRitualEvents", () => {
		it("subscribes to ritual phases", () => {
			wireEvents(ctx);
			expect(ctx.ritual.onPhase).toHaveBeenCalledTimes(1);
		});

		it("gather phase transitions participants to speaking", () => {
			wireEvents(ctx);
			const cb = (ctx.ritual.onPhase as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ kind: "gather", participants: ["alice", "bob"] });
			expect(ctx.brain.applyEvent).toHaveBeenCalledWith("alice", "speaking");
			expect(ctx.brain.applyEvent).toHaveBeenCalledWith("bob", "speaking");
		});

		it("disperse phase transitions to idle and applies social effects", () => {
			wireEvents(ctx);
			const cb = (ctx.ritual.onPhase as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ kind: "disperse", participants: ["alice"] });
			expect(ctx.brain.applyEvent).toHaveBeenCalledWith("alice", "idle");
			expect(ctx.needs.applyEffect).toHaveBeenCalledWith("alice", { social: 8, morale: 5 });
		});
	});

	describe("wireToolEvents", () => {
		it("subscribes to tool results", () => {
			wireEvents(ctx);
			expect(ctx.tool.onResult).toHaveBeenCalledTimes(1);
		});

		it("success result pushes positive feedback", () => {
			wireEvents(ctx);
			const cb = (ctx.tool.onResult as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", success: true, output: "ok" });
			expect(ctx.sensor.pushFeedback).toHaveBeenCalledWith({ type: "test-pass", data: { output: "ok" } });
			expect(ctx.needs.applyEffect).toHaveBeenCalledWith("alice", { morale: 3, energy: -5 });
		});

		it("failure result pushes negative feedback", () => {
			wireEvents(ctx);
			const cb = (ctx.tool.onResult as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", success: false, output: "err" });
			expect(ctx.sensor.pushFeedback).toHaveBeenCalledWith({ type: "test-fail", data: { output: "err" } });
			expect(ctx.needs.applyEffect).toHaveBeenCalledWith("alice", { morale: -2, energy: -5 });
		});
	});

	describe("wireProviderEvents", () => {
		it("subscribes to all three provider events", () => {
			wireEvents(ctx);
			expect(ctx.provider.onAction).toHaveBeenCalledTimes(1);
			expect(ctx.provider.onConnectionStatus).toHaveBeenCalledTimes(1);
			expect(ctx.provider.onEntityUpdate).toHaveBeenCalledTimes(1);
		});

		it("cleanup calls provider unsubscribe functions", () => {
			const unsubAction = vi.fn();
			const unsubConnection = vi.fn();
			const unsubEntity = vi.fn();
			(ctx.provider.onAction as ReturnType<typeof vi.fn>).mockReturnValue(unsubAction);
			(ctx.provider.onConnectionStatus as ReturnType<typeof vi.fn>).mockReturnValue(unsubConnection);
			(ctx.provider.onEntityUpdate as ReturnType<typeof vi.fn>).mockReturnValue(unsubEntity);

			const cleanup = wireEvents(ctx);
			cleanup();

			expect(unsubAction).toHaveBeenCalledTimes(1);
			expect(unsubConnection).toHaveBeenCalledTimes(1);
			expect(unsubEntity).toHaveBeenCalledTimes(1);
		});

		it("action handler deduplicates by action id", () => {
			wireEvents(ctx);
			const cb = (ctx.provider.onAction as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ id: "a1", agentName: "alice", type: "idle", data: {} });
			cb({ id: "a1", agentName: "alice", type: "idle", data: {} });
			// brain.applyEvent should only be called once (dedup)
			expect(ctx.brain.applyEvent).toHaveBeenCalledTimes(1);
		});

		it("connection status callback updates hub and store", () => {
			wireEvents(ctx);
			const cb = (ctx.provider.onConnectionStatus as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("connected");
			expect(ctx.hubScene.updateConnectionStatus).toHaveBeenCalledWith("connected");
			expect(ctx.store.setConnectionStatus).toHaveBeenCalledWith("connected");
		});
	});

	describe("wireStoreEvents", () => {
		it("registers multiple store event listeners", () => {
			wireEvents(ctx);
			// 9 store listeners: scene-change, agent-message-sent, agent-response-received,
			// task-assigned, task-completed, permission-decided, agent-using-tool,
			// agent-tool-complete, state-changed
			expect(ctx.store.addEventListener).toHaveBeenCalledTimes(9);
		});

		it("cleanup removes all store event listeners", () => {
			const cleanup = wireEvents(ctx);
			cleanup();
			expect(ctx.store.removeEventListener).toHaveBeenCalledTimes(9);
		});

		it("registered event names match expected set", () => {
			wireEvents(ctx);
			const addCalls = (ctx.store.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
			const eventNames = addCalls.map((call: unknown[]) => call[0]);
			expect(eventNames).toContain("scene-change");
			expect(eventNames).toContain("agent-message-sent");
			expect(eventNames).toContain("agent-response-received");
			expect(eventNames).toContain("task-assigned");
			expect(eventNames).toContain("task-completed");
			expect(eventNames).toContain("permission-decided");
			expect(eventNames).toContain("agent-using-tool");
			expect(eventNames).toContain("agent-tool-complete");
			expect(eventNames).toContain("state-changed");
		});
	});
});
