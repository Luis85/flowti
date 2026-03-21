import type { DashboardAgent, ActivityEntry, PermissionEntry, Setting, TrackedTask } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import type { AgentNeeds } from "../systems/needs-system.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../../infrastructure/agents/cli-executor.js";
import {
	handleCliResponse, handleCliPermissionRequest,
	handleCliUsingTool, handleCliToolComplete,
} from "./dashboard-store-tasks.js";
import {
	saveTaskOutput, runToolCommand, assignTaskViaExecutor,
	buildTaskPrompt, type TaskSpec,
} from "./dashboard-store-actions.js";

// ── Exported helper types ──────────────────────────────────────────

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TabName = "info" | "talk" | "tasks" | "permissions" | "monitor" | "debug";

export interface LlmStatus {
	readonly state: "idle" | "queued" | "thinking" | "error";
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
	pendingPermissions: Map<string, { tool: string; requestedAt: number }[]> = new Map();
	llmStatus: Map<string, LlmStatus> = new Map();
	assignedTasks: Map<string, TrackedTask[]> = new Map();
	unreadAgents: Set<string> = new Set();
	agentEventLog: Map<string, { timestamp: number; type: string; summary: string }[]> = new Map();
	taskLockedAgents: Set<string> = new Set();
	agentNeeds: Map<string, AgentNeeds> = new Map();

	setAgentNeeds(name: string, needs: AgentNeeds): void {
		this.agentNeeds.set(name, needs);
	}

	getAgentNeeds(name: string): AgentNeeds | undefined {
		return this.agentNeeds.get(name);
	}

	setAgentEconomy(name: string, data: { level?: number; coin?: number; tokens?: number; trustTier?: string; capabilities?: string[] }): void {
		const agent = this.agents.find(a => a.name === name);
		if (!agent) return;
		if (data.level !== undefined) agent.level = data.level;
		if (data.coin !== undefined) agent.coin = data.coin;
		if (data.tokens !== undefined) agent.tokens = data.tokens;
		if (data.trustTier !== undefined) agent.trustTier = data.trustTier as "supervised" | "trusted" | "autonomous";
		if (data.capabilities !== undefined) agent.capabilities = data.capabilities;
	}

	getAgentEconomy(name: string): { level: number; coin: number; tokens: number; trustTier: string; capabilities: string[] } | undefined {
		const agent = this.agents.find(a => a.name === name);
		if (!agent) return undefined;
		return { level: agent.level ?? 1, coin: agent.coin ?? 0, tokens: agent.tokens ?? 0, trustTier: agent.trustTier ?? "supervised", capabilities: agent.capabilities ?? [] };
	}

	currentScene: Setting = "hub";

	// ── Living World state ────────────────────────────────────────
	dayPhase = "morning-arrival";
	weatherState = "clear";

	setDayPhase(phase: string): void {
		this.dayPhase = phase;
		this.notify();
	}

	setWeatherState(weather: string): void {
		this.weatherState = weather;
		this.notify();
	}

	// ── World event log ──────────────────────────────────────────
	worldEventLog: Array<{ timestamp: number; type: string; label: string }> = [];
	activeWorldEvent: string | null = null;
	dayProgress = 0;
	cycleCount = 0;

	pushWorldEvent(type: string, label: string): void {
		this.worldEventLog.push({ timestamp: Date.now(), type, label });
		if (this.worldEventLog.length > 50) this.worldEventLog.shift();
		this.activeWorldEvent = type;
		this.notify();
	}

	clearActiveWorldEvent(): void {
		this.activeWorldEvent = null;
		this.notify();
	}

	setDayProgress(progress: number, cycle: number): void {
		this.dayProgress = progress;
		this.cycleCount = cycle;
	}

	// ── Debug log ─────────────────────────────────────────────────
	debugMode = false;
	debugLog: { timestamp: number; agentName: string; prompt: string; context?: string; rawResponse?: string }[] = [];

	toggleDebugMode(): void {
		this.debugMode = !this.debugMode;
		this.notify();
	}

	pushDebugEntry(agentName: string, prompt: string, context?: string): void {
		this.debugLog.push({ timestamp: Date.now(), agentName, prompt, context });
		if (this.debugLog.length > 50) this.debugLog.shift();
		this.notify();
	}

