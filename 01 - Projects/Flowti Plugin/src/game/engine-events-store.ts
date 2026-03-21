/**
 * engine-events-store.ts — Store event subscriptions (DOM EventTarget listeners).
 *
 * Extracted from engine-events.ts to reduce file size. Wires store
 * custom events (scene-change, agent-message-sent, task-assigned, etc.)
 * to game systems.
 */

import type { EngineContext } from "./engine-types.js";
import { getCueForTrigger, formatBubbleText } from "./systems/economy-visuals.js";

// ── Economy visual helper ─────────────────────────────────────────────

function showEconomyCue(
	ctx: EngineContext,
	trigger: string,
	agentName: string,
	data: Record<string, string | number> = {},
): void {
	const cue = getCueForTrigger(trigger);
	if (!cue) return;
	const actor = ctx.lookups.findAgentActor(agentName);
	if (!actor) return;
	if (cue.bubbleText) {
		const text = formatBubbleText(cue.bubbleText, data);
		ctx.systems.bubble.showBubble(agentName, "thought", text, ctx.engine.currentScene, ctx.lookups.findAgentActor, cue.duration ?? 2000);
	}
	if (cue.particlePreset) {
		ctx.systems.particlePool.spawnPreset(cue.particlePreset, actor.pos.x, actor.pos.y - 20);
	}
}

export function wireStoreEvents(ctx: EngineContext): () => void {
	const { systems: sys } = ctx;
	const handlers: Array<{ event: string; handler: EventListener }> = [];

	const addStoreListener = (event: string, handler: EventListener): void => {
		ctx.store.addEventListener(event, handler);
		handlers.push({ event, handler });
	};

	addStoreListener("scene-change", ((e: CustomEvent) => {
		ctx.lookups.handleSceneChange(e.detail.setting);
	}) as EventListener);

	addStoreListener("agent-message-sent", ((e: CustomEvent) => {
		const { agentName } = e.detail;
		// Activate rapid chatter while waiting for LLM
		sys.talk.activate(agentName);
		// Show lightbulb indicator
		const actor = ctx.lookups.findAgentActor(agentName);
		if (actor) {
			actor.showLlmIndicator();
			const signal = sys.director.recordInteraction("message", { x: actor.pos.x, y: actor.pos.y });
			if (signal.moraleEffect) sys.needs.applyEffect(agentName, { morale: signal.moraleEffect });
		}
	}) as EventListener);

	addStoreListener("agent-response-received", ((e: CustomEvent) => {
		const { agentName, text, type } = e.detail;
		// Silence talk engine + hide lightbulb
		sys.talk.silence(agentName);
		const actor = ctx.lookups.findAgentActor(agentName);
		if (actor) actor.hideLlmIndicator();
		// Show bubble
		const bubbleKind = type === "asking" ? "question" : "speech";
		sys.bubble.showBubble(agentName, bubbleKind, text, ctx.engine.currentScene, ctx.lookups.findAgentActor);
	}) as EventListener);

	addStoreListener("task-assigned", ((e: CustomEvent) => {
		const { agentName, task } = e.detail;
		sys.brain.applyEvent(agentName, "task-started");
		sys.brain.assignWork(agentName);
		ctx.store.taskLockedAgents.add(agentName);
		sys.talk.activate(agentName);
		sys.bubble.showBubble(agentName, "thought", `Starting: ${task}`, ctx.engine.currentScene, ctx.lookups.findAgentActor);
		// Show lightbulb — agent is working on the task
		const actor = ctx.lookups.findAgentActor(agentName);
		if (actor) actor.showLlmIndicator();
	}) as EventListener);

	addStoreListener("task-completed", ((e: CustomEvent) => {
		const { agentName, result, xp, coin } = e.detail;
		sys.brain.releaseWork(agentName);
		ctx.store.taskLockedAgents.delete(agentName);
		sys.talk.silence(agentName);
		sys.engagement.markTaskCompleted(agentName);
		const actor = ctx.lookups.findAgentActor(agentName);
		if (actor) { actor.hideLlmIndicator(); actor.hideToolIndicator(); }
		// Show completion bubble
		sys.bubble.showBubble(agentName, "speech", typeof result === "string" ? result.slice(0, 80) : "Task complete.", ctx.engine.currentScene, ctx.lookups.findAgentActor, 5000);
		// Economy visual — floating "+{xp}XP +{coin}C"
		showEconomyCue(ctx, "task-completed", agentName, {
			xp: typeof xp === "number" ? xp : 10,
			coin: typeof coin === "number" ? coin : 1,
		});
	}) as EventListener);

	addStoreListener("level-up", ((e: CustomEvent) => {
		const { agentName, level } = e.detail;
		showEconomyCue(ctx, "level-up", agentName, { level: typeof level === "number" ? level : 1 });
		// Update actor level for progression visuals
		const actor = ctx.lookups.findAgentActor(agentName);
		if (actor) actor.setLevel(typeof level === "number" ? level : 1);
	}) as EventListener);

	addStoreListener("trust-promoted", ((e: CustomEvent) => {
		const { agentName } = e.detail;
		showEconomyCue(ctx, "trust-promoted", agentName);
	}) as EventListener);

	addStoreListener("permission-decided", ((e: CustomEvent) => {
		const { agentName, signalType } = e.detail;
		const signal = sys.director.recordInteraction(signalType);
		if (signal.moraleEffect) sys.needs.applyEffect(agentName, { morale: signal.moraleEffect });
	}) as EventListener);

	addStoreListener("agent-using-tool", ((e: CustomEvent) => {
		const actor = ctx.lookups.findAgentActor(e.detail.agentName);
		if (actor) actor.showToolIndicator();
	}) as EventListener);

	addStoreListener("agent-tool-complete", ((e: CustomEvent) => {
		const actor = ctx.lookups.findAgentActor(e.detail.agentName);
		if (actor) actor.hideToolIndicator();
	}) as EventListener);

	// Camera follow via store state
	let prevFollowed: string | null = null;
	addStoreListener("state-changed", (() => {
		if (ctx.store.followedAgent !== prevFollowed) {
			prevFollowed = ctx.store.followedAgent;
			if (ctx.store.followedAgent) {
				const actor = ctx.lookups.findAgentActor(ctx.store.followedAgent);
				if (actor && sys.cameraSystem) sys.cameraSystem.startFollow(actor);
			} else {
				if (sys.cameraSystem) sys.cameraSystem.stopFollow();
			}
		}
	}) as EventListener);

	return () => {
		for (const { event, handler } of handlers) {
			ctx.store.removeEventListener(event, handler);
		}
	};
}
