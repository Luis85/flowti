/**
 * sync-system.ts — Orchestrates data layer: SSE events, polling, and agent lifecycle.
 *
 * Connects EventStream to /events, polls /api/world-state every 30s,
 * and loads agent-dashboard.json on boot for the initial roster.
 */

import type { AgentAction, DashboardAgent, DashboardData, WorldState, ActivityEntry } from "../data/types.js";
import { createEventStream, type ConnectionStatus } from "../data/event-stream.js";
import { fetchWorldState } from "../data/api-client.js";
import { createStateStore, type StateStore } from "../data/state-store.js";

// ── Constants ────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const DASHBOARD_URL = "data/agent-dashboard.json";

// ── Callbacks ────────────────────────────────────────────────────────

export interface SyncCallbacks {
	readonly onAgentAction: (action: AgentAction) => void;
	readonly onAgentsUpdated: (agents: readonly DashboardAgent[]) => void;
	readonly onActivityLog: (log: readonly ActivityEntry[]) => void;
	readonly onConnectionStatus: (status: ConnectionStatus) => void;
	readonly onStateDiff: (diff: { added: string[]; removed: string[]; changed: string[] }) => void;
}

// ── SyncSystem ───────────────────────────────────────────────────────

export class SyncSystem {
	private readonly baseUrl: string;
	private readonly callbacks: SyncCallbacks;
	private readonly stateStore: StateStore;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private eventStreamHandle: { close: () => void } | null = null;
	private dashboardAgents: DashboardAgent[] = [];

	constructor(baseUrl: string, callbacks: SyncCallbacks) {
		this.baseUrl = baseUrl;
		this.callbacks = callbacks;
		this.stateStore = createStateStore();
	}

	/** Load dashboard data and start connections. */
	async start(): Promise<readonly DashboardAgent[]> {
		// Load initial dashboard roster
		this.dashboardAgents = await this.loadDashboard();
		this.callbacks.onAgentsUpdated(this.dashboardAgents);

		// Start SSE event stream
		this.eventStreamHandle = createEventStream(
			`${this.baseUrl}/events`,
			(action) => this.handleAction(action),
			(state) => this.handleWorldState(state),
			(status) => this.callbacks.onConnectionStatus(status),
		);

		// Start polling
		this.pollTimer = setInterval(() => {
			void this.poll();
		}, POLL_INTERVAL_MS);

		// Initial poll
		await this.poll();

		return this.dashboardAgents;
	}

	/** Stop all connections and timers. */
	stop(): void {
		if (this.eventStreamHandle) {
			this.eventStreamHandle.close();
			this.eventStreamHandle = null;
		}
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	/** Get the current dashboard agents. */
	getAgents(): readonly DashboardAgent[] {
		return this.dashboardAgents;
	}

	/** Get the state store for direct access. */
	getStateStore(): StateStore {
		return this.stateStore;
	}

	private handleAction(action: AgentAction): void {
		this.callbacks.onAgentAction(action);
	}

	private handleWorldState(state: WorldState): void {
		const diff = this.stateStore.applyState(state);
		this.callbacks.onStateDiff(diff);

		if (state.activityLog) {
			this.callbacks.onActivityLog(state.activityLog);
		}
	}

	private async poll(): Promise<void> {
		const state = await fetchWorldState(this.baseUrl);
		if (state) {
			this.handleWorldState(state);
		}
	}

	private async loadDashboard(): Promise<DashboardAgent[]> {
		try {
			const res = await fetch(DASHBOARD_URL);
			if (!res.ok) return [];
			const data = await res.json() as DashboardData;
			return [...data.agents];
		} catch {
			return [];
		}
	}
}