	pushDebugResponse(agentName: string, rawResponse: string): void {
		if (!this.debugMode) return;
		// Append raw response to the last entry for this agent, or create a new one
		const lastEntry = [...this.debugLog].reverse().find((e) => e.agentName === agentName);
		if (lastEntry) {
			lastEntry.rawResponse = rawResponse;
		} else {
			this.debugLog.push({ timestamp: Date.now(), agentName, prompt: "(response only)", rawResponse });
			if (this.debugLog.length > 50) this.debugLog.shift();
		}
		this.notify();
	}

	// ── Private state ─────────────────────────────────────────────
	private conversations: Map<string, ConversationTurn[]> = new Map();
	private thinkingAgents: Set<string> = new Set();
	private batchDepth = 0;
	private batchDirty = false;
	private wokenAgents: Map<string, number> = new Map();
	private agentProcesses: Map<string, AgentProcess> = new Map();
	private eventUnsubs: Map<string, () => void> = new Map();

	private cliExecutor: ICliExecutor | null;
	private worldContext: WorldContext | null;
	private vaultBasePath: string | null;

	constructor(cliExecutor?: ICliExecutor, worldContext?: WorldContext, vaultBasePath?: string) {
		super();
		this.cliExecutor = cliExecutor ?? null;
		this.worldContext = worldContext ?? null;
		this.vaultBasePath = vaultBasePath ?? null;
	}

	// ── Batching ──────────────────────────────────────────────────

	/** Suppress notify() calls until endBatch(). Nestable. */
	beginBatch(): void {
		this.batchDepth++;
	}

	/** End a batch. Fires a single state-changed event if anything changed. */
	endBatch(): void {
		if (this.batchDepth > 0) this.batchDepth--;
		if (this.batchDepth === 0 && this.batchDirty) {
			this.batchDirty = false;
			this.dispatchEvent(new Event("state-changed"));
		}
	}

	// ── Notification ──────────────────────────────────────────────

	private rafPending = false;

	private notify(): void {
		if (this.batchDepth > 0) {
			this.batchDirty = true;
			return;
		}
		// In non-browser environments (Node tests), fall back to synchronous dispatch
		if (typeof requestAnimationFrame === "undefined") {
			this.dispatchEvent(new Event("state-changed"));
			return;
		}
		if (this.rafPending) return;
		this.rafPending = true;
		requestAnimationFrame(() => {
			this.rafPending = false;
			this.dispatchEvent(new Event("state-changed"));
		});
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
		if (tab === "talk" && this.selectedAgent) {
			this.unreadAgents.delete(this.selectedAgent);
		}
		this.notify();
	}

	isProcessAlive(agentName: string): boolean {
		return this.agentProcesses.get(agentName)?.running ?? false;
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
		if (this.agentStates.get(agentName) === state) return;
		this.agentStates.set(agentName, state);
		this.notify();
	}

	setAgentTarget(agentName: string, target: Point): void {
		const prev = this.agentTargets.get(agentName);
		if (prev && Math.abs(prev.x - target.x) < 0.5 && Math.abs(prev.y - target.y) < 0.5) return;
		this.agentTargets.set(agentName, target);
		this.notify();
	}

	clearAgentTarget(agentName: string): void {
		if (!this.agentTargets.has(agentName)) return;
		this.agentTargets.delete(agentName);
		this.notify();
	}

	// ── Conversation management ───────────────────────────────────

