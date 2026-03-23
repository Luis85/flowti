import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DashboardAgent, ActivityEntry, PermissionEntry, Setting, TrackedTask } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import type { AgentNeeds } from "../systems/needs-system.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../../infrastructure/agents/cli-executor.js";
import { findNodeBinary } from "../../infrastructure/agents/cli-executor.js";
import { runOneShotCommand } from "../../infrastructure/agents/cli-executor-helpers.js";
import {
	sampleManyAgentProcessResourcesAsync,
	type AgentProcessResources,
} from "../../infrastructure/agents/agent-process-metrics.js";

export type { AgentProcessResources };
import {
	handleCliResponse, handleCliPermissionRequest,
	handleCliUsingTool, handleCliToolComplete,
} from "./dashboard-store-tasks.js";
import {
	saveTaskOutput, runToolCommand, assignTaskViaExecutor,
	buildTaskPrompt, type TaskSpec,
} from "./dashboard-store-actions.js";
import { afterNextPaint } from "../after-next-paint.js";
import type { StoryBeat } from "../systems/narrative-system.js";
import type { OfflineResults } from "../systems/offline-progress.js";

// ── Exported helper types ──────────────────────────────────────────

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TabName = "profile" | "talk" | "tasks" | "permissions" | "brain" | "debug";

export type PanelMode = "agent-detail" | "bob" | "roster" | "merchant" | "briefing";

// ── Behavior-tree snapshot types ─────────────────────────────────

export type BTNodeType = "selector" | "sequence" | "condition" | "action";
export type BTNodeStatus = "running" | "success" | "failure" | "idle";

export interface BTNodeState {
	readonly id: string;
	readonly label: string;
	readonly type: BTNodeType;
	readonly status: BTNodeStatus;
	readonly children: BTNodeState[];
}

export interface BTTreeSnapshot {
	readonly root: BTNodeState;
	readonly tick: number;
}

export interface LlmStatus {
	readonly state: "idle" | "queued" | "thinking" | "error";
	readonly since: number;
}

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly text: string;
	readonly timestamp: number;
}

/**
 * Fired when {@link DashboardStore.refreshAgentResources} updates {@link DashboardStore.agentResourceMetrics}.
 * Intentionally **not** a `state-changed` so RAM/CPU polls do not re-render the whole canvas overlay tree
 * (agent panel, roster, etc.) — only components that subscribe to this event should refresh.
 */
export const AGENT_RESOURCES_CHANGED_EVENT = "agent-resources-changed";

// ── Store ──────────────────────────────────────────────────────────

export class DashboardStore extends EventTarget {
	// ── Public reactive state ─────────────────────────────────────
	agents: readonly DashboardAgent[] = [];
	agentPositions: Map<string, Point> = new Map();
	agentTargets: Map<string, Point> = new Map();
	agentStates: Map<string, BrainState> = new Map();

	selectedAgent: string | null = null;
	selectedTab: TabName = "profile";
	activePanel: PanelMode | null = null;
	briefingData: { results: OfflineResults; narrativeText: string } | null = null;
	followedAgent: string | null = null;

	connectionStatus: ConnectionStatus = "disconnected";
	activityLog: readonly ActivityEntry[] = [];
	permissions: Map<string, readonly PermissionEntry[]> = new Map();
	pendingPermissions: Map<string, { tool: string; requestedAt: number }[]> = new Map();
	llmStatus: Map<string, LlmStatus> = new Map();
	assignedTasks: Map<string, TrackedTask[]> = new Map();
	unreadAgents: Set<string> = new Set();
	agentEventLog: Map<string, { timestamp: number; type: string; summary: string }[]> = new Map();
	/** PID/RAM/CPU samples for spawned CLI processes (Monitor tab). */
	agentResourceMetrics: Map<string, AgentProcessResources> = new Map();
	taskLockedAgents: Set<string> = new Set();
	agentNeeds: Map<string, AgentNeeds> = new Map();
	council: string[] = [];
	btTreeState: Map<string, BTTreeSnapshot> = new Map();

	/**
	 * Obsidian plugin root URL (via {@link VaultAdapter.getResourcePath}), no trailing slash.
	 * Used so Lit `<img>` portraits resolve under the plugin like Excalibur sprite paths.
	 */
	spriteBasePath = "";

	setAgentNeeds(name: string, needs: AgentNeeds): void { this.agentNeeds.set(name, needs); }
	getAgentNeeds(name: string): AgentNeeds | undefined { return this.agentNeeds.get(name); }

