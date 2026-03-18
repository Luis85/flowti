/**
 * Agent sidepanel handler — bridges Lit component ↔ EventBus ↔ IAgentService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IEventBus } from "../events/types.js";
import type { IAgentService, ConversationMode } from "../../domain/agents/types.js";
import type { IContextProvider } from "../../domain/agents/context-provider.js";
import type { LaunchResult } from "../agents/server-launcher.js";

// Side-effect import: register the Lit custom element
import "../../components/agents/flowti-agent-sidepanel.js";

export interface AgentHandlerDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
	readonly contextProvider?: IContextProvider;
	readonly startServer?: () => Promise<LaunchResult>;
}

export function mountAgentSidepanel(container: HTMLElement, deps: AgentHandlerDeps): () => void {
	const { agentService, eventBus, contextProvider } = deps;
	const el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
	const unsubscribes: (() => void)[] = [];

	let activeAgent = "";
	let activeMode: ConversationMode = "conversational";
	let teamMode = false;
	let lastContextHash = "";

	function refresh(): void {
		const agents = agentService.listAgents();
		el.agents = agents;
		if (!activeAgent && agents.length > 0) activeAgent = agents[0].name;
		el.activeAgent = activeAgent;
		el.activeMode = activeMode;
		el.teamMode = teamMode;
		el.turns = teamMode
			? agentService.getTeamConversation()
			: activeAgent ? agentService.getConversation(activeAgent) : [];
	}

	// ── Agent selection ──
	el.addEventListener("agent-selected", ((e: CustomEvent) => {
		activeAgent = String(e.detail.agent);
		refresh();
	}) as EventListener);

	// ── Send message (with context) ──
	el.addEventListener("agent-send", ((e: CustomEvent) => {
		const message = String(e.detail.message);
		if (!activeAgent || !message) return;
		el.processing = true;
		void eventBus.emit("agent.message.sent", { agent: activeAgent, message, mode: activeMode });

		let enrichedMessage = message;
		if (contextProvider) {
			const diff = contextProvider.getDiff(lastContextHash);
			if (diff) {
				enrichedMessage = `[Context: ${diff.path} changed]\n${diff.diff}\n\n${message}`;
				lastContextHash = diff.currentHash;
			}
			const ctx = contextProvider.getActiveFileContext();
			if (ctx) lastContextHash = ctx.contentHash;
		}

		void agentService.sendMessage(activeAgent, enrichedMessage, activeMode).finally(() => {
			el.processing = false;
			refresh();
		});
		refresh();
	}) as EventListener);

	// ── Mode switch ──
	el.addEventListener("mode-changed", ((e: CustomEvent) => {
		activeMode = e.detail.mode as ConversationMode;
		void eventBus.emit("agent.mode.switched", { mode: activeMode });
		refresh();
	}) as EventListener);

	// ── Team toggle ──
	el.addEventListener("team-toggled", ((e: CustomEvent) => {
		teamMode = Boolean(e.detail.enabled);
		void eventBus.emit("agent.team.toggled", { enabled: teamMode });
		refresh();
	}) as EventListener);

	// ── Stop generation ──
	el.addEventListener("agent-stop", (() => {
		if (!activeAgent) return;
		void agentService.stopGeneration(activeAgent);
		el.processing = false;
		refresh();
	}) as EventListener);

	// ── Canvas events ──
	el.addEventListener("canvas-node-added", ((e: CustomEvent) => {
		void eventBus.emit("agent.canvas.synced", {
			canvasPath: String(e.detail.canvasPath ?? ""),
			nodeCount: Number(e.detail.nodeCount ?? 0),
		});
	}) as EventListener);

	// ── Restart world (launch CLI server) ──
	el.addEventListener("restart-world", (() => {
		if (!deps.startServer) return;
		el.connectStatus = "connecting";
		void deps.startServer()
			.then((result: LaunchResult) => {
				if (result.ok) {
					el.connectStatus = "idle";
					refresh();
				} else {
					el.connectStatus = "failed";
					el.connectError = result.error ?? "Unknown error";
				}
			})
			.catch(() => {
				el.connectStatus = "failed";
				el.connectError = "Unexpected error starting server";
			});
	}) as EventListener);

	// ── Service events → component updates ──
	const unsubService = agentService.onEvent((event) => {
		if (event.kind === "message-received" || event.kind === "status-changed") {
			refresh();
		}
		if (event.kind === "status-changed") {
			void eventBus.emit("agent.status.changed", { agent: event.agent, activity: event.activity });
		}
		if (event.kind === "message-received") {
			void eventBus.emit("agent.message.received", { agent: event.agent, turn: event.turn });
		}
		if (event.kind === "thinking") {
			void eventBus.emit("agent.thinking", { agent: event.agent, text: event.text });
		}
		if (event.kind === "tool-started") {
			void eventBus.emit("agent.tool.started", { agent: event.agent, tool: event.tool, id: event.id });
		}
		if (event.kind === "tool-completed") {
			void eventBus.emit("agent.tool.completed", { agent: event.agent, id: event.id });
		}
		if (event.kind === "error") {
			el.error = event.error;
			el.processing = false;
			setTimeout(() => { el.error = ""; }, 5000);
		}
	});
	unsubscribes.push(unsubService);

	// ── Context tracking ──
	if (contextProvider) {
		const unsubCtx = contextProvider.onFileChanged((ctx) => {
			lastContextHash = ctx.contentHash;
		});
		unsubscribes.push(unsubCtx);
	}

	// ── Keyboard shortcuts ──
	const keyHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape" && el.processing) {
			if (activeAgent) void agentService.stopGeneration(activeAgent);
			el.processing = false;
			refresh();
		}
	};
	container.addEventListener("keydown", keyHandler);
	unsubscribes.push(() => container.removeEventListener("keydown", keyHandler));

	refresh();
	container.appendChild(el);

	return () => {
		for (const unsub of unsubscribes) unsub();
		el.remove();
	};
}