	pushUserMessage(agentName: string, text: string): void {
		const turns = this.conversations.get(agentName) ?? [];
		turns.push({ role: "user", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		this.thinkingAgents.add(agentName);
		this.llmStatus.set(agentName, { state: "thinking", since: Date.now() });
		this.notify();
	}

	pushAgentResponse(agentName: string, text: string): void {
		const turns = this.conversations.get(agentName) ?? [];
		// Dedup: skip if the last turn is the same agent message within 5 seconds
		const last = turns.length > 0 ? turns[turns.length - 1] : null;
		if (last && last.role === "agent" && last.text === text && Date.now() - last.timestamp < 5000) return;
		turns.push({ role: "agent", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		this.thinkingAgents.delete(agentName);
		this.llmStatus.set(agentName, { state: "idle", since: Date.now() });
		this.notify();
	}

	/** Push an interim agent message without clearing the thinking state. */
	pushAgentThought(agentName: string, text: string): void {
		const turns = this.conversations.get(agentName) ?? [];
		turns.push({ role: "agent", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
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

	// ── Action methods (CliExecutor-backed) ──────────────────────

	private getOrStartProcess(agentName: string): AgentProcess | null {
		if (!this.cliExecutor) return null;

		const existing = this.agentProcesses.get(agentName);
		if (existing?.running) return existing;

		// Clean up old subscription
		const oldUnsub = this.eventUnsubs.get(agentName);
		if (oldUnsub) {
			oldUnsub();
			this.eventUnsubs.delete(agentName);
		}

		const proc = this.cliExecutor.startAgent(agentName);
		this.agentProcesses.set(agentName, proc);

		// Subscribe to process events
		const unsub = proc.onEvent((event: CliEvent) => {
			this.handleCliEvent(agentName, event);
		});
		this.eventUnsubs.set(agentName, unsub);

		return proc;
	}

	pushEventLog(agentName: string, type: string, summary: string): void {
		const log = this.agentEventLog.get(agentName) ?? [];
		log.push({ timestamp: Date.now(), type, summary: summary.slice(0, 80) });
		if (log.length > 50) log.shift();
		this.agentEventLog.set(agentName, log);
	}

	private handleCliEvent(agentName: string, event: CliEvent): void {
		switch (event.type) {
			case "response": handleCliResponse(this, agentName, event); break;
			case "thinking": this.thinkingAgents.add(agentName); this.llmStatus.set(agentName, { state: "thinking", since: Date.now() }); this.pushEventLog(agentName, "thinking", "Thinking..."); this.notify(); break;
			case "permission-request": handleCliPermissionRequest(this, agentName, event); this.notify(); break;
			case "error": this.pushAgentResponse(agentName, `[error] ${event.text ?? "An error occurred."}`); this.pushEventLog(agentName, "error", event.text ?? "Unknown error"); break;
			case "using-tool": handleCliUsingTool(this, agentName, event); break;
			case "tool-complete": handleCliToolComplete(this, agentName, event); break;
			case "task-started": this.handleTaskStarted(agentName); break;
			case "done": this.handleDone(agentName); break;
			case "task-completed": break;
		}
	}

	private handleTaskStarted(agentName: string): void {
		const tasks = this.assignedTasks.get(agentName) ?? [];
		const pending = tasks.find((t) => t.status === "pending");
		if (pending) { this.markTaskStatus(agentName, pending.name, "in-progress"); this.pushEventLog(agentName, "task-started", pending.name); }
	}

	private handleDone(agentName: string): void {
		const doneTasks = this.assignedTasks.get(agentName) ?? [];
		const activeTask = doneTasks.find((t) => t.status === "in-progress");
		if (activeTask) {
			const turns = this.conversations.get(agentName) ?? [];
			const lastResponse = [...turns].reverse().find((t) => t.role === "agent");
			const savedPath = this.saveTaskOutputToVault(agentName, activeTask.name, lastResponse?.text ?? "");
			const summary = savedPath ? `Done. Saved to ${savedPath}` : `Done. (Could not save to vault)`;
			this.pushAgentResponse(agentName, summary);
			this.pushEventLog(agentName, "task-completed", `${activeTask.name} \u2192 ${savedPath ?? "unsaved"}`);
			this.markTaskStatus(agentName, activeTask.name, "completed");
			this.unreadAgents.add(agentName);
			this.dispatchEvent(new CustomEvent("task-completed", { detail: { agentName, task: activeTask.name, result: summary, path: savedPath } }));
		}
		this.thinkingAgents.delete(agentName);
		this.llmStatus.set(agentName, { state: "idle", since: Date.now() });
		this.pushEventLog(agentName, "done", "Turn complete");
		this.notify();
	}

	async sendMessage(agentName: string, message: string): Promise<{ ok: boolean; error?: string }> {
		this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName } }));

		const contextBlock = this.buildMessageContext(agentName);
		const fullPrompt = contextBlock ? `${contextBlock}\n\n${message}` : message;
		this.pushDebugEntry(agentName, fullPrompt);

		const proc = this.getOrStartProcess(agentName);
		if (!proc) {
			this.pushAgentResponse(agentName, "[offline] CLI executor not available.");
			return { ok: false, error: "CLI executor not available" };
		}

		try {
			proc.send(message, contextBlock || undefined);
			if (this.connectionStatus !== "connected") this.setConnectionStatus("connected");
			return { ok: true };
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			this.pushAgentResponse(agentName, `[offline] ${errorMsg}`);
			return { ok: false, error: errorMsg };
		}
	}

	private buildMessageContext(agentName: string): string {
		if (!this.worldContext) return "";
		const hasAgentResponse = (this.conversations.get(agentName) ?? []).some((t) => t.role === "agent");
		const contextBlock = hasAgentResponse
			? (this.worldContext.serializeDelta(agentName) ?? this.worldContext.serialize())
			: (() => { const agent = this.agents.find((a) => a.name === agentName); return `${this.worldContext!.getProtocolInstruction(agentName, agent?.domain ?? "general", agent ? { persona: agent.persona, mood: agent.mood, personality: agent.personality, skills: agent.skills, description: undefined } : undefined)}\n\n${this.worldContext!.serialize()}`; })();
		this.worldContext.markSeen(agentName);
		return contextBlock;
	}

	executeTask(agentName: string, task: TaskSpec, userInput?: string): void {
		const tasks = this.assignedTasks.get(agentName) ?? [];
		tasks.push({ name: task.name, status: "pending", assignedAt: Date.now(), input: userInput, tool: task.tool });
		this.assignedTasks.set(agentName, tasks);

		const taskPrompt = buildTaskPrompt(task, userInput);
		this.pushDebugEntry(agentName, taskPrompt, "task");
		this.dispatchEvent(new CustomEvent("task-assigned", { detail: { agentName, task: task.name, tool: task.tool?.command } }));
		this.pushEventLog(agentName, "task-started", task.name);
		this.notify();

		const proc = this.getOrStartProcess(agentName);
		if (!proc) {
			this.markTaskStatus(agentName, task.name, "failed");
			this.pushAgentResponse(agentName, "[offline] Cannot execute task \u2014 CLI executor not available.");
			return;
		}
		proc.send(taskPrompt);
		if (task.tool) this.runToolCommandForTask(agentName, task, proc);
	}

	private saveTaskOutputToVault(agentName: string, taskName: string, content: string): string | null {
		return saveTaskOutput(this.vaultBasePath, agentName, taskName, content);
	}

	private markTaskStatus(agentName: string, taskName: string, status: string): void {
		const tasks = this.assignedTasks.get(agentName) ?? [];
		const entry = tasks.find((t) => t.name === taskName && t.status !== "completed" && t.status !== "failed");
		if (entry) (entry as { status: string }).status = status;
		this.notify();
	}

	private runToolCommandForTask(agentName: string, task: { name: string; tool?: { command: string } }, proc: AgentProcess): void {
		runToolCommand(agentName, task, proc, (name, prompt, ctx) => this.pushDebugEntry(name, prompt, ctx));
	}

	async assignTask(agentName: string, task: string): Promise<{ ok: boolean; error?: string }> {
		this.notify();
		const result = await assignTaskViaExecutor(this, this.cliExecutor, agentName, task);
		this.notify();
		return result;
	}

	async grantPermission(agentName: string, tool: string, decision: string): Promise<{ ok: boolean }> {
		if (!this.cliExecutor) return { ok: false };
		const pending = this.pendingPermissions.get(agentName);
		if (pending) { const idx = pending.findIndex((p) => p.tool === tool); if (idx >= 0) pending.splice(idx, 1); this.notify(); }
		this.dispatchEvent(new CustomEvent("permission-decided", { detail: { agentName, signalType: decision === "allow" ? "permission-grant" : "permission-deny" } }));
		return this.cliExecutor.grantPermission(agentName, tool, decision);
	}

	private static readonly WAKE_COOLDOWN_MS = 30_000;

	async wakeAgent(agentName: string): Promise<void> {
		const now = Date.now();
		if (now - (this.wokenAgents.get(agentName) ?? 0) < DashboardStore.WAKE_COOLDOWN_MS) return;
		this.wokenAgents.set(agentName, now);
		if (!this.cliExecutor) return;
		const proc = this.getOrStartProcess(agentName);
		if (proc && this.worldContext) {
			const context = this.buildMessageContext(agentName);
			const primer = `${context}\n\nYou have just been summoned by the Director. Acknowledge briefly \u2014 one sentence, in character.`;
			this.pushDebugEntry(agentName, primer, "wake-up");
			proc.send(primer);
		}
		await this.cliExecutor.wakeAgent(agentName);
	}
}
