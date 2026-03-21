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
import type { AgentAction, DashboardAgent, WorldEntity } from "./data/types.js";
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
	ctx.worldEvent.registerHandler(type, () => {
		ctx.store.pushWorldEvent(type, label);
		handler();
	});
}

// ── Day clock events ─────────────────────────────────────────────────

function wireDayClockEvents(ctx: EngineContext): () => void {
	ctx.dayClock.onPhaseChange((phase) => {
		ctx.store.setDayPhase(phase);
		ctx.store.setWeatherState(ctx.worldAmbience.getWeather());
		ctx.store.pushWorldEvent("phase-change", `Day phase: ${phase.replace(/-/g, " ")}`);
		ctx.worldEvent.onPhaseChange(phase);
	});
	// DayClock.onPhaseChange does not return an unsubscribe
	return () => {};
}

// ── World micro-event handlers ───────────────────────────────────────

function wireWorldEvents(ctx: EngineContext): () => void {
	registerWorldEvent(ctx, "standup", "Morning Standup", () => {
		const agents = ctx.needs.getAgentNames().filter((n) => !ctx.registry.isInTransit(n));
		for (const name of agents) {
			const state = ctx.brain.getState(name)?.state;
			if (state === "idle" || state === "wandering") ctx.brain.applyEvent(name, "speaking");
		}
		agents.forEach((name, i) => {
			setTimeout(() => {
				ctx.bubble.showBubble(name, "thought", pickTemplate(STANDUP_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 3000);
			}, i * 2000);
		});
		setTimeout(() => {
			for (const name of agents) ctx.brain.applyEvent(name, "idle");
		}, agents.length * 2000 + 2000);
	});

	registerWorldEvent(ctx, "deploy-success", "Deploy Success", () => {
		const agents = ctx.needs.getAgentNames();
		const celebrant = agents[Math.floor(Math.random() * agents.length)];
		if (celebrant) {
			ctx.bubble.showBubble(celebrant, "speech", pickTemplate(DEPLOY_SUCCESS_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 4000);
			const actor = ctx.findAgentActor(celebrant);
			if (actor) ctx.particlePool.spawnPreset("confetti", actor.pos.x, actor.pos.y - 20);
			ctx.needs.applyEffect(celebrant, { morale: 5 });
		}
	});

	registerWorldEvent(ctx, "tea-time", "Tea Time", () => {
		const idle = ctx.needs.getAgentNames().filter((n) => ctx.brain.getState(n)?.state === "idle");
		const teaGroup = idle.slice(0, 3);
		for (const name of teaGroup) {
			ctx.brain.walkTo(name, ctx.coffeeMachine.getInteractionPoint());
			ctx.bubble.showBubble(name, "thought", pickTemplate(TEA_TIME_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 3000);
		}
	});

	registerWorldEvent(ctx, "end-of-day", "End of Day", () => {
		for (const name of ctx.needs.getAgentNames()) {
			ctx.bubble.showBubble(name, "thought", pickTemplate(END_OF_DAY_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 3000);
		}
	});

	registerWorldEvent(ctx, "eureka", "Eureka Moment", () => {
		const working = ctx.needs.getAgentNames().filter((n) => ctx.brain.getState(n)?.state === "working");
		if (working.length > 0) {
			const agent = working[Math.floor(Math.random() * working.length)];
			ctx.bubble.showBubble(agent, "speech", pickTemplate(EUREKA_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 4000);
			const actor = ctx.findAgentActor(agent);
			if (actor) ctx.particlePool.spawnPreset("sparkle", actor.pos.x, actor.pos.y - 20);
			ctx.needs.applyEffect(agent, { morale: 8, focus: 5 });
		}
	});

	registerWorldEvent(ctx, "build-break", "Build Break", () => {
		for (const name of ctx.needs.getAgentNames()) {
			ctx.bubble.showBubble(name, "thought", pickTemplate(BUILD_BREAK_REACTION_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 2000);
			ctx.needs.applyEffect(name, { morale: -3 });
		}
		ctx.particlePool.spawnPreset("alert", 400, 250);
		setTimeout(() => {
			const resolver = ctx.needs.getAgentNames()[0];
			if (resolver) ctx.bubble.showBubble(resolver, "speech", pickTemplate(BUILD_BREAK_RESOLVE_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 4000);
		}, 10_000);
	});

	registerWorldEvent(ctx, "birthday", "Birthday", () => {
		const agents = ctx.needs.getAgentNames();
		const birthdayAgent = agents[Math.floor(Math.random() * agents.length)];
		if (birthdayAgent) {
			ctx.bubble.showBubble(birthdayAgent, "speech", pickTemplate(BIRTHDAY_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 4000);
			ctx.particlePool.spawnPreset("confetti", ctx.snackTable.pos.x, ctx.snackTable.pos.y - 20);
			for (const name of agents) ctx.needs.applyEffect(name, { morale: 3 });
		}
	});

	registerWorldEvent(ctx, "power-flicker", "Power Flicker", () => {
		for (const name of ctx.needs.getAgentNames()) {
			ctx.bubble.showBubble(name, "thought", pickTemplate(POWER_FLICKER_REACTION_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 1500);
		}
		setTimeout(() => {
			const ops = ctx.needs.getAgentNames()[0];
			if (ops) ctx.bubble.showBubble(ops, "speech", pickTemplate(POWER_FLICKER_RESOLVE_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 3000);
		}, 2000);
	});

	registerWorldEvent(ctx, "new-pr", "New PR", () => {
		const agents = ctx.needs.getAgentNames();
		const author = agents[Math.floor(Math.random() * agents.length)];
		if (author) {
			ctx.brain.walkTo(author, ctx.whiteboard.getInteractionPoint());
			setTimeout(() => {
				ctx.bubble.showBubble(author, "thought", pickTemplate(NEW_PR_TEMPLATES), ctx.engine.currentScene, ctx.findAgentActor, 3000);
				ctx.particlePool.spawnPreset("scribble", ctx.whiteboard.pos.x, ctx.whiteboard.pos.y);
			}, 3000);
		}
	});

	// WorldEventScheduler.registerHandler does not return an unsubscribe
	return () => {};
}

// ── Emote events ─────────────────────────────────────────────────────

function wireEmoteEvents(ctx: EngineContext): () => void {
	ctx.emote.onEmote((name, _emoteIndex) => {
		const actor = ctx.findAgentActor(name);
		if (!actor) return;
		const agent = ctx.store.agents.find((a) => a.name === name);
		const mood = agent?.mood ?? "neutral";
		const texts = MOOD_TEXTS[mood] ?? MOOD_TEXTS["neutral"]!;
		const text = texts[Math.floor(Math.random() * texts.length)];
		ctx.bubble.showBubble(name, "thought", text, ctx.engine.currentScene, ctx.findAgentActor, 2500);
	});
	// EmoteSystem.onEmote does not return an unsubscribe
	return () => {};
}

// ── Social conversation events ───────────────────────────────────────

function wireConversationEvents(ctx: EngineContext): () => void {
	ctx.social.onConversation((nameA, nameB, lineA, lineB) => {
		// Skip if either agent is walking to a door
		if (ctx.registry.isInTransit(nameA) || ctx.registry.isInTransit(nameB)) return;
		// Track conversations for memory streaks
		ctx.cycleConversationCounts.set(nameA, (ctx.cycleConversationCounts.get(nameA) ?? 0) + 1);
		ctx.cycleConversationCounts.set(nameB, (ctx.cycleConversationCounts.get(nameB) ?? 0) + 1);
		// Relationship tracking + bicker check
		ctx.relationship.recordConversation(nameA, nameB);
		if (ctx.relationship.shouldBicker(nameA, nameB)) {
			ctx.relationship.recordBicker(nameA, nameB);
			// Resolve opinion labels for template interpolation
			const opsA = ctx.relationship.getOpinions(nameA);
			const opsB = ctx.relationship.getOpinions(nameB);
			const clash = findClashLabels(opsA, opsB);
			const resolveOpinions = (text: string) =>
				text.replace(/\{opinionA\}/g, clash?.opinionA ?? "my way")
					.replace(/\{opinionB\}/g, clash?.opinionB ?? "your way");
			setTimeout(() => {
				ctx.bubble.showBubble(nameA, "speech", resolveOpinions(pickTemplate(BICKER_TEMPLATES)), ctx.engine.currentScene, ctx.findAgentActor, 3000);
			}, 500);
			setTimeout(() => {
				ctx.bubble.showBubble(nameB, "speech", resolveOpinions(pickTemplate(BICKER_TEMPLATES)), ctx.engine.currentScene, ctx.findAgentActor, 3000);
			}, 2000);
		}
		ctx.brain.applyEvent(nameA, "speaking");
		ctx.brain.applyEvent(nameB, "speaking");

		// Face each other
		const actorA = ctx.findAgentActor(nameA);
		const actorB = ctx.findAgentActor(nameB);
		if (actorA) actorA.focus();
		if (actorB) actorB.focus();

		// Agent A speaks first
		ctx.bubble.showBubble(nameA, "speech", lineA, ctx.engine.currentScene, ctx.findAgentActor, 4000);

		// Agent B responds with delay + occasional emoji
		const bDelay = 1000 + Math.random() * 800;
		setTimeout(() => {
			const prefix = Math.random() < SOCIAL_EMOJI_CHANCE ? `${pick(SOCIAL_EMOJIS)} ` : "";
			ctx.bubble.showBubble(nameB, "speech", `${prefix}${lineB}`, ctx.engine.currentScene, ctx.findAgentActor, 4000);
		}, bDelay);

		// 50% chance: Agent A reacts with an emoji thought bubble
		if (Math.random() < EMOJI_REACTION_CHANCE) {
			setTimeout(() => {
				ctx.bubble.showBubble(nameA, "thought", pick(REACTION_EMOJIS), ctx.engine.currentScene, ctx.findAgentActor, 2000);
			}, bDelay + 1500 + Math.random() * 1000);
		}

		// 30% chance: One more exchange (A or B adds a follow-up)
		if (Math.random() < FOLLOW_UP_CHANCE) {
			const follower = Math.random() < 0.5 ? nameA : nameB;
			setTimeout(() => {
				ctx.bubble.showBubble(follower, "speech", pick(FOLLOW_UP_STRINGS), ctx.engine.currentScene, ctx.findAgentActor, 2500);
			}, bDelay + 2500 + Math.random() * 1000);
		}

		setTimeout(() => {
			ctx.brain.applyEvent(nameA, "idle");
			ctx.brain.applyEvent(nameB, "idle");
		}, 6000 + Math.random() * 2000);
	});

	// Cluster huddle conversations
	ctx.social.onCluster((members) => {
		// Filter out in-transit agents
		const available = members.filter((n) => !ctx.registry.isInTransit(n));
		if (available.length < 2) return;
		ctx.relationship.recordCluster(available);
		const speakCount = Math.min(members.length, 3);
		const lines = members.slice(0, speakCount).map(() => {
			const template = HUDDLE_TEMPLATES[Math.floor(Math.random() * HUDDLE_TEMPLATES.length)];
			return template.text;
		});

		members.slice(0, speakCount).forEach((name, i) => {
			const agent = ctx.store.agents.find((a) => a.name === name);
			const domain = agent?.domain ?? "general";
			const mood = ctx.needs.getMood(name);
			const moodAdj = mood === "neutral" ? "optimistic" : mood;
			const text = interpolateTemplate(lines[i], { domain, mood_adj: moodAdj });

			ctx.brain.applyEvent(name, "speaking");
			setTimeout(() => {
				ctx.bubble.showBubble(name, "speech", text, ctx.engine.currentScene, ctx.findAgentActor, 4000);
			}, i * 1500);
		});

		setTimeout(() => {
			for (const name of members) ctx.brain.applyEvent(name, "idle");
		}, speakCount * 1500 + 3000);
	});

	// SocialSystem does not return unsubscribes
	return () => {};
}

// ── Sensor events ────────────────────────────────────────────────────

function wireSensorEvents(ctx: EngineContext): () => void {
	ctx.sensor.onReaction((reaction) => {
		if (reaction.bubble) {
			ctx.bubble.showBubble(reaction.agentName, reaction.bubble.kind, reaction.bubble.text, ctx.engine.currentScene, ctx.findAgentActor, 5000, true);
		}
		if (reaction.needsEffect) {
			ctx.needs.applyEffect(reaction.agentName, reaction.needsEffect);
		}
	});
	return () => {};
}

// ── Engagement events ────────────────────────────────────────────────

function wireEngagementEvents(ctx: EngineContext): () => void {
	ctx.engagement.onEngagement((e) => {
		if (ctx.registry.isInTransit(e.agentName)) return;
		if (e.tier >= 2) {
			const cam = ctx.engine.currentScene.camera;
			ctx.brain.walkTo(e.agentName, { x: cam.pos.x - 50, y: cam.pos.y });
		}
		ctx.bubble.showBubble(e.agentName, e.bubbleKind, e.text, ctx.engine.currentScene, ctx.findAgentActor, 5000, true);
	});
	return () => {};
}

// ── Ritual events ────────────────────────────────────────────────────

function wireRitualEvents(ctx: EngineContext): () => void {
	ctx.ritual.onPhase((phase) => {
		if (phase.kind === "gather") {
			for (const name of phase.participants) {
				if (!ctx.registry.isInTransit(name)) ctx.brain.applyEvent(name, "speaking");
			}
		}
		if (phase.kind === "line") {
			if (!ctx.registry.isInTransit(phase.agentName)) ctx.bubble.showBubble(phase.agentName, "speech", phase.text, ctx.engine.currentScene, ctx.findAgentActor, 4000, true);
		}
		if (phase.kind === "disperse") {
			for (const name of phase.participants) {
				ctx.brain.applyEvent(name, "idle");
				ctx.needs.applyEffect(name, { social: 8, morale: 5 });
			}
		}
	});
	return () => {};
}

// ── Tool result events ───────────────────────────────────────────────

function wireToolEvents(ctx: EngineContext): () => void {
	ctx.tool.onResult((result) => {
		const eventType = result.success ? "test-pass" : "test-fail";
		ctx.sensor.pushFeedback({ type: eventType, data: { output: result.output } });
		ctx.needs.applyEffect(result.agentName, { morale: result.success ? 3 : -2, energy: -5 });
		ctx.bubble.showBubble(result.agentName, "speech", result.success ? "Done! All good." : "Something went wrong...", ctx.engine.currentScene, ctx.findAgentActor, 5000, true);
	});
	return () => {};
}

// ── Provider events (action, connection, entity) ─────────────────────

function wireProviderEvents(ctx: EngineContext): () => void {
	const unsubAction = ctx.provider.onAction((action: AgentAction) => {
		try {
			if (action.id && ctx.recentActionIds.has(action.id)) return;
			if (action.id) {
				ctx.recentActionIds.add(action.id);
				setTimeout(() => ctx.recentActionIds.delete(action.id), ACTION_DEDUP_TTL);
			}

			// Transition brain state
			ctx.brain.applyEvent(action.agentName, action.type);

			// Silence talk engine and hide lightbulb when LLM responds
			if (action.type === "speaking" || action.type === "asking") {
				ctx.talk.silence(action.agentName);
				const actor = ctx.findAgentActor(action.agentName);
				if (actor) actor.hideLlmIndicator();
			}

			// Show bubble for certain actions
			if (action.type === "speaking" || action.type === "asking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const bubbleKind = action.type === "asking" ? "question" : "speech";
				const currentScene = ctx.engine.currentScene;
				ctx.bubble.showBubble(action.agentName, bubbleKind, text, currentScene, ctx.findAgentActor);
			} else if (action.type === "thinking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const currentScene = ctx.engine.currentScene;
				ctx.bubble.showBubble(action.agentName, "thought", text, currentScene, ctx.findAgentActor);
			} else if (action.type === "requesting-permission") {
				const currentScene = ctx.engine.currentScene;
				ctx.bubble.showBubble(action.agentName, "question", "?", currentScene, ctx.findAgentActor);

				// Auto-open panel to Permissions tab via store
				ctx.store.selectAgent(action.agentName);
				ctx.store.selectTab("permissions");
			}
		} catch (err) {
			console.warn("[game] Error handling action:", action.type, action.agentName, err);
		}
	});

	const unsubConnection = ctx.provider.onConnectionStatus((status) => {
		ctx.hubScene.updateConnectionStatus(status);
		ctx.store.setConnectionStatus(status);
	});

	const unsubEntity = ctx.provider.onEntityUpdate((entity: WorldEntity) => {
		if (entity.type !== "agent") return;

		if (!ctx.knownEntities.has(entity.id)) {
			// New agent entity — spawn into game
			if (ctx.store.agents.find((a) => a.name === entity.id)) return;

			const agentData: DashboardAgent = {
				name: entity.id,
				agentType: "ai",
				status: ((entity.components["status"] as string) ?? "idle") as DashboardAgent["status"],
				domain: entity.components["domain"] as string | undefined,
			};
			const setting = resolveSettingForDomain(agentData.domain);
			if (setting !== "hub" && ctx.roomScenes[setting]) {
				ctx.roomScenes[setting].spawnAgent(agentData);
				ctx.registry.setEntityRoom(agentData.name, setting);
			}
			ctx.store.setAgents([...ctx.store.agents, agentData]);
			ctx.hubScene.updateAgents([...ctx.store.agents]);
			ctx.brain.register(agentData.name, {}, undefined, agentData.domain);
			ctx.knownEntities.add(entity.id);
			ctx.bubble.showBubble(entity.id, "speech", "Hello! I just arrived.", ctx.engine.currentScene, ctx.findAgentActor, 3000);
		} else {
			// Existing agent entity changed — only react if state actually changed
			const statusComp = entity.components["status"];
			if (typeof statusComp === "object" && statusComp !== null && "state" in statusComp) {
				const newState = (statusComp as { state: string }).state;
				const currentState = ctx.brain.getState(entity.id)?.state;
				if (newState !== currentState) {
					ctx.brain.applyEvent(entity.id, newState as AgentAction["type"]);
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

// ── Store events (DOM EventTarget listeners) ─────────────────────────

function wireStoreEvents(ctx: EngineContext): () => void {
	const handlers: Array<{ event: string; handler: EventListener }> = [];

	const addStoreListener = (event: string, handler: EventListener): void => {
		ctx.store.addEventListener(event, handler);
		handlers.push({ event, handler });
	};

	addStoreListener("scene-change", ((e: CustomEvent) => {
		ctx.handleSceneChange(e.detail.setting);
	}) as EventListener);

	addStoreListener("agent-message-sent", ((e: CustomEvent) => {
		const { agentName } = e.detail;
		// Activate rapid chatter while waiting for LLM
		ctx.talk.activate(agentName);
		// Show lightbulb indicator
		const actor = ctx.findAgentActor(agentName);
		if (actor) {
			actor.showLlmIndicator();
			const signal = ctx.director.recordInteraction("message", { x: actor.pos.x, y: actor.pos.y });
			if (signal.moraleEffect) ctx.needs.applyEffect(agentName, { morale: signal.moraleEffect });
		}
	}) as EventListener);

	addStoreListener("agent-response-received", ((e: CustomEvent) => {
		const { agentName, text, type } = e.detail;
		// Silence talk engine + hide lightbulb
		ctx.talk.silence(agentName);
		const actor = ctx.findAgentActor(agentName);
		if (actor) actor.hideLlmIndicator();
		// Show bubble
		const bubbleKind = type === "asking" ? "question" : "speech";
		ctx.bubble.showBubble(agentName, bubbleKind, text, ctx.engine.currentScene, ctx.findAgentActor);
	}) as EventListener);

	addStoreListener("task-assigned", ((e: CustomEvent) => {
		const { agentName, task } = e.detail;
		ctx.brain.applyEvent(agentName, "task-started");
		ctx.brain.assignWork(agentName);
		ctx.store.taskLockedAgents.add(agentName);
		ctx.talk.activate(agentName);
		ctx.bubble.showBubble(agentName, "thought", `Starting: ${task}`, ctx.engine.currentScene, ctx.findAgentActor);
		// Show lightbulb — agent is working on the task
		const actor = ctx.findAgentActor(agentName);
		if (actor) actor.showLlmIndicator();
	}) as EventListener);

	addStoreListener("task-completed", ((e: CustomEvent) => {
		const { agentName, result } = e.detail;
		ctx.brain.releaseWork(agentName);
		ctx.store.taskLockedAgents.delete(agentName);
		ctx.talk.silence(agentName);
		ctx.engagement.markTaskCompleted(agentName);
		const actor = ctx.findAgentActor(agentName);
		if (actor) { actor.hideLlmIndicator(); actor.hideToolIndicator(); }
		// Show completion bubble
		ctx.bubble.showBubble(agentName, "speech", typeof result === "string" ? result.slice(0, 80) : "Task complete.", ctx.engine.currentScene, ctx.findAgentActor, 5000);
	}) as EventListener);

	addStoreListener("permission-decided", ((e: CustomEvent) => {
		const { agentName, signalType } = e.detail;
		const signal = ctx.director.recordInteraction(signalType);
		if (signal.moraleEffect) ctx.needs.applyEffect(agentName, { morale: signal.moraleEffect });
	}) as EventListener);

	addStoreListener("agent-using-tool", ((e: CustomEvent) => {
		const actor = ctx.findAgentActor(e.detail.agentName);
		if (actor) actor.showToolIndicator();
	}) as EventListener);

	addStoreListener("agent-tool-complete", ((e: CustomEvent) => {
		const actor = ctx.findAgentActor(e.detail.agentName);
		if (actor) actor.hideToolIndicator();
	}) as EventListener);

	// Camera follow via store state
	let prevFollowed: string | null = null;
	addStoreListener("state-changed", (() => {
		if (ctx.store.followedAgent !== prevFollowed) {
			prevFollowed = ctx.store.followedAgent;
			if (ctx.store.followedAgent) {
				const actor = ctx.findAgentActor(ctx.store.followedAgent);
				if (actor && ctx.cameraSystem) ctx.cameraSystem.startFollow(actor);
			} else {
				if (ctx.cameraSystem) ctx.cameraSystem.stopFollow();
			}
		}
	}) as EventListener);

	return () => {
		for (const { event, handler } of handlers) {
			ctx.store.removeEventListener(event, handler);
		}
	};
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
	];
	return () => unsubs.forEach((fn) => fn());
}