	/** Recent narrative beats for the in-game story feed. Capped at 20 entries. */
	narrativeBeats: readonly StoryBeat[] = [];

	pushNarrativeBeat(beat: StoryBeat): void {
		const next = [...this.narrativeBeats, beat];
		if (next.length > 20) next.shift();
		this.narrativeBeats = next;
		this.notify();
	}

	clearNarrativeBeats(): void {
		this.narrativeBeats = [];
		this.notify();
	}

	setAgentEconomy(name: string, data: { level?: number; coin?: number; tokens?: number; xp?: number; trustTier?: string; capabilities?: string[] }): void {
		const idx = this.agents.findIndex(a => a.name === name);
		if (idx === -1) return;
		const agent = this.agents[idx];
		const updated: DashboardAgent = {
			...agent,
			...(data.level !== undefined && { level: data.level }),
			...(data.coin !== undefined && { coin: data.coin }),
			...(data.tokens !== undefined && { tokens: data.tokens }),
			...(data.xp !== undefined && { xp: data.xp }),
			...(data.trustTier !== undefined && { trustTier: data.trustTier as "supervised" | "trusted" | "autonomous" }),
			...(data.capabilities !== undefined && { capabilities: data.capabilities }),
		};
		this.agents = [...this.agents.slice(0, idx), updated, ...this.agents.slice(idx + 1)];
		this.notify();
	}

	getAgentEconomy(name: string): { level: number; coin: number; tokens: number; xp: number; trustTier: string; capabilities: string[] } | undefined {
		const agent = this.agents.find(a => a.name === name);
		if (!agent) return undefined;
		return { level: agent.level ?? 1, coin: agent.coin ?? 0, tokens: agent.tokens ?? 0, xp: agent.xp ?? 0, trustTier: agent.trustTier ?? "supervised", capabilities: [...(agent.capabilities ?? [])] };
	}

	currentScene: Setting = "hub";

	/**
	 * When false, Talk / AI task assignment cannot spawn `agent:start` (no executor, missing Node, or missing CLI bundle).
	 * AI agents may still appear from vault data — they are “configured” but not runnable here.
	 */
	cliSessionAvailable = true;
	/** User-facing explanation when {@link cliSessionAvailable} is false. */
	cliSessionBlockedReason = "";

	// ── Living World state ────────────────────────────────────────
	dayPhase = "morning-arrival";
	weatherState = "clear";

	setDayPhase(phase: string): void { this.dayPhase = phase; this.notify(); }
	setWeatherState(weather: string): void { this.weatherState = weather; this.notify(); }

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

	clearActiveWorldEvent(): void { this.activeWorldEvent = null; this.notify(); }
	setDayProgress(progress: number, cycle: number): void { this.dayProgress = progress; this.cycleCount = cycle; }

	// ── Debug log ─────────────────────────────────────────────────
	debugMode = false;
	debugLog: { timestamp: number; agentName: string; prompt: string; context?: string; rawResponse?: string }[] = [];

	toggleDebugMode(): void { this.debugMode = !this.debugMode; this.notify(); }

	pushDebugEntry(agentName: string, prompt: string, context?: string): void {
		this.debugLog.push({ timestamp: Date.now(), agentName, prompt, context });
		if (this.debugLog.length > 50) this.debugLog.shift();
		// Avoid full overlay re-renders on every LLM prompt when Debug tab is off (wake/send spikes the canvas).
		if (this.debugMode) this.notify();
	}

