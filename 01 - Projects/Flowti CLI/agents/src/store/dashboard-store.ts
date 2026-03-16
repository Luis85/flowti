import type { DashboardAgent, ActivityEntry, PermissionEntry, Setting } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import * as api from "../data/api-client.js";

// ── Exported helper types ──────────────────────────────────────────

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TabName = "info" | "talk" | "tasks" | "permissions" | "history";

export interface LlmStatus {
	readonly state: "idle" | "thinking" | "error";
	readonly since: number;
}

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly text: string;
	readonly timestamp: number;
}

// ── Store ──────────────────────────────────────────────────────────

export class DashboardStore extends EventTarget {
	// ── Public reactive state ─────────────────────────────────────
	agents: readonly DashboardAgent[] = [];
	agentPositions: Map<string, Point> = new Map();
	agentTargets: Map<string, Point> = new Map();
	agentStates: Map<string, BrainState> = new Map();

	selectedAgent: string | null = null;
	selectedTab: TabName = "info";
	followedAgent: string | null = null;

	connectionStatus: ConnectionStatus = "disconnected";
	activityLog: readonly ActivityEntry[] = [];
	permissions: Map<string, readonly PermissionEntry[]> = new Map();
	llmStatus: Map<string, LlmStatus> = new Map();

	currentScene: Setting = "hub";

	// ── Private state ─────────────────────────────────────────────
	private conversations: Map<string, ConversationTurn[]> = new Map();
	private thinkingAgents: Set<string> = new Set();

	private readonly baseUrl: string;

	constructor(baseUrl = "") {
		super();
		this.baseUrl = baseUrl;
	}

	// ── Notification ──────────────────────────────────────────────

	private notify(): void {
		this.dispatchEvent(new Event("state-changed"));
	}

	// ── State setters ─────────────────────────────────────────────

	setAgents(agents: readonly DashboardAgent[]): void {
		this.agents = agents;
		this.notify();
	}

	updatePositions(positions: Map<string, Point>): void {
		this.agentPositions = positions;
		this.notify();
	}

	selectAgent(name: string | null): void {
		this.selectedAgent = name;
		this.notify();
	}

	selectTab(tab: TabName): void {
		this.selectedTab = tab;
		this.notify();
	}

	startFollow(agentName: string): void {
		this.followedAgent = agentName;
		this.notify();
	}

	stopFollow(): void {
		this.followedAgent = null;
		this.notify();
	}

	setConnectionStatus(status: ConnectionStatus): void {
		this.connectionStatus = status;
		this.notify();
	}

	setActivityLog(log: readonly ActivityEntry[]): void {
		this.activityLog = log;
		this.notify();
	}

	setPermissions(agentName: string, perms: readonly PermissionEntry[]): void {
		this.permissions.set(agentName, perms);
		this.notify();
	}

	setLlmStatus(agentName: string, status: LlmStatus): void {
		this.llmStatus.set(agentName, status);
		this.notify();
	}

	setAgentState(agentName: string, state: BrainState): void {
		this.agentStates.set(agentName, state);
		this.notify();
	}

	setAgentTarget(agentName: string, target: Point): void {
		this.agentTargets.set(agentName, target);
		this.notify();
	}

	// ── Conversation management ───────────────────────────────────

	pushUserMessage(agentName: string, text: string): void {
		const turns = this.conversations.get(agentName) ?? [];
		turns.push({ role: "user", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		this.thinkingAgents.add(agentName);
		this.notify();
	}

	pushAgentResponse(agentName: string, text: string): void {
		const turns = this.conversations.get(agentName) ?? [];
		turns.push({ role: "agent", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		this.thinkingAgents.delete(agentName);
		this.notify();
	}

	getConversation(agentName: string): readonly ConversationTurn[] {
		return this.conversations.get(agentName) ?? [];
	}

	isThinking(agentName: string): boolean {
		return this.thinkingAgents.has(agentName);
	}

	// ── Scene management ──────────────────────────────────────────

	changeScene(setting: Setting): void {
		this.currentScene = setting;
		this.dispatchEvent(new CustomEvent("scene-change", { detail: { setting } }));
		this.notify();
	}

	// ── Action methods (call API client) ──────────────────────────

	async sendMessage(agentName: string, message: string): Promise<{ ok: boolean; error?: string }> {
		const result = await api.sendMessage(this.baseUrl, agentName, message);
		if (result.ok) {
			this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName } }));
		}
		return result;
	}

	async assignTask(agentName: string, task: string): Promise<{ ok: boolean; error?: string }> {
		const result = await api.assignTask(this.baseUrl, agentName, task);
		if (result.ok) {
			this.dispatchEvent(new CustomEvent("task-assigned", { detail: { agentName, task } }));
		}
		return result;
	}

	async grantPermission(agentName: string, tool: string, decision: string): Promise<{ ok: boolean; error?: string }> {
		return api.grantPermission(this.baseUrl, agentName, tool, decision);
	}

	async wakeAgent(agentName: string): Promise<void> {
		return api.wakeAgent(this.baseUrl, agentName);
	}
}
