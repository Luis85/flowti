/**
 * engine-events.ts — Consolidated event wiring for the game engine.
 *
 * All system event subscriptions extracted from engine.ts. Each wire*
 * function subscribes to events from one system and returns an
 * unsubscribe function (or no-op if the system lacks unsubscribe).
 *
 * wireEvents() composes them all and returns a single cleanup function.
 */

import type { EngineContext } from "./engine-types.js";
import { wireCliBrainBridge } from "./engine-simulation.js";
import { wireStoreEvents } from "./engine-events-store.js";
import type { AgentAction, DashboardAgent, WorldEntity } from "./data/types.js";
import type { DayPhase } from "./data/day-phase-config.js";
import type { SensorReaction } from "./data/sensor-rules.js";
import type { EngagementEvent } from "./systems/engagement-system.js";
import type { RitualPhase } from "./systems/ritual-system.js";
import type { ToolResult } from "./systems/tool-executor-system.js";
import { extractAgentMessage } from "./data/message-utils.js";
import {
	MOOD_TEXTS, SOCIAL_EMOJIS, REACTION_EMOJIS, FOLLOW_UP_STRINGS,
	SOCIAL_EMOJI_CHANCE, EMOJI_REACTION_CHANCE, FOLLOW_UP_CHANCE,
	ACTION_DEDUP_TTL,
} from "./engine-config.js";
import {
	pickTemplate,
	STANDUP_TEMPLATES, DEPLOY_SUCCESS_TEMPLATES, END_OF_DAY_TEMPLATES,
	EUREKA_TEMPLATES, BUILD_BREAK_REACTION_TEMPLATES, BUILD_BREAK_RESOLVE_TEMPLATES,
	BIRTHDAY_TEMPLATES, POWER_FLICKER_REACTION_TEMPLATES, POWER_FLICKER_RESOLVE_TEMPLATES,
	NEW_PR_TEMPLATES, TEA_TIME_TEMPLATES,
} from "./data/micro-event-templates.js";
import { HUDDLE_TEMPLATES } from "./data/huddle-templates.js";
import { interpolateTemplate } from "./data/engagement-templates.js";
import { BICKER_TEMPLATES } from "./data/relationship-templates.js";
import { findClashLabels } from "./data/opinion-topics.js";
import { resolveSettingForDomain } from "./config/domain-map.js";
import { MERCHANT_CATALOG } from "./data/merchant-catalog.js";

// ── Helpers ──────────────────────────────────────────────────────────

