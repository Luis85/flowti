/**
 * engine-events-store.ts — Store event subscriptions (DOM EventTarget listeners).
 *
 * Extracted from engine-events.ts to reduce file size. Wires store
 * custom events (scene-change, agent-message-sent, task-assigned, etc.)
 * to game systems.
 */

import type { EngineContext } from "./engine-types.js";

export function wireStoreEvents(ctx: EngineContext): () => void {
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
