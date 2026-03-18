/**
 * In-memory IAgentService for development without a running CLI server.
 *
 * Provides a hardcoded roster of 3 agents and simulates responses
 * with a short delay, enabling component development and testing
 * without `flowti serve`.
 */

import type {
	IAgentService, AgentCard, ConversationTurn,
	ConversationMode, AgentServiceEvent,
} from "../../domain/agents/types.js";

const STUB_ROSTER: ReadonlyArray<AgentCard> = [
	{ name: "atlas", persona: "Alice", mood: "cheerful", intStat: 16, chaStat: 14, activity: "idle" },
	{ name: "scout", persona: "Bob", mood: "focused", intStat: 12, chaStat: 16, activity: "idle" },
	{ name: "sage", persona: "Carol", mood: "calm", intStat: 18, chaStat: 10, activity: "idle" },
];

/** Simulated response delay range in milliseconds. */
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 2000;

function randomDelay(): number {
	return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

interface PendingResponse {
	readonly timer: ReturnType<typeof setTimeout>;
	readonly resolve: () => void;
}

export class StubAgentService implements IAgentService {
	private agents = new Map<string, AgentCard>();
	private conversations = new Map<string, ConversationTurn[]>();
	private teamConversation: ConversationTurn[] = [];
	private subscribers = new Set<(event: AgentServiceEvent) => void>();
	private pending = new Map<string, PendingResponse>();
	private turnCounter = 0;

	async connect(): Promise<void> {
		for (const card of STUB_ROSTER) {
			this.agents.set(card.name, { ...card });
		}
	}

	disconnect(): void {
		for (const entry of this.pending.values()) {
			clearTimeout(entry.timer);
			entry.resolve();
		}
		this.pending.clear();
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

	async sendMessage(agent: string, message: string, mode: ConversationMode, _signal?: AbortSignal): Promise<void> {
		const userTurn: ConversationTurn = {
			id: `turn-${++this.turnCounter}`,
			role: "user",
			agentName: agent,
			content: message,
			timestamp: new Date().toISOString(),
			mode,
		};

		const conv = this.conversations.get(agent) ?? [];
		conv.push(userTurn);
		this.conversations.set(agent, conv);
		this.teamConversation.push(userTurn);

		this.updateAgentActivity(agent, "thinking");

		return new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				this.pending.delete(agent);

				const agentTurn: ConversationTurn = {
					id: `turn-${++this.turnCounter}`,
					role: "agent",
					agentName: agent,
					persona: this.agents.get(agent)?.persona,
					content: `[stub] Echo: ${message}`,
					timestamp: new Date().toISOString(),
					mode,
				};

				const agentConv = this.conversations.get(agent) ?? [];
				agentConv.push(agentTurn);
				this.conversations.set(agent, agentConv);
				this.teamConversation.push(agentTurn);

				this.emit({ kind: "message-received", agent, turn: agentTurn });
				this.updateAgentActivity(agent, "idle");
				resolve();
			}, randomDelay());

			this.pending.set(agent, { timer, resolve });
		});
	}

	async stopGeneration(agent: string): Promise<void> {
		const entry = this.pending.get(agent);
		if (entry) {
			clearTimeout(entry.timer);
			entry.resolve();
			this.pending.delete(agent);
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