	pushDebugResponse(agentName: string, rawResponse: string): void {
		if (!this.debugMode) return;
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
	/** Clears stuck "thinking" if the LLM CLI never completes (missing Claude, hung process, …). */
	private thinkingWatchdogs = new Map<string, ReturnType<typeof setTimeout>>();
	/** Coalesce rapid template-chatter updates (selected agent → panel) so we do not notify every line. */
	private agentThoughtNotifyTimer: ReturnType<typeof setTimeout> | null = null;
	/** Skip overlapping polls — async Windows sampling can outlast the interval. */
	private agentResourceRefreshInFlight = false;

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

	/**
	 * Recompute whether Talk / tasks can spawn the Flowti agent CLI. Call after construction (engine startup).
	 */
	syncCliSessionFromEnvironment(): void {
		if (!this.cliExecutor) {
			this.cliSessionAvailable = false;
			this.cliSessionBlockedReason =
				"No CLI executor is attached to this view. The world can still show agents from vault files; Talk and CLI-backed tasks are disabled.";
			this.notify();
			return;
		}

		const readiness = this.cliExecutor.getHostReadiness?.();
		if (readiness) {
			this.cliSessionAvailable = readiness.canSpawnAgents;
			this.cliSessionBlockedReason = readiness.canSpawnAgents ? "" : readiness.issues.join(" ");
			this.notify();
			return;
		}

		// Mocks / alternate executors without getHostReadiness
		if (this.vaultBasePath) {
			const bin = join(this.vaultBasePath, ".flowti", "bin", "main.mjs");
			const node = findNodeBinary();
			const ok = node !== null && existsSync(bin);
			this.cliSessionAvailable = ok;
			this.cliSessionBlockedReason = ok
				? ""
				: [
					!node ? "Node.js was not found on PATH." : "",
					!existsSync(bin) ? `Flowti CLI bundle missing at ${bin}.` : "",
				]
					.filter(Boolean)
					.join(" ");
		} else {
			this.cliSessionAvailable = true;
			this.cliSessionBlockedReason = "";
		}
		this.notify();
	}

	/** @internal visible for tests */
	static readonly THINKING_WATCHDOG_MS = 120_000;

	private clearThinkingWatchdog(agentName: string): void {
		const id = this.thinkingWatchdogs.get(agentName);
		if (id !== undefined) {
			clearTimeout(id);
			this.thinkingWatchdogs.delete(agentName);
		}
	}

	/** Reset timer while waiting for an LLM reply (user sent a message or CLI reported "thinking"). */
	private scheduleThinkingWatchdog(agentName: string): void {
		this.clearThinkingWatchdog(agentName);
		const id = setTimeout(() => {
			this.thinkingWatchdogs.delete(agentName);
			if (!this.thinkingAgents.has(agentName)) return;
			this.pushEventLog(agentName, "error", "LLM reply timeout");
			this.pushAgentResponse(
				agentName,
				"[timeout] No reply from the LLM CLI after two minutes. If agents target Claude or another backend, install it on this machine where Flowti runs agent processes. The Agent World canvas does not require an LLM — agents keep wandering and using ambient dialogue.",
				{ llmState: "error" },
			);
		}, DashboardStore.THINKING_WATCHDOG_MS);
		this.thinkingWatchdogs.set(agentName, id);
	}

	updatePositions(positions: Map<string, Point>): void {
		this.agentPositions = positions;
		this.notify();
	}

	selectAgent(name: string | null): void {
		if (name === this.selectedAgent) return;
		const wasOpen = this.activePanel !== null;
		const prev = this.selectedAgent;
		if (prev && prev !== name) {
			this.deselectAgent(prev);
		}
		this.selectedAgent = name;
		if (name) {
			const proc = this.getOrStartProcess(name);
			if (proc) {
				proc.sendRaw({ type: "agent-selected" });
			}
		}
		if (name) {
			this.activePanel = "agent-detail";
		} else if (this.activePanel === "agent-detail") {
			this.activePanel = null;
		}
		// Emit panel-changed only on open/close transitions
		const nowOpen = this.activePanel !== null;
		if (wasOpen !== nowOpen) {
			this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: this.activePanel } }));
		}
		this.notify();
	}

	deselectAgent(agentName: string): void {
		const proc = this.agentProcesses.get(agentName);
		if (proc?.running) {
			proc.sendRaw({ type: "agent-deselected" });
		}
		if (this.selectedAgent === agentName) {
			this.selectedAgent = null;
		}
		if (this.activePanel === "agent-detail") {
			this.activePanel = null;
			this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: null } }));
		}
		this.notify();
	}

	forwardBtAction(agentName: string, action: string, data: Record<string, unknown>): void {
		const agent = this.agents.find((a) => a.name === agentName);
		if (!agent || agent.agentType !== "ai") return;
		const proc = this.getOrStartProcess(agentName);
		if (proc) {
			proc.sendRaw({ type: "bt-action", action, data });
		}
	}

	private static readonly VALID_TABS: ReadonlySet<TabName> = new Set<TabName>(["profile", "talk", "tasks", "permissions", "brain", "debug"]);

	selectTab(tab: TabName): void {
		this.selectedTab = DashboardStore.VALID_TABS.has(tab) ? tab : "profile";
		if (tab === "talk" && this.selectedAgent) {
			this.unreadAgents.delete(this.selectedAgent);
		}
		this.notify();
	}

	setActivePanel(mode: PanelMode | null): void {
		const wasOpen = this.activePanel !== null;
		const isOpen = mode !== null;
		this.activePanel = mode;
		if (wasOpen !== isOpen) {
			this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: mode } }));
		}
		this.notify();
	}

	// ── Council management ───────────────────────────────────────

	addToCouncil(name: string): void {
		if (this.council.length >= 5 || this.council.includes(name)) return;
		this.council = [...this.council, name];
		this.persistCouncil();
		this.notify();
	}

	removeFromCouncil(name: string): void {
		const filtered = this.council.filter(n => n !== name);
		if (filtered.length === this.council.length) return;
		this.council = filtered;
		this.persistCouncil();
		this.notify();
	}

	setCouncil(names: string[]): void {
		this.council = names.slice(0, 5);
		this.persistCouncil();
		this.notify();
	}

	reorderCouncil(names: string[]): void {
		this.council = names.slice(0, 5);
		this.persistCouncil();
		this.notify();
	}

	private persistCouncil(): void {
		try { localStorage.setItem("flowti-council", JSON.stringify(this.council)); } catch { /* localStorage unavailable */ }
	}

	// ── BT tree state ────────────────────────────────────────────

	updateBtTree(agentName: string, snapshot: BTTreeSnapshot): void {
		this.btTreeState.set(agentName, snapshot);
		this.notify();
	}

	isProcessAlive(agentName: string): boolean {
		return this.agentProcesses.get(agentName)?.running ?? false;
	}

	/**
	 * Refresh memory/CPU metrics for running agent CLI processes (spawned via CliExecutor).
	 * No-op without a CliExecutor. Safe to call on an interval (use `void store.refreshAgentResources()`).
	 * Uses async OS sampling on Windows so PowerShell does not block the main thread for hundreds of ms.
	 */
	async refreshAgentResources(): Promise<void> {
		if (!this.cliExecutor) return;
		if (this.agentResourceRefreshInFlight) return;
		this.agentResourceRefreshInFlight = true;

		try {
			let changed = false;

			for (const name of [...this.agentResourceMetrics.keys()]) {
				const proc = this.agentProcesses.get(name);
				if (!proc?.running) {
					this.agentResourceMetrics.delete(name);
					changed = true;
				}
			}

			const running: Array<{ name: string; pid: number }> = [];
			for (const [name, proc] of this.agentProcesses) {
				if (!proc.running) continue;
				const pid = proc.getPid();
				if (pid == null) continue;
				running.push({ name, pid });
			}

			const byPid =
				running.length > 0
					? await sampleManyAgentProcessResourcesAsync(running.map((r) => r.pid))
					: new Map<number, AgentProcessResources>();

			for (const { name, pid } of running) {
				const next =
					byPid.get(pid)
					?? ({ pid, rssBytes: null, cpuPercent: null, sampledAt: Date.now() } satisfies AgentProcessResources);
				const prev = this.agentResourceMetrics.get(name);
				this.agentResourceMetrics.set(name, next);
				if (
					!prev
					|| prev.pid !== next.pid
					|| prev.rssBytes !== next.rssBytes
					|| prev.cpuPercent !== next.cpuPercent
					|| prev.sampledAt !== next.sampledAt
				) {
					changed = true;
				}
			}

			if (changed) {
				this.dispatchEvent(new Event(AGENT_RESOURCES_CHANGED_EVENT));
			}
		} finally {
			this.agentResourceRefreshInFlight = false;
		}
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

	private cancelAgentThoughtNotifyDebounce(): void {
		if (this.agentThoughtNotifyTimer == null) return;
		clearTimeout(this.agentThoughtNotifyTimer);
		this.agentThoughtNotifyTimer = null;
	}

	pushUserMessage(agentName: string, text: string): void {
		this.cancelAgentThoughtNotifyDebounce();
		const turns = this.conversations.get(agentName) ?? [];
		turns.push({ role: "user", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		this.thinkingAgents.add(agentName);
		this.llmStatus.set(agentName, { state: "thinking", since: Date.now() });
		this.scheduleThinkingWatchdog(agentName);
		this.notify();
	}

	pushAgentResponse(agentName: string, text: string, options?: { readonly llmState?: LlmStatus["state"] }): void {
		this.cancelAgentThoughtNotifyDebounce();
		this.clearThinkingWatchdog(agentName);
		const turns = this.conversations.get(agentName) ?? [];
		// Dedup: skip if the last turn is the same agent message within 5 seconds
		const last = turns.length > 0 ? turns[turns.length - 1] : null;
		if (last && last.role === "agent" && last.text === text && Date.now() - last.timestamp < 5000) return;
		turns.push({ role: "agent", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		this.thinkingAgents.delete(agentName);
		const nextState = options?.llmState ?? "idle";
		this.llmStatus.set(agentName, { state: nextState, since: Date.now() });
		this.notify();
	}

	/** Push an interim agent message without clearing the thinking state. */
	pushAgentThought(agentName: string, text: string): void {
		const turns = this.conversations.get(agentName) ?? [];
		turns.push({ role: "agent", text, timestamp: Date.now() });
		this.conversations.set(agentName, turns);
		if (this.agentThoughtNotifyTimer != null) clearTimeout(this.agentThoughtNotifyTimer);
		this.agentThoughtNotifyTimer = setTimeout(() => {
			this.agentThoughtNotifyTimer = null;
			this.notify();
		}, 96);
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
		if (!this.cliSessionAvailable) return null;

		const existing = this.agentProcesses.get(agentName);
		if (existing?.running) return existing;

		// Clean up old subscription
		const oldUnsub = this.eventUnsubs.get(agentName);
		if (oldUnsub) {
			oldUnsub();
			this.eventUnsubs.delete(agentName);
		}

		let proc: AgentProcess;
		try {
			proc = this.cliExecutor.startAgent(agentName);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.pushEventLog(agentName, "error", msg.slice(0, 80));
			this.pushAgentResponse(agentName, `[offline] ${msg}`, { llmState: "error" });
			return null;
		}
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
		this.notify();
	}

	private handleCliEvent(agentName: string, event: CliEvent): void {
		switch (event.type) {
			case "response": handleCliResponse(this, agentName, event); break;
			case "thinking":
				this.thinkingAgents.add(agentName);
				this.llmStatus.set(agentName, { state: "thinking", since: Date.now() });
				this.scheduleThinkingWatchdog(agentName);
				this.pushEventLog(agentName, "thinking", "Thinking...");
				this.notify();
				break;
			case "permission-request": handleCliPermissionRequest(this, agentName, event); this.notify(); break;
			case "error": {
				const errText = event.text ?? event.response ?? "An error occurred.";
				this.pushAgentResponse(agentName, `[error] ${errText}`);
				this.pushEventLog(agentName, "error", errText);
				break;
			}
			case "using-tool": handleCliUsingTool(this, agentName, event); break;
			case "tool-complete": handleCliToolComplete(this, agentName, event); break;
			case "task-started": this.handleTaskStarted(agentName); break;
			case "done": this.handleDone(agentName); break;
			case "task-completed": break;
		}

		// Dispatch brain-relevant events for engine wiring
		const brainEvents = ["thinking", "using-tool", "idle", "error", "done", "speaking", "queued", "response"];
		if (brainEvents.includes(event.type)) {
			this.dispatchEvent(new CustomEvent("cli-brain-event", {
				detail: { agent: agentName, action: event.type },
			}));
		}
	}

	private handleTaskStarted(agentName: string): void {
		const tasks = this.assignedTasks.get(agentName) ?? [];
		const pending = tasks.find((t) => t.status === "pending");
		if (pending) { this.markTaskStatus(agentName, pending.name, "in-progress"); this.pushEventLog(agentName, "task-started", pending.name); }
	}

	private handleDone(agentName: string): void {
		this.clearThinkingWatchdog(agentName);
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

			// Credit reward via CLI (async — fire and forget, show reward when ready)
			this.creditTaskReward(agentName, activeTask.name);
		}
		this.thinkingAgents.delete(agentName);
		this.llmStatus.set(agentName, { state: "idle", since: Date.now() });
		this.pushEventLog(agentName, "done", "Turn complete");
		this.notify();
	}

	/** Call economy:reward CLI command after task completion. Fire-and-forget. */
	private creditTaskReward(agentName: string, taskName: string): void {
		const nodeBin = findNodeBinary();
		const cliBin = this.vaultBasePath ? join(this.vaultBasePath, ".flowti", "bin", "main.mjs") : null;
		if (!nodeBin || !cliBin || !this.vaultBasePath || !existsSync(cliBin)) return;

		runOneShotCommand(
			nodeBin, cliBin,
			["economy:reward", `--agent=${agentName}`, `--task=${taskName}`, "--format=json"],
			this.vaultBasePath,
		)
			.then((output) => {
				const reward = output as {
					xp?: number; coin?: number; totalXp?: number; totalCoin?: number;
					level?: number; leveledUp?: boolean; newLevel?: number; newTitle?: string;
					trustPromoted?: { agentName: string; op: string; from: string; to: string };
				};
				// Update store with new economy state
				this.setAgentEconomy(agentName, {
					level: reward.level,
					coin: reward.totalCoin,
					xp: reward.totalXp,
					tokens: this.getAgentEconomy(agentName)?.tokens ?? 0,
				});
				// Dispatch reward-specific event for floating economy text (separate from task-completed)
				this.dispatchEvent(new CustomEvent("task-reward-earned", {
					detail: { agentName, task: taskName, xp: reward.xp, coin: reward.coin },
				}));
				// Fire level-up if applicable
				if (reward.leveledUp) {
					this.dispatchEvent(new CustomEvent("level-up", {
						detail: { agentName, level: reward.newLevel, title: reward.newTitle },
					}));
				}
				// Fire trust-promoted if applicable
				if (reward.trustPromoted) {
					this.dispatchEvent(new CustomEvent("trust-promoted", {
						detail: reward.trustPromoted,
					}));
				}
			})
			.catch(() => { /* CLI not available — no reward this time */ });
	}

	async sendMessage(agentName: string, message: string): Promise<{ ok: boolean; error?: string }> {
		this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName } }));

		const contextBlock = this.buildMessageContext(agentName);
		const fullPrompt = contextBlock ? `${contextBlock}\n\n${message}` : message;
		this.pushDebugEntry(agentName, fullPrompt);

		const proc = this.getOrStartProcess(agentName);
		if (!proc) {
			if (!this.cliExecutor) {
				this.pushAgentResponse(agentName, "[offline] CLI executor not available.", { llmState: "error" });
				return { ok: false, error: "CLI executor not available" };
			}
			if (!this.cliSessionAvailable) {
				const hint = this.cliSessionBlockedReason || "CLI host is not ready (Node or Flowti bundle missing).";
				this.pushAgentResponse(agentName, `[offline] ${hint}`, { llmState: "error" });
				return { ok: false, error: "CLI host not ready" };
			}
			this.pushAgentResponse(
				agentName,
				"[offline] Failed to start the agent CLI process. Check Node, the Flowti bundle, and any configured LLM (e.g. Claude) on this machine.",
				{ llmState: "error" },
			);
			return { ok: false, error: "Failed to start agent process" };
		}

		try {
			proc.send(message, contextBlock || undefined);
			if (this.connectionStatus !== "connected") this.setConnectionStatus("connected");
			return { ok: true };
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			this.pushAgentResponse(agentName, `[offline] ${errorMsg}`, { llmState: "error" });
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
			if (!this.cliExecutor) {
				this.pushAgentResponse(agentName, "[offline] Cannot execute task \u2014 CLI executor not available.", { llmState: "error" });
			} else if (!this.cliSessionAvailable) {
				const hint = this.cliSessionBlockedReason || "CLI host is not ready.";
				this.pushAgentResponse(agentName, `[offline] Cannot execute task \u2014 ${hint}`, { llmState: "error" });
			} else {
				this.pushAgentResponse(agentName, "[offline] Cannot execute task \u2014 failed to start agent process.", { llmState: "error" });
			}
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
		if (!this.cliSessionAvailable) {
			return { ok: false, error: this.cliSessionBlockedReason || "CLI host is not ready." };
		}
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
		if (!this.cliExecutor || !this.cliSessionAvailable) return;

		const executor = this.cliExecutor;
		const hadWorldContext = this.worldContext != null;

		/** Defer spawn + vault context build off the interaction/game frame (spawn, serialize, CLI one-shot are janky if synchronous here). */
		const runWakeWork = (): void => {
			if (!this.cliSessionAvailable) return;
			const proc = this.getOrStartProcess(agentName);
			if (proc && hadWorldContext && this.worldContext) {
				const context = this.buildMessageContext(agentName);
				const primer = `${context}\n\nYou have just been summoned by the Director. Acknowledge briefly \u2014 one sentence, in character.`;
				this.pushDebugEntry(agentName, primer, "wake-up");
				proc.send(primer);
			}
			// Do not await: agent:wake one-shot blocks the JS thread; it is not needed for the primer send path.
			void executor.wakeAgent(agentName);
		};

		// Defer past the next paint so CLI spawn + context serialization do not extend the interaction long task.
		afterNextPaint(runWakeWork);
	}
}
