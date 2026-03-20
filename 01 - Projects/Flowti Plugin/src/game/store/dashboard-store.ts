import type { DashboardAgent, ActivityEntry, PermissionEntry, Setting, TrackedTask } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../../infrastructure/agents/cli-executor.js";
import { extractAgentMessage } from "../data/message-utils.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Exported helper types ──────────────────────────────────────────

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TabName = "info" | "talk" | "tasks" | "permissions" | "monitor";

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

	currentScene: Setting = "hub";

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

	private pushEventLog(agentName: string, type: string, summary: string): void {
		const log = this.agentEventLog.get(agentName) ?? [];
		log.push({ timestamp: Date.now(), type, summary: summary.slice(0, 80) });
		if (log.length > 50) log.shift();
		this.agentEventLog.set(agentName, log);
	}

	private handleCliEvent(agentName: string, event: CliEvent): void {
		switch (event.type) {
			case "response": {
				const rawText = event.text ?? "";
				const text = extractAgentMessage(rawText);
				// Log raw response in debug mode
				if (this.debugMode) this.pushDebugResponse(agentName, rawText);
				// Store the response — task completion is handled by the "done" event
				this.pushAgentResponse(agentName, text);
				this.pushEventLog(agentName, "response", text.slice(0, 80));
				this.dispatchEvent(new CustomEvent("agent-response-received", {
					detail: { agentName, text, type: "speaking" },
				}));
				break;
			}
			case "thinking": {
				// Only update thinking state \u2014 do NOT add to conversation thread.
				// The talk engine handles the thinking indicator visually.
				this.thinkingAgents.add(agentName);
				this.llmStatus.set(agentName, { state: "thinking", since: Date.now() });
				this.pushEventLog(agentName, "thinking", "Thinking...");
				this.notify();
				break;
			}
			case "permission-request": {
				const toolName = event.tool ?? "unknown";
				// Track pending permission so the permissions tab can render it
				const pending = this.pendingPermissions.get(agentName) ?? [];
				if (!pending.some((p) => p.tool === toolName)) {
					pending.push({ tool: toolName, requestedAt: Date.now() });
					this.pendingPermissions.set(agentName, pending);
				}
				this.pushEventLog(agentName, "permission-request", `${toolName} \u2014 permission requested`);
				this.dispatchEvent(new CustomEvent("permission-requested", {
					detail: { agentName, tool: toolName, id: event.id },
				}));
				this.notify();
				break;
			}
			case "error": {
				const text = event.text ?? "An error occurred.";
				this.pushAgentResponse(agentName, `[error] ${text}`);
				this.pushEventLog(agentName, "error", event.text ?? "Unknown error");
				break;
			}
			case "using-tool": {
				const hasSummary = event.text && event.text !== event.tool;
				const toolSummary = hasSummary ? event.text! : (event.tool ?? "tool");
				this.pushEventLog(agentName, "using-tool", toolSummary);
				// Show tool usage as a natural one-liner in the conversation
				if (hasSummary) {
					this.pushAgentThought(agentName, `🔧 ${toolSummary}`);
				}
				this.dispatchEvent(new CustomEvent("agent-using-tool", {
					detail: { agentName, tool: event.tool ?? "tool" },
				}));
				break;
			}
			case "tool-complete": {
				const toolName = event.tool ?? "tool";
				this.pushEventLog(agentName, "tool-complete", `${toolName} done`);
				this.dispatchEvent(new CustomEvent("agent-tool-complete", {
					detail: { agentName, tool: toolName },
				}));
				break;
			}
			case "task-started": {
				// Mark the first pending task as in-progress
				const tasks = this.assignedTasks.get(agentName) ?? [];
				const pending = tasks.find((t) => t.status === "pending");
				if (pending) {
					this.markTaskStatus(agentName, pending.name, "in-progress");
					this.pushEventLog(agentName, "task-started", pending.name);
				}
				break;
			}
			case "done": {
				// Agent finished its turn — check if there's an active task to complete
				const doneTasks = this.assignedTasks.get(agentName) ?? [];
				const activeTask = doneTasks.find((t) => t.status === "in-progress");
				if (activeTask) {
					// Grab the last agent response as the task output
					const turns = this.conversations.get(agentName) ?? [];
					const lastResponse = [...turns].reverse().find((t) => t.role === "agent");
					const outputText = lastResponse?.text ?? "";
					const savedPath = this.saveTaskOutput(agentName, activeTask.name, outputText);
					const summary = savedPath
						? `Done. Saved to ${savedPath}`
						: `Done. (Could not save to vault)`;
					this.pushAgentResponse(agentName, summary);
					this.pushEventLog(agentName, "task-completed", `${activeTask.name} \u2192 ${savedPath ?? "unsaved"}`);
					this.markTaskStatus(agentName, activeTask.name, "completed");
					this.unreadAgents.add(agentName);
					this.dispatchEvent(new CustomEvent("task-completed", {
						detail: { agentName, task: activeTask.name, result: summary, path: savedPath },
					}));
				}
				this.thinkingAgents.delete(agentName);
				this.llmStatus.set(agentName, { state: "idle", since: Date.now() });
				this.pushEventLog(agentName, "done", "Turn complete");
				this.notify();
				break;
			}
			case "task-completed":
				break;
		}
	}

	async sendMessage(agentName: string, message: string): Promise<{ ok: boolean; error?: string }> {
		this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName } }));

		let contextBlock = "";
		if (this.worldContext) {
			const turns = this.conversations.get(agentName) ?? [];
			const hasAgentResponse = turns.some((t) => t.role === "agent");
			if (!hasAgentResponse) {
				// First real exchange — send full protocol + world snapshot
				const agent = this.agents.find((a) => a.name === agentName);
				const protocol = this.worldContext.getProtocolInstruction(agentName, agent?.domain ?? "general", agent ? {
					persona: agent.persona,
					mood: agent.mood,
					personality: agent.personality,
					skills: agent.skills,
					description: undefined,
				} : undefined);
				const snapshot = this.worldContext.serialize();
				contextBlock = `${protocol}\n\n${snapshot}`;
			} else {
				// Subsequent messages — send delta or refresh world snapshot if delta is empty
				contextBlock = this.worldContext.serializeDelta(agentName) ?? this.worldContext.serialize();
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
			// Connection confirmed \u2014 update status
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

	executeTask(agentName: string, task: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }, userInput?: string): void {
		// Track task
		const tasks = this.assignedTasks.get(agentName) ?? [];
		tasks.push({
			name: task.name,
			status: "pending",
			assignedAt: Date.now(),
			input: userInput,
			tool: task.tool,
		});
		this.assignedTasks.set(agentName, tasks);

		// Build task prompt — instruct LLM to produce a full markdown document
		const inputLine = userInput ? `\nDirector's input: ${userInput}` : "";
		const toolInstruction = task.tool
			? `\nA tool has been dispatched: "${task.tool.command}". Its output will follow. Incorporate the results into your document.`
			: "";
		const taskPrompt = `[Task Assignment]\nTask: ${task.name}${inputLine}${toolInstruction}\n\nProduce your output as a complete markdown document. Start with a heading. Be thorough but concise. Your entire response will be saved as a document in the vault.`;

		this.pushDebugEntry(agentName, taskPrompt, "task");

		// Dispatch events
		this.dispatchEvent(new CustomEvent("task-assigned", {
			detail: { agentName, task: task.name, tool: task.tool?.command },
		}));
		this.pushEventLog(agentName, "task-started", task.name);
		this.notify();

		// Send to LLM
		const proc = this.getOrStartProcess(agentName);
		if (!proc) {
			this.markTaskStatus(agentName, task.name, "failed");
			this.pushAgentResponse(agentName, "[offline] Cannot execute task \u2014 CLI executor not available.");
			return;
		}

		proc.send(taskPrompt);

		// Spawn tool if mapped
		if (task.tool) {
			this.runToolCommand(agentName, task, proc);
		}
	}

	private saveTaskOutput(agentName: string, taskName: string, content: string): string | null {
		if (!this.vaultBasePath) return null;
		try {
			const slug = taskName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
			const date = new Date().toISOString().slice(0, 10);
			const agentSlug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
			const dir = join(this.vaultBasePath, "03 - Resources", "Agents", "output", agentSlug);
			const filename = `${slug}-${date}.md`;
			const filePath = join(dir, filename);

			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
			writeFileSync(filePath, content, "utf-8");

			// Return vault-relative path (for Obsidian links)
			return `03 - Resources/Agents/output/${agentSlug}/${filename}`;
		} catch {
			return null;
		}
	}

	private markTaskStatus(agentName: string, taskName: string, status: string): void {
		const tasks = this.assignedTasks.get(agentName) ?? [];
		const entry = tasks.find((t) => t.name === taskName && t.status !== "completed" && t.status !== "failed");
		if (entry) (entry as { status: string }).status = status;
		this.notify();
	}

	private runToolCommand(agentName: string, task: { name: string; tool?: { command: string } }, proc: AgentProcess): void {
		if (!task.tool) return;

		const args = task.tool.command.split(/\s+/);
		const cmd = args.shift()!;

		void import("node:child_process").then(({ execFile }) => {
			execFile(cmd, args, { timeout: 120_000 }, (error, stdout, stderr) => {
				const output = [`[Tool output for "${task.name}"]`, "", stdout];
				if (stderr) output.push("[stderr]", stderr);
				if (error) output.push(`[exit code: ${error.code ?? "unknown"}]`);

				proc.send(output.join("\n"));
				this.pushDebugEntry(agentName, output.join("\n"), "tool-output");
			});
		});
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
			if (entry) (entry as { status: string }).status = "in-progress";
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
		// Remove from pending permissions
		const pending = this.pendingPermissions.get(agentName);
		if (pending) {
			const idx = pending.findIndex((p) => p.tool === tool);
			if (idx >= 0) pending.splice(idx, 1);
			this.notify();
		}
		const signalType = decision === "allow" ? "permission-grant" : "permission-deny";
		this.dispatchEvent(new CustomEvent("permission-decided", { detail: { agentName, signalType } }));
		return this.cliExecutor.grantPermission(agentName, tool, decision);
	}

	private static readonly WAKE_COOLDOWN_MS = 30_000;

	async wakeAgent(agentName: string): Promise<void> {
		const now = Date.now();
		const lastWoken = this.wokenAgents.get(agentName) ?? 0;
		if (now - lastWoken < DashboardStore.WAKE_COOLDOWN_MS) return;
		this.wokenAgents.set(agentName, now);
		if (!this.cliExecutor) return;
		// Eagerly start the agent process so LLM is warm when the user sends a message
		const proc = this.getOrStartProcess(agentName);
		if (proc && this.worldContext) {
			const agent = this.agents.find((a) => a.name === agentName);
			const protocol = this.worldContext.getProtocolInstruction(agentName, agent?.domain ?? "general", agent ? {
				persona: agent.persona,
				mood: agent.mood,
				personality: agent.personality,
				skills: agent.skills,
				description: undefined,
			} : undefined);
			const snapshot = this.worldContext.serialize();
			const primer = `${protocol}\n\n${snapshot}\n\nYou have just been summoned by the Director. Acknowledge briefly \u2014 one sentence, in character.`;
			this.pushDebugEntry(agentName, primer, "wake-up");
			proc.send(primer);
			this.worldContext.markSeen(agentName);
		}
		await this.cliExecutor.wakeAgent(agentName);
	}
}
