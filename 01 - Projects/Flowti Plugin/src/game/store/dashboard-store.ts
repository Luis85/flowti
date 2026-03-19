import type { DashboardAgent, ActivityEntry, PermissionEntry, Setting } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../../infrastructure/agents/cli-executor.js";

// ── Exported helper types ──────────────────────────────────────────

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TabName = "info" | "talk" | "tasks" | "permissions" | "history";

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
	llmStatus: Map<string, LlmStatus> = new Map();
	assignedTasks: Map<string, { name: string; status: string; assignedAt: number }[]> = new Map();

	currentScene: Setting = "hub";

	// ── Debug log ─────────────────────────────────────────────────
	debugLog: { timestamp: number; agentName: string; prompt: string; context?: string }[] = [];

	pushDebugEntry(agentName: string, prompt: string, context?: string): void {
		this.debugLog.push({ timestamp: Date.now(), agentName, prompt, context });
		if (this.debugLog.length > 50) this.debugLog.shift();
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

	constructor(cliExecutor?: ICliExecutor, worldContext?: WorldContext) {
		super();
		this.cliExecutor = cliExecutor ?? null;
		this.worldContext = worldContext ?? null;
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

	private handleCliEvent(agentName: string, event: CliEvent): void {
		switch (event.type) {
			case "response": {
				const text = event.text ?? "";
				this.pushAgentResponse(agentName, text);
				this.dispatchEvent(new CustomEvent("agent-response-received", {
					detail: { agentName, text, type: "speaking" },
				}));
				break;
			}
			case "thinking": {
				const text = event.text ?? "...";
				this.pushAgentThought(agentName, text);
				break;
			}
			case "permission-request": {
				this.dispatchEvent(new CustomEvent("permission-requested", {
					detail: { agentName, tool: event.tool, id: event.id },
				}));
				break;
			}
			case "error": {
				const text = event.text ?? "An error occurred.";
				this.pushAgentResponse(agentName, `[error] ${text}`);
				break;
			}
			case "task-started":
			case "task-completed":
			case "using-tool":
			case "tool-complete":
				// These events are handled by the data provider / engine action pipeline
				break;
		}
	}

	async sendMessage(agentName: string, message: string): Promise<{ ok: boolean; error?: string }> {
		this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName } }));

		let contextBlock = "";
		if (this.worldContext) {
			const isFirstMessage = !this.conversations.has(agentName) || this.conversations.get(agentName)!.length === 0;
			if (isFirstMessage) {
				const agent = this.agents.find((a) => a.name === agentName);
				const protocol = this.worldContext.getProtocolInstruction(agentName, agent?.domain ?? "general");
				const snapshot = this.worldContext.serialize();
				contextBlock = `${protocol}\n\n${snapshot}`;
			} else {
				contextBlock = this.worldContext.serializeDelta(agentName) ?? "";
			}
			this.worldContext.markSeen(agentName);
		}

		const fullPrompt = contextBlock ? `${contextBlock}\n\n${message}` : message;
		this.pushDebugEntry(agentName, fullPrompt);

		const proc = this.getOrStartProcess(agentName);
		if (!proc) {
			this.pushAgentResponse(agentName, "[offline] CLI executor not available.");
			return { ok: false, error: "CLI executor not available" };
		}

		try {
			proc.send(message, contextBlock || undefined);
			// Connection confirmed — update status
			if (this.connectionStatus !== "connected") {
				this.setConnectionStatus("connected");
			}
			return { ok: true };
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			this.pushAgentResponse(agentName, `[offline] ${errorMsg}`);
			return { ok: false, error: errorMsg };
		}
	}

	async assignTask(agentName: string, task: string): Promise<{ ok: boolean; error?: string }> {
		// Track locally immediately so the UI updates
		const tasks = this.assignedTasks.get(agentName) ?? [];
		tasks.push({ name: task, status: "pending", assignedAt: Date.now() });
		this.assignedTasks.set(agentName, tasks);

		// Log to debug console
		this.pushDebugEntry(agentName, `[TASK] ${task}`);

		// Fire visual effects (brain transition + thought bubble)
		this.dispatchEvent(new CustomEvent("task-assigned", { detail: { agentName, task } }));
		this.notify();

		if (!this.cliExecutor) {
			const idx = tasks.findIndex((t) => t.name === task && t.status === "pending");
			if (idx >= 0) tasks.splice(idx, 1);
			this.notify();
			return { ok: false, error: "CLI executor not available" };
		}

		const result = await this.cliExecutor.assignTask(agentName, task);
		if (result.ok) {
			const entry = tasks.find((t) => t.name === task && t.status === "pending");
			if (entry) entry.status = "in-progress";
			if (this.connectionStatus !== "connected") {
				this.setConnectionStatus("connected");
			}
			this.notify();
		} else {
			// Remove on failure
			const idx = tasks.findIndex((t) => t.name === task && t.status === "pending");
			if (idx >= 0) tasks.splice(idx, 1);
			this.notify();
			console.warn(`[store] Task assignment failed for ${agentName}`);
		}
		return result;
	}

	async grantPermission(agentName: string, tool: string, decision: string): Promise<{ ok: boolean }> {
		if (!this.cliExecutor) return { ok: false };
		return this.cliExecutor.grantPermission(agentName, tool, decision);
	}

	private static readonly WAKE_COOLDOWN_MS = 30_000;

	async wakeAgent(agentName: string): Promise<void> {
		const now = Date.now();
		const lastWoken = this.wokenAgents.get(agentName) ?? 0;
		if (now - lastWoken < DashboardStore.WAKE_COOLDOWN_MS) return;
		this.wokenAgents.set(agentName, now);
		if (!this.cliExecutor) return;
		await this.cliExecutor.wakeAgent(agentName);
	}
}