const pick = (arr: readonly string[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Wraps worldEventScheduler.registerHandler so that every micro-event
 * also pushes an entry to the world event log in the store.
 */
function registerWorldEvent(
	ctx: EngineContext,
	type: string,
	label: string,
	handler: () => void,
): void {
	ctx.systems.worldEvent.registerHandler(type, () => {
		ctx.store.pushWorldEvent(type, label);
		handler();
	});
}

// ── Day clock events ─────────────────────────────────────────────────

function wireDayClockEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const cb = (phase: DayPhase) => {
		ctx.store.setDayPhase(phase);
		ctx.store.setWeatherState(sys.worldAmbience.getWeather());
		ctx.store.pushWorldEvent("phase-change", `Day phase: ${phase.replace(/-/g, " ")}`);
		sys.worldEvent.onPhaseChange(phase);
	};
	sys.dayClock.onPhaseChange(cb);
	return () => sys.dayClock.offPhaseChange(cb);
}

// ── World micro-event handlers ───────────────────────────────────────

function wireWorldEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const registeredTypes: string[] = [];
	const registerWorldEventTracked = (type: string, label: string, handler: () => void): void => {
		registeredTypes.push(type);
		registerWorldEvent(ctx, type, label, handler);
	};

	registerWorldEventTracked("standup", "Morning Standup", () => {
		const agents = sys.needs.getAgentNames().filter((n) => !sys.registry.isInTransit(n));
		for (const name of agents) {
			const state = sys.brain.getState(name)?.state;
			if (state === "idle" || state === "wandering") sys.brain.applyEvent(name, "speaking");
		}
		agents.forEach((name, i) => {
			setTimeout(() => {
				sys.bubble.showBubble(name, "thought", pickTemplate(STANDUP_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
			}, i * 2000);
		});
		setTimeout(() => {
			for (const name of agents) sys.brain.applyEvent(name, "idle");
		}, agents.length * 2000 + 2000);
	});

	registerWorldEventTracked("deploy-success", "Deploy Success", () => {
		const agents = sys.needs.getAgentNames();
		const celebrant = agents[Math.floor(Math.random() * agents.length)];
		if (celebrant) {
			sys.bubble.showBubble(celebrant, "speech", pickTemplate(DEPLOY_SUCCESS_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
			const actor = ctx.lookups.findAgentActor(celebrant);
			if (actor) sys.particlePool.spawnPreset("confetti", actor.pos.x, actor.pos.y - 20);
			sys.needs.applyEffect(celebrant, { morale: 5 });
		}
	});

	registerWorldEventTracked("tea-time", "Tea Time", () => {
		const idle = sys.needs.getAgentNames().filter((n) => sys.brain.getState(n)?.state === "idle");
		const teaGroup = idle.slice(0, 3);
		for (const name of teaGroup) {
			sys.brain.walkTo(name, ctx.envObjects.coffeeMachine.getInteractionPoint());
			sys.bubble.showBubble(name, "thought", pickTemplate(TEA_TIME_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
		}
	});

	registerWorldEventTracked("end-of-day", "End of Day", () => {
		for (const name of sys.needs.getAgentNames()) {
			sys.bubble.showBubble(name, "thought", pickTemplate(END_OF_DAY_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
		}
	});

	registerWorldEventTracked("eureka", "Eureka Moment", () => {
		const working = sys.needs.getAgentNames().filter((n) => sys.brain.getState(n)?.state === "working");
		if (working.length > 0) {
			const agent = working[Math.floor(Math.random() * working.length)];
			sys.bubble.showBubble(agent, "speech", pickTemplate(EUREKA_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
			const actor = ctx.lookups.findAgentActor(agent);
			if (actor) sys.particlePool.spawnPreset("sparkle", actor.pos.x, actor.pos.y - 20);
			sys.needs.applyEffect(agent, { morale: 8, focus: 5 });
		}
	});

	registerWorldEventTracked("build-break", "Build Break", () => {
		for (const name of sys.needs.getAgentNames()) {
			sys.bubble.showBubble(name, "thought", pickTemplate(BUILD_BREAK_REACTION_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2000);
			sys.needs.applyEffect(name, { morale: -3 });
		}
		sys.particlePool.spawnPreset("alert", 400, 250);
		setTimeout(() => {
			const resolver = sys.needs.getAgentNames()[0];
			if (resolver) sys.bubble.showBubble(resolver, "speech", pickTemplate(BUILD_BREAK_RESOLVE_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
		}, 10_000);
	});

	registerWorldEventTracked("birthday", "Birthday", () => {
		const agents = sys.needs.getAgentNames();
		const birthdayAgent = agents[Math.floor(Math.random() * agents.length)];
		if (birthdayAgent) {
			sys.bubble.showBubble(birthdayAgent, "speech", pickTemplate(BIRTHDAY_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
			sys.particlePool.spawnPreset("confetti", ctx.envObjects.snackTable.pos.x, ctx.envObjects.snackTable.pos.y - 20);
			for (const name of agents) sys.needs.applyEffect(name, { morale: 3 });
		}
	});

	registerWorldEventTracked("power-flicker", "Power Flicker", () => {
		for (const name of sys.needs.getAgentNames()) {
			sys.bubble.showBubble(name, "thought", pickTemplate(POWER_FLICKER_REACTION_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 1500);
		}
		setTimeout(() => {
			const ops = sys.needs.getAgentNames()[0];
			if (ops) sys.bubble.showBubble(ops, "speech", pickTemplate(POWER_FLICKER_RESOLVE_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
		}, 2000);
	});

	registerWorldEventTracked("new-pr", "New PR", () => {
		const agents = sys.needs.getAgentNames();
		const author = agents[Math.floor(Math.random() * agents.length)];
		if (author) {
			sys.brain.walkTo(author, ctx.envObjects.whiteboard.getInteractionPoint());
			setTimeout(() => {
				sys.bubble.showBubble(author, "thought", pickTemplate(NEW_PR_TEMPLATES), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
				sys.particlePool.spawnPreset("scribble", ctx.envObjects.whiteboard.pos.x, ctx.envObjects.whiteboard.pos.y);
			}, 3000);
		}
	});

	return () => {
		for (const type of registeredTypes) sys.worldEvent.unregisterHandler(type);
	};
}

// ── Emote events ─────────────────────────────────────────────────────

function wireEmoteEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	sys.emote.onEmote((name, _emoteIndex) => {
		const actor = ctx.lookups.findAgentActor(name);
		if (!actor) return;
		const agent = ctx.store.agents.find((a) => a.name === name);
		const mood = agent?.mood ?? "neutral";
		const texts = MOOD_TEXTS[mood] ?? MOOD_TEXTS["neutral"]!;
		const text = texts[Math.floor(Math.random() * texts.length)];
		sys.bubble.showBubble(name, "thought", text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
	});
	return () => sys.emote.offEmote();
}

// ── Social conversation events ───────────────────────────────────────

function wireConversationEvents(ctx: EngineContext): () => void {
	const { systems: sys, state } = ctx;
	sys.social.onConversation((nameA, nameB, lineA, lineB) => {
		// Skip if either agent is walking to a door
		if (sys.registry.isInTransit(nameA) || sys.registry.isInTransit(nameB)) return;
		// Record narrative beat for social conversation
		const convBeat = {
			timestamp: Date.now(),
			phase: sys.dayClock.getPhase(),
			category: "social" as const,
			actors: [nameA, nameB],
			event: "conversation",
			detail: { agentA: nameA, agentB: nameB, topic: lineA.slice(0, 40) },
		};
		sys.narrative.recordBeat(convBeat);
		ctx.store.pushNarrativeBeat(convBeat);
		// Track conversations for memory streaks
		state.cycleConversationCounts.set(nameA, (state.cycleConversationCounts.get(nameA) ?? 0) + 1);
		state.cycleConversationCounts.set(nameB, (state.cycleConversationCounts.get(nameB) ?? 0) + 1);
		// Relationship tracking + bicker check
		sys.relationship.recordConversation(nameA, nameB);
		if (sys.relationship.shouldBicker(nameA, nameB)) {
			sys.relationship.recordBicker(nameA, nameB);
			// Resolve opinion labels for template interpolation
			const opsA = sys.relationship.getOpinions(nameA);
			const opsB = sys.relationship.getOpinions(nameB);
			const clash = findClashLabels(opsA, opsB);
			const resolveOpinions = (text: string) =>
				text.replace(/\{opinionA\}/g, clash?.opinionA ?? "my way")
					.replace(/\{opinionB\}/g, clash?.opinionB ?? "your way");
			setTimeout(() => {
				sys.bubble.showBubble(nameA, "speech", resolveOpinions(pickTemplate(BICKER_TEMPLATES)), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
			}, 500);
			setTimeout(() => {
				sys.bubble.showBubble(nameB, "speech", resolveOpinions(pickTemplate(BICKER_TEMPLATES)), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
			}, 2000);
		}
		sys.brain.applyEvent(nameA, "speaking");
		sys.brain.applyEvent(nameB, "speaking");

		// Face each other
		const actorA = ctx.lookups.findAgentActor(nameA);
		const actorB = ctx.lookups.findAgentActor(nameB);
		if (actorA) actorA.focus();
		if (actorB) actorB.focus();

		// Agent A speaks first
		sys.bubble.showBubble(nameA, "speech", lineA, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);

		// Agent B responds with delay + occasional emoji
		const bDelay = 1000 + Math.random() * 800;
		setTimeout(() => {
			const prefix = Math.random() < SOCIAL_EMOJI_CHANCE ? `${pick(SOCIAL_EMOJIS)} ` : "";
			sys.bubble.showBubble(nameB, "speech", `${prefix}${lineB}`, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
		}, bDelay);

		// 50% chance: Agent A reacts with an emoji thought bubble
		if (Math.random() < EMOJI_REACTION_CHANCE) {
			setTimeout(() => {
				sys.bubble.showBubble(nameA, "thought", pick(REACTION_EMOJIS), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2000);
			}, bDelay + 1500 + Math.random() * 1000);
		}

		// 30% chance: One more exchange (A or B adds a follow-up)
		if (Math.random() < FOLLOW_UP_CHANCE) {
			const follower = Math.random() < 0.5 ? nameA : nameB;
			setTimeout(() => {
				sys.bubble.showBubble(follower, "speech", pick(FOLLOW_UP_STRINGS), ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
			}, bDelay + 2500 + Math.random() * 1000);
		}

		setTimeout(() => {
			sys.brain.applyEvent(nameA, "idle");
			sys.brain.applyEvent(nameB, "idle");
		}, 6000 + Math.random() * 2000);
	});

	// Cluster huddle conversations
	sys.social.onCluster((members) => {
		// Filter out in-transit agents
		const available = members.filter((n) => !sys.registry.isInTransit(n));
		if (available.length < 2) return;
		sys.relationship.recordCluster(available);
		const speakCount = Math.min(available.length, 3);
		const lines = available.slice(0, speakCount).map(() => {
			const template = HUDDLE_TEMPLATES[Math.floor(Math.random() * HUDDLE_TEMPLATES.length)];
			return template.text;
		});

		available.slice(0, speakCount).forEach((name, i) => {
			const agent = ctx.store.agents.find((a) => a.name === name);
			const domain = agent?.domain ?? "general";
			const mood = sys.needs.getMood(name);
			const moodAdj = mood === "neutral" ? "optimistic" : mood;
			const text = interpolateTemplate(lines[i], { domain, mood_adj: moodAdj });

			sys.brain.applyEvent(name, "speaking");
			setTimeout(() => {
				sys.bubble.showBubble(name, "speech", text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
			}, i * 1500);
		});

		setTimeout(() => {
			for (const name of available) sys.brain.applyEvent(name, "idle");
		}, speakCount * 1500 + 3000);
	});

	return () => {
		sys.social.offConversation();
		sys.social.offCluster();
	};
}

// ── Sensor events ────────────────────────────────────────────────────

function wireSensorEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const cb = (reaction: SensorReaction) => {
		if (reaction.bubble) {
			sys.bubble.showBubble(reaction.agentName, reaction.bubble.kind, reaction.bubble.text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 5000, true);
		}
		if (reaction.needsEffect) {
			sys.needs.applyEffect(reaction.agentName, reaction.needsEffect);
		}
	};
	sys.sensor.onReaction(cb);
	return () => sys.sensor.offReaction(cb);
}

// ── Engagement events ────────────────────────────────────────────────

function wireEngagementEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const cb = (e: EngagementEvent) => {
		if (sys.registry.isInTransit(e.agentName)) return;
		if (e.tier >= 2) {
			const cam = ctx.engine.currentScene.camera;
			sys.brain.walkTo(e.agentName, { x: cam.pos.x - 50, y: cam.pos.y });
		}
		sys.bubble.showBubble(e.agentName, e.bubbleKind, e.text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 5000, true);
	};
	sys.engagement.onEngagement(cb);
	return () => sys.engagement.offEngagement(cb);
}

// ── Ritual events ────────────────────────────────────────────────────

function wireRitualEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const cb = (phase: RitualPhase) => {
		if (phase.kind === "gather") {
			for (const name of phase.participants) {
				if (!sys.registry.isInTransit(name)) sys.brain.applyEvent(name, "speaking");
			}
		}
		if (phase.kind === "line") {
			if (!sys.registry.isInTransit(phase.agentName)) sys.bubble.showBubble(phase.agentName, "speech", phase.text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000, true);
		}
		if (phase.kind === "disperse") {
			for (const name of phase.participants) {
				sys.brain.applyEvent(name, "idle");
				sys.needs.applyEffect(name, { social: 8, morale: 5 });
			}
		}
	};
	sys.ritual.onPhase(cb);
	return () => sys.ritual.offPhase(cb);
}

// ── Tool result events ───────────────────────────────────────────────

function wireToolEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const cb = (result: ToolResult) => {
		const eventType = result.success ? "test-pass" : "test-fail";
		sys.sensor.pushFeedback({ type: eventType, data: { output: result.output } });
		sys.needs.applyEffect(result.agentName, { morale: result.success ? 3 : -2, energy: -5 });
		sys.bubble.showBubble(result.agentName, "speech", result.success ? "Done! All good." : "Something went wrong...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 5000, true);
	};
	sys.tool.onResult(cb);
	return () => sys.tool.offResult(cb);
}

// ── Provider events (action, connection, entity) ─────────────────────

function wireProviderEvents(ctx: EngineContext): () => void {
	const { systems: sys, state } = ctx;
	const unsubAction = ctx.provider.onAction((action: AgentAction) => {
		try {
			if (action.id && state.recentActionIds.has(action.id)) return;
			if (action.id) {
				state.recentActionIds.add(action.id);
				setTimeout(() => state.recentActionIds.delete(action.id), ACTION_DEDUP_TTL);
			}

			// Transition brain state
			sys.brain.applyEvent(action.agentName, action.type);

			// Silence talk engine and hide lightbulb when LLM responds
			if (action.type === "speaking" || action.type === "asking") {
				sys.talk.silence(action.agentName);
				const actor = ctx.lookups.findAgentActor(action.agentName);
				if (actor) actor.hideLlmIndicator();
			}

			// Show bubble for certain actions
			if (action.type === "speaking" || action.type === "asking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const bubbleKind = action.type === "asking" ? "question" : "speech";
				const currentScene = ctx.engine.currentScene;
				sys.bubble.showBubble(action.agentName, bubbleKind, text, currentScene, ctx.lookups.findBubbleAnchor);
			} else if (action.type === "thinking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const currentScene = ctx.engine.currentScene;
				sys.bubble.showBubble(action.agentName, "thought", text, currentScene, ctx.lookups.findBubbleAnchor);
			} else if (action.type === "requesting-permission") {
				const currentScene = ctx.engine.currentScene;
				sys.bubble.showBubble(action.agentName, "question", "?", currentScene, ctx.lookups.findBubbleAnchor);

				// Auto-open panel to Permissions tab via store (single notify)
				ctx.store.beginBatch();
				ctx.store.selectAgent(action.agentName);
				ctx.store.selectTab("permissions");
				ctx.store.endBatch();
			}
		} catch (err) {
			console.warn("[game] Error handling action:", action.type, action.agentName, err);
		}
	});

	const unsubConnection = ctx.provider.onConnectionStatus((status) => {
		ctx.scenes.hub.updateConnectionStatus(status);
		ctx.store.setConnectionStatus(status);
	});

	const unsubEntity = ctx.provider.onEntityUpdate((entity: WorldEntity) => {
		if (entity.type !== "agent") return;

		if (!state.knownEntities.has(entity.id)) {
			// New agent entity — spawn into game
			if (ctx.store.agents.find((a) => a.name === entity.id)) return;

			const agentData: DashboardAgent = {
				name: entity.id,
				agentType: "ai",
				status: ((entity.components["status"] as string) ?? "idle") as DashboardAgent["status"],
				domain: entity.components["domain"] as string | undefined,
			};
			const setting = resolveSettingForDomain(agentData.domain);
			if (setting !== "hub" && ctx.scenes.map[setting]) {
				ctx.scenes.map[setting].spawnAgent(agentData);
				sys.registry.setEntityRoom(agentData.name, setting);
			}
			ctx.store.setAgents([...ctx.store.agents, agentData]);
			ctx.scenes.hub.updateAgents([...ctx.store.agents]);
			sys.brain.register(agentData.name, {}, undefined, agentData.domain);
			state.knownEntities.add(entity.id);
			sys.bubble.showBubble(entity.id, "speech", "Hello! I just arrived.", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
		} else {
			// Existing agent entity changed — only react if state actually changed
			const statusComp = entity.components["status"];
			if (typeof statusComp === "object" && statusComp !== null && "state" in statusComp) {
				const newState = (statusComp as { state: string }).state;
				const currentState = sys.brain.getState(entity.id)?.state;
				if (newState !== currentState) {
					sys.brain.applyEvent(entity.id, newState as AgentAction["type"]);
				}
			}
		}
	});

	return () => {
		unsubAction();
		unsubConnection();
		unsubEntity();
	};
}

// ── Narrative beat recording ──────────────────────────────────────────

function wireNarrativeEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const handlers: Array<{ event: string; handler: EventListener }> = [];

	const addStoreListener = (event: string, handler: EventListener): void => {
		ctx.store.addEventListener(event, handler);
		handlers.push({ event, handler });
	};

	/** Record a beat in the narrative system and push it to the store feed. */
	const recordBeat = (beat: Parameters<typeof sys.narrative.recordBeat>[0]): void => {
		sys.narrative.recordBeat(beat);
		ctx.store.pushNarrativeBeat(beat);
	};

	// Task completion → narrative beat
	addStoreListener("task-completed", ((e: CustomEvent) => {
		const { agentName, task, domain: taskDomain, count: taskCount } = e.detail;
		const agent = ctx.store.agents.find((a) => a.name === agentName);
		const domain = typeof taskDomain === "string" ? taskDomain : (agent?.domain ?? "general");
		const count = typeof taskCount === "number" ? taskCount : 1;
		const plural = count === 1 ? "" : "s";
		recordBeat({
			timestamp: Date.now(),
			phase: sys.dayClock.getPhase(),
			category: "task",
			actors: [agentName],
			event: "task-completed",
			detail: { agent: agentName, task: typeof task === "string" ? task : "a task", domain, count, plural },
		});
	}) as EventListener);

	// Level-up → narrative beat
	addStoreListener("level-up", ((e: CustomEvent) => {
		const { agentName, level, xp: eventXp } = e.detail;
		const agent = ctx.store.agents.find((a) => a.name === agentName);
		const xp = typeof eventXp === "number" ? eventXp : (agent?.experience ?? 0);
		recordBeat({
			timestamp: Date.now(),
			phase: sys.dayClock.getPhase(),
			category: "economy",
			actors: [agentName],
			event: "level-up",
			detail: { agent: agentName, level: typeof level === "number" ? level : 1, xp },
		});
	}) as EventListener);

	// Trust promotion → narrative beat
	addStoreListener("trust-promoted", ((e: CustomEvent) => {
		const { agentName, tier } = e.detail;
		const title = typeof tier === "string" ? tier : "trusted";
		recordBeat({
			timestamp: Date.now(),
			phase: sys.dayClock.getPhase(),
			category: "economy",
			actors: [agentName],
			event: "trust-promoted",
			detail: { agent: agentName, title },
		});
	}) as EventListener);

	// Ritual phases → narrative beat (only on gather, captures the full ritual)
	const ritualCb = (phase: RitualPhase) => {
		if (phase.kind !== "gather") return;
		recordBeat({
			timestamp: Date.now(),
			phase: sys.dayClock.getPhase(),
			category: "ritual",
			actors: [...phase.participants],
			event: "ritual-started",
			detail: { participants: phase.participants.join(", ") },
		});
	};
	sys.ritual.onPhase(ritualCb);

	return () => {
		for (const { event, handler } of handlers) {
			ctx.store.removeEventListener(event, handler);
		}
		sys.ritual.offPhase(ritualCb);
	};
}

// ── Merchant stall click (opens merchant panel) ──────────────────────

function wireMerchantStallClick(ctx: EngineContext): () => void {
	const handler = () => {
		const container = ctx.engine.canvas.parentElement;
		if (!container) return;

		let panel = container.querySelector("ft-game-merchant-panel") as
			HTMLElement & {
				visible: boolean;
				agents: unknown[];
				selectedAgent: string;
				catalog: unknown[];
			} | null;

		if (!panel) {
			panel = document.createElement("ft-game-merchant-panel") as
				HTMLElement & {
					visible: boolean;
					agents: unknown[];
					selectedAgent: string;
					catalog: unknown[];
				};
			panel.addEventListener("merchant-close", () => { panel!.visible = false; });
			container.appendChild(panel);
		}

		// Populate agent data from store
		const agents = ctx.store.agents.map((a) => ({
			name: a.name,
			coin: a.coin ?? 0,
			level: a.level ?? 1,
			capabilities: a.capabilities,
		}));
		panel.agents = agents;
		if (agents.length > 0 && !panel.selectedAgent) {
			panel.selectedAgent = agents[0].name;
		}
		panel.catalog = [...MERCHANT_CATALOG];
		panel.visible = true;
	};

	ctx.engine.canvas.addEventListener("merchant-stall-click", handler);
	return () => ctx.engine.canvas.removeEventListener("merchant-stall-click", handler);
}

// ── Composite wiring ─────────────────────────────────────────────────

export function wireEvents(ctx: EngineContext): () => void {
	const unsubs = [
		wireDayClockEvents(ctx),
		wireWorldEvents(ctx),
		wireEmoteEvents(ctx),
		wireConversationEvents(ctx),
		wireSensorEvents(ctx),
		wireEngagementEvents(ctx),
		wireRitualEvents(ctx),
		wireToolEvents(ctx),
		wireProviderEvents(ctx),
		wireStoreEvents(ctx),
		wireNarrativeEvents(ctx),
		wireMerchantStallClick(ctx),
		wireCliBrainBridge(ctx),
	];
	return () => unsubs.forEach((fn) => fn());
}
