/**
 * HTTP-based IAgentService that talks to the Flowti CLI server.
 *
 * Endpoints:
 * - GET  /api/world-state → agent roster
 * - POST /api/agent/send  → send message to LLM
 * - POST /api/agent/wake  → wake agent
 * - GET  /events          → SSE stream for real-time updates
 */

import type {
	IAgentService, AgentCard, ConversationTurn,
	ConversationMode, AgentServiceEvent,
} from "../../domain/agents/types";

interface WorldEntity {
	id: string;
	type: string;
	components: Record<string, Record<string, unknown>>;
}

function entityToCard(entity: WorldEntity): AgentCard {
	const identity = entity.components.identity ?? {};
	const stats = entity.components.stats ?? {};
	const status = entity.components.status ?? {};
	const action = String(status.currentAction ?? "idle");
	const activityMap: Record<string, AgentCard["activity"]> = {
		idle: "idle", thinking: "thinking", speaking: "speaking",
		"using-tool": "using-tool", asking: "speaking",
	};
	return {
		name: String(identity.name ?? entity.id),
		persona: identity.persona ? String(identity.persona) : undefined,
		mood: identity.mood ? String(identity.mood) : undefined,
		intStat: typeof stats.int === "number" ? stats.int : undefined,
		chaStat: typeof stats.cha === "number" ? stats.cha : undefined,
		activity: activityMap[action] ?? "idle",
	};
}

export class HttpAgentService implements IAgentService {
	private baseUrl: string;
	private agents = new Map<string, AgentCard>();
	private conversations = new Map<string, ConversationTurn[]>();
	private teamConversation: ConversationTurn[] = [];
	private subscribers = new Set<(event: AgentServiceEvent) => void>();
	private abortControllers = new Map<string, AbortController>();
	private turnCounter = 0;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async connect(): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/world-state`);
		if (!res.ok) return;
		const state = await res.json() as { entities: Record<string, WorldEntity> };
		for (const [id, entity] of Object.entries(state.entities ?? {})) {
			if (entity.type === "agent") {
				this.agents.set(id, entityToCard(entity));
			}
		}
	}

	disconnect(): void {
		for (const controller of this.abortControllers.values()) controller.abort();
		this.abortControllers.clear();
		this.agents.clear();
		this.conversations.clear();
		this.teamConversation = [];
	}

	listAgents(): AgentCard[] {
		return [...this.agents.values()];
	}

	getAgent(name: string): AgentCard | undefined {
		return this.agents.get(name);
	}

	async sendMessage(agent: string, message: string, mode: ConversationMode, signal?: AbortSignal): Promise<void> {
		const turn: ConversationTurn = {
			id: `turn-${++this.turnCounter}`,
			role: "user",
			content: message,
			timestamp: new Date().toISOString(),
			mode,
		};

		const conv = this.conversations.get(agent) ?? [];
		conv.push(turn);
		this.conversations.set(agent, conv);
		this.teamConversation.push({ ...turn, agentName: agent });

		this.emit({ kind: "status-changed", agent, activity: "thinking" });
		this.updateAgentActivity(agent, "thinking");

		await fetch(`${this.baseUrl}/api/agent/send`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName: agent, message }),
			signal,
		});
	}

	async stopGeneration(agent: string): Promise<void> {
		const controller = this.abortControllers.get(agent);
		if (controller) {
			controller.abort();
			this.abortControllers.delete(agent);
		}
		this.updateAgentActivity(agent, "idle");
	}

	getConversation(agent: string): ConversationTurn[] {
		return this.conversations.get(agent) ?? [];
	}

	getTeamConversation(): ConversationTurn[] {
		return this.teamConversation;
	}

	onEvent(callback: (event: AgentServiceEvent) => void): () => void {
		this.subscribers.add(callback);
		return () => { this.subscribers.delete(callback); };
	}

	handleServerEvent(type: string, data: Record<string, unknown>): void {
		const agent = String(data.agentName ?? "");
		if (!agent) return;

		if (type === "agent-action") {
			const actionType = String(data.type ?? "");
			if (actionType === "thinking") {
				this.emit({ kind: "thinking", agent, text: String(data.text ?? "") });
				this.updateAgentActivity(agent, "thinking");
			} else if (actionType === "speaking" || actionType === "asking") {
				const text = String(data.text ?? "");
				const turn: ConversationTurn = {
					id: `turn-${++this.turnCounter}`,
					role: "agent",
					agentName: agent,
					persona: this.agents.get(agent)?.persona,
					content: text,
					timestamp: new Date().toISOString(),
					mode: "conversational",
				};
				const conv = this.conversations.get(agent) ?? [];
				conv.push(turn);
				this.conversations.set(agent, conv);
				this.teamConversation.push(turn);
				this.emit({ kind: "message-received", agent, turn });
				this.updateAgentActivity(agent, "idle");
			} else if (actionType === "using-tool") {
				this.emit({ kind: "tool-started", agent, tool: String(data.tool ?? ""), id: String(data.id ?? "") });
				this.updateAgentActivity(agent, "using-tool");
			} else if (actionType === "tool-complete") {
				this.emit({ kind: "tool-completed", agent, id: String(data.id ?? "") });
			}
		}
	}

	private emit(event: AgentServiceEvent): void {
		for (const cb of this.subscribers) {
			try { cb(event); } catch { /* subscriber error */ }
		}
	}

	private updateAgentActivity(name: string, activity: AgentCard["activity"]): void {
		const current = this.agents.get(name);
		if (current) {
			this.agents.set(name, { ...current, activity });
			this.emit({ kind: "status-changed", agent: name, activity });
		}
	}
}
