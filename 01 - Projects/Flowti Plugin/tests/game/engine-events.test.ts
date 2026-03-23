// @vitest-environment happy-dom
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
			canvas: {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				parentElement: null,
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
			pushNarrativeBeat: vi.fn(),
			setActivePanel: vi.fn(),
			activePanel: null,
		},
		systems: {
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
				offEmote: vi.fn(),
			},
			social: {
				onConversation: vi.fn(),
				offConversation: vi.fn(),
				onCluster: vi.fn(),
				offCluster: vi.fn(),
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
				offReaction: vi.fn(),
				pushFeedback: vi.fn(),
			},
			engagement: {
				onEngagement: vi.fn(),
				offEngagement: vi.fn(),
				markTaskCompleted: vi.fn(),
			},
			ritual: {
				onPhase: vi.fn(),
				offPhase: vi.fn(),
			},
			tool: {
				onResult: vi.fn(),
				offResult: vi.fn(),
			},
			dayClock: {
				onPhaseChange: vi.fn(),
				offPhaseChange: vi.fn(),
				getPhase: vi.fn(() => "morning"),
				getCycleCount: vi.fn(() => 0),
			},
			worldAmbience: {
				getWeather: vi.fn(() => "clear"),
			},
			worldEvent: {
				onPhaseChange: vi.fn(),
				registerHandler: vi.fn(),
				unregisterHandler: vi.fn(),
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
			narrative: {
				recordBeat: vi.fn(),
			},
			cameraSystem: null,
		},
		scenes: {
			hub: {
				updateConnectionStatus: vi.fn(),
				updateAgents: vi.fn(),
				spawnAgent: vi.fn(),
			},
			office: {},
			village: {},
			station: {},
			map: {},
		},
		envObjects: {
			coffeeMachine: { getInteractionPoint: vi.fn(() => ({ x: 680, y: 120 })), pos: { x: 680, y: 120 } },
			whiteboard: { getInteractionPoint: vi.fn(() => ({ x: 400, y: 60 })), pos: { x: 400, y: 60 } },
			snackTable: { pos: { x: 400, y: 380 } },
			waterCooler: {},
			couch: {},
			plant: {},
			noticeBoard: {},
			merchantStall: {},
			foodBowlHub: {},
			foodBowlVillage: {},
			waterBowlOffice: {},
			waterBowlStation: {},
		},
		echoProducer: {
			onLevelUp: vi.fn(),
		},
		pets: [],
		btBridge: {
			worldState: {},
			clock: {},
			deps: {},
		},
		state: {
			allEntities: new Map(),
			cycleConversationCounts: new Map(),
			firedReactiveTriggers: new Map(),
			prevWalkingState: new Map(),
			lastTrailPos: new Map(),
			petReactionCooldowns: new Map(),
			petShareCooldowns: new Map(),
			knownEntities: new Set(),
			recentActionIds: new Set(),
			prevCycleCount: 0,
			deltaMs: 0,
			lastTime: 0,
			currentLight: { r: 0, g: 0, b: 0, opacity: 0 },
		},
		lookups: {
			findAgentActor: vi.fn(() => actor),
			findCurrentSceneActor: vi.fn(() => actor),
			findBubbleAnchor: vi.fn(),
			findNearestAgent: vi.fn(() => null),
			handleAgentSelect: vi.fn(),
			handleSceneChange: vi.fn(),
		},
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
			expect(ctx.systems.dayClock.onPhaseChange).toHaveBeenCalledTimes(1);
		});

		it("phase change callback updates store and scheduler", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.dayClock.onPhaseChange as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("morning-arrival");
			expect(ctx.store.setDayPhase).toHaveBeenCalledWith("morning-arrival");
			expect(ctx.store.pushWorldEvent).toHaveBeenCalledWith("phase-change", "Day phase: morning arrival");
			expect(ctx.systems.worldEvent.onPhaseChange).toHaveBeenCalledWith("morning-arrival");
		});
	});

	describe("wireWorldEvents", () => {
		it("registers world event handlers", () => {
			wireEvents(ctx);
			const registerHandler = ctx.systems.worldEvent.registerHandler as ReturnType<typeof vi.fn>;
			// Should have registered standup, deploy-success, tea-time, end-of-day,
			// eureka, build-break, birthday, power-flicker, new-pr = 9 events
			expect(registerHandler.mock.calls.length).toBe(9);
		});

		it("standup handler transitions idle agents to speaking", () => {
			(ctx.systems.brain.getState as ReturnType<typeof vi.fn>).mockReturnValue({ state: "idle" });
			wireEvents(ctx);
			const registerHandler = ctx.systems.worldEvent.registerHandler as ReturnType<typeof vi.fn>;
			const standupCall = registerHandler.mock.calls.find(
				(call: unknown[]) => call[0] === "standup",
			);
			expect(standupCall).toBeDefined();
			// Execute the handler
			standupCall![1]();
			expect(ctx.store.pushWorldEvent).toHaveBeenCalledWith("standup", "Morning Standup");
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("alice", "speaking");
		});
	});

	describe("wireEmoteEvents", () => {
		it("subscribes to emote system", () => {
			wireEvents(ctx);
			expect(ctx.systems.emote.onEmote).toHaveBeenCalledTimes(1);
		});

		it("emote callback shows mood bubble", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.emote.onEmote as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", 0);
			expect(ctx.systems.bubble.showBubble).toHaveBeenCalled();
			const args = (ctx.systems.bubble.showBubble as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(args[0]).toBe("alice");
			expect(args[1]).toBe("thought");
		});
	});

	describe("wireConversationEvents", () => {
		it("subscribes to social conversations and clusters", () => {
			wireEvents(ctx);
			expect(ctx.systems.social.onConversation).toHaveBeenCalledTimes(1);
			expect(ctx.systems.social.onCluster).toHaveBeenCalledTimes(1);
		});

		it("conversation callback transitions agents to speaking", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.social.onConversation as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", "bob", "Hello!", "Hey!");
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("alice", "speaking");
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("bob", "speaking");
			expect(ctx.systems.bubble.showBubble).toHaveBeenCalled();
		});

		it("conversation is skipped when agent is in transit", () => {
			(ctx.systems.registry.isInTransit as ReturnType<typeof vi.fn>).mockReturnValue(true);
			wireEvents(ctx);
			const cb = (ctx.systems.social.onConversation as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", "bob", "Hello!", "Hey!");
			expect(ctx.systems.brain.applyEvent).not.toHaveBeenCalled();
		});

		it("conversation tracks cycle counts", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.social.onConversation as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("alice", "bob", "Hello!", "Hey!");
			expect(ctx.state.cycleConversationCounts.get("alice")).toBe(1);
			expect(ctx.state.cycleConversationCounts.get("bob")).toBe(1);
		});
	});

	describe("wireSensorEvents", () => {
		it("subscribes to sensor reactions", () => {
			wireEvents(ctx);
			expect(ctx.systems.sensor.onReaction).toHaveBeenCalledTimes(1);
		});

		it("reaction with bubble shows bubble", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.sensor.onReaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", bubble: { kind: "thought", text: "Hmm" }, needsEffect: null });
			expect(ctx.systems.bubble.showBubble).toHaveBeenCalledWith("alice", "thought", "Hmm", expect.anything(), expect.anything(), 5000, true);
		});

		it("reaction with needs effect applies effect", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.sensor.onReaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", bubble: null, needsEffect: { morale: 5 } });
			expect(ctx.systems.needs.applyEffect).toHaveBeenCalledWith("alice", { morale: 5 });
		});
	});

	describe("wireEngagementEvents", () => {
		it("subscribes to engagement system", () => {
			wireEvents(ctx);
			expect(ctx.systems.engagement.onEngagement).toHaveBeenCalledTimes(1);
		});

		it("engagement callback shows bubble", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.engagement.onEngagement as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", tier: 1, bubbleKind: "thought", text: "Hey!" });
			expect(ctx.systems.bubble.showBubble).toHaveBeenCalled();
		});

		it("tier 2+ engagement walks agent toward camera", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.engagement.onEngagement as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", tier: 2, bubbleKind: "speech", text: "Come here!" });
			expect(ctx.systems.brain.walkTo).toHaveBeenCalledWith("alice", expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
		});
	});

	describe("wireRitualEvents", () => {
		it("subscribes to ritual phases", () => {
			wireEvents(ctx);
			expect(ctx.systems.ritual.onPhase).toHaveBeenCalledTimes(2);
		});

		it("gather phase transitions participants to speaking", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.ritual.onPhase as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ kind: "gather", participants: ["alice", "bob"] });
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("alice", "speaking");
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("bob", "speaking");
		});

		it("disperse phase transitions to idle and applies social effects", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.ritual.onPhase as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ kind: "disperse", participants: ["alice"] });
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("alice", "idle");
			expect(ctx.systems.needs.applyEffect).toHaveBeenCalledWith("alice", { social: 8, morale: 5 });
		});
	});

	describe("wireToolEvents", () => {
		it("subscribes to tool results", () => {
			wireEvents(ctx);
			expect(ctx.systems.tool.onResult).toHaveBeenCalledTimes(1);
		});

		it("success result pushes positive feedback", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.tool.onResult as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", success: true, output: "ok" });
			expect(ctx.systems.sensor.pushFeedback).toHaveBeenCalledWith({ type: "test-pass", data: { output: "ok" } });
			expect(ctx.systems.needs.applyEffect).toHaveBeenCalledWith("alice", { morale: 3, energy: -5 });
		});

		it("failure result pushes negative feedback", () => {
			wireEvents(ctx);
			const cb = (ctx.systems.tool.onResult as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb({ agentName: "alice", success: false, output: "err" });
			expect(ctx.systems.sensor.pushFeedback).toHaveBeenCalledWith({ type: "test-fail", data: { output: "err" } });
			expect(ctx.systems.needs.applyEffect).toHaveBeenCalledWith("alice", { morale: -2, energy: -5 });
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
			expect(ctx.systems.brain.applyEvent).toHaveBeenCalledTimes(1);
		});

		it("connection status callback updates hub and store", () => {
			wireEvents(ctx);
			const cb = (ctx.provider.onConnectionStatus as ReturnType<typeof vi.fn>).mock.calls[0][0];
			cb("connected");
			expect(ctx.scenes.hub.updateConnectionStatus).toHaveBeenCalledWith("connected");
			expect(ctx.store.setConnectionStatus).toHaveBeenCalledWith("connected");
		});
	});

	describe("wireStoreEvents", () => {
		it("registers multiple store event listeners", () => {
			wireEvents(ctx);
			// 17 store listeners: scene-change, agent-message-sent, agent-response-received,
			// task-assigned, task-completed, task-reward-earned, level-up, trust-promoted,
			// permission-decided, agent-using-tool, agent-tool-complete, state-changed
			// + narrative: task-completed, level-up, trust-promoted
			// + cli-brain-event (autonomy bridge)
			// + council auto-wake (state-changed)
			expect(ctx.store.addEventListener).toHaveBeenCalledTimes(17);
		});

		it("cleanup removes all store event listeners", () => {
			const cleanup = wireEvents(ctx);
			cleanup();
			expect(ctx.store.removeEventListener).toHaveBeenCalledTimes(17);
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

	describe("wireCouncilAutoWake", () => {
		it("wakes an AI agent when selectAgent sets a new selectedAgent", () => {
			const store = ctx.store as Record<string, unknown>;
			store.wakeAgent = vi.fn(() => Promise.resolve());
			store.agents = [{ name: "Alice", agentType: "ai", mood: "happy", domain: "engineering" }];
			store.selectedAgent = null;

			// Capture the state-changed handler registered by wireCouncilAutoWake
			const addCalls = (ctx.store.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
			wireEvents(ctx);
			const stateChangedHandlers = addCalls
				.filter((call: unknown[]) => call[0] === "state-changed")
				.map((call: unknown[]) => call[1] as () => void);
			// The last state-changed handler is from wireCouncilAutoWake
			const autoWakeHandler = stateChangedHandlers[stateChangedHandlers.length - 1];

			// Simulate selecting an AI agent
			store.selectedAgent = "Alice";
			autoWakeHandler();
			expect(store.wakeAgent).toHaveBeenCalledWith("Alice");
		});

		it("does NOT wake when selectedAgent is null (deselect)", () => {
			const store = ctx.store as Record<string, unknown>;
			store.wakeAgent = vi.fn(() => Promise.resolve());
			store.agents = [{ name: "Alice", agentType: "ai", mood: "happy", domain: "engineering" }];
			store.selectedAgent = null;

			const addCalls = (ctx.store.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
			wireEvents(ctx);
			const stateChangedHandlers = addCalls
				.filter((call: unknown[]) => call[0] === "state-changed")
				.map((call: unknown[]) => call[1] as () => void);
			const autoWakeHandler = stateChangedHandlers[stateChangedHandlers.length - 1];

			// selectedAgent stays null
			autoWakeHandler();
			expect(store.wakeAgent).not.toHaveBeenCalled();
		});

		it("does NOT wake when the same agent is re-selected (no change)", () => {
			const store = ctx.store as Record<string, unknown>;
			store.wakeAgent = vi.fn(() => Promise.resolve());
			store.agents = [{ name: "Alice", agentType: "ai", mood: "happy", domain: "engineering" }];
			store.selectedAgent = null;

			const addCalls = (ctx.store.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
			wireEvents(ctx);
			const stateChangedHandlers = addCalls
				.filter((call: unknown[]) => call[0] === "state-changed")
				.map((call: unknown[]) => call[1] as () => void);
			const autoWakeHandler = stateChangedHandlers[stateChangedHandlers.length - 1];

			// First select — should wake
			store.selectedAgent = "Alice";
			autoWakeHandler();
			expect(store.wakeAgent).toHaveBeenCalledTimes(1);

			// Same agent still selected — should NOT wake again
			autoWakeHandler();
			expect(store.wakeAgent).toHaveBeenCalledTimes(1);
		});
	});
});
