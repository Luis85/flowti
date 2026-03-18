/**
 * Agent sidepanel handler — bridges Lit component ↔ EventBus ↔ IAgentService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IEventBus } from "../events/types";
import type { IAgentService, ConversationMode } from "../../domain/agents/types";

export interface AgentHandlerDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
}

export function mountAgentSidepanel(container: HTMLElement, deps: AgentHandlerDeps): () => void {
	const { agentService, eventBus } = deps;
	const el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
	const unsubscribes: (() => void)[] = [];

	let activeAgent = "";
	let activeMode: ConversationMode = "conversational";

	function refresh(): void {
		const agents = agentService.listAgents();
		el.agents = agents;
		if (!activeAgent && agents.length > 0) activeAgent = agents[0].name;
		el.activeAgent = activeAgent;
		el.activeMode = activeMode;
		el.turns = activeAgent ? agentService.getConversation(activeAgent) : [];
	}

	el.addEventListener("agent-selected", ((e: CustomEvent) => {
		activeAgent = String(e.detail.agent);
		refresh();
	}) as EventListener);

	el.addEventListener("agent-send", ((e: CustomEvent) => {
		const message = String(e.detail.message);
		if (!activeAgent || !message) return;
		el.processing = true;
		void eventBus.emit("agent.message.sent", { agent: activeAgent, message, mode: activeMode });
		void agentService.sendMessage(activeAgent, message, activeMode).finally(() => {
			el.processing = false;
			refresh();
		});
		refresh();
	}) as EventListener);

	el.addEventListener("mode-changed", ((e: CustomEvent) => {
		activeMode = e.detail.mode as ConversationMode;
		void eventBus.emit("agent.mode.switched", { mode: activeMode });
		refresh();
	}) as EventListener);

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
	});
	unsubscribes.push(unsubService);

	refresh();
	container.appendChild(el);

	return () => {
		for (const unsub of unsubscribes) unsub();
		el.remove();
	};
}
