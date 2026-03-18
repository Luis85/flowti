/**
 * ServerProvider — DataProvider implementation for browser (standalone) mode.
 *
 * Wraps SyncSystem (SSE + polling) and adapts its callback-based API to the
 * Set-based subscription pattern required by DataProvider.
 */

import type { DataProvider } from "./data-provider.js";
import type { AgentAction, DashboardAgent, WorldEntity } from "../data/types.js";
import type { ConnectionStatus } from "../data/event-stream.js";
import { SyncSystem } from "../systems/sync-system.js";
import { fetchWorldState } from "../data/api-client.js";

// ── ServerProvider ────────────────────────────────────────────────────

class ServerProvider implements DataProvider {
	readonly assetBasePath: string;

	private readonly baseUrl: string;
	private readonly syncSystem: SyncSystem;

	private readonly actionCallbacks = new Set<(action: AgentAction) => void>();
	private readonly entityUpdateCallbacks = new Set<(entity: WorldEntity) => void>();
	private readonly connectionStatusCallbacks = new Set<(status: ConnectionStatus) => void>();

	private dashboardAgents: DashboardAgent[] = [];

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
		this.assetBasePath = baseUrl ? baseUrl + "/" : "";

		this.syncSystem = new SyncSystem(baseUrl, {
			onAgentAction: (action) => {
				for (const cb of this.actionCallbacks) cb(action);
			},
			onAgentsUpdated: (agents) => {
				this.dashboardAgents = [...agents];
			},
			onActivityLog: (_log) => {
				// Activity log updates are consumed by SyncSystem internally;
				// DataProvider does not surface this event directly.
			},
			onConnectionStatus: (status) => {
				for (const cb of this.connectionStatusCallbacks) cb(status);
			},
			onStateDiff: (diff) => {
				const store = this.syncSystem.getStateStore();
				for (const id of [...diff.added, ...diff.changed]) {
					const entity = store.getEntity(id);
					if (entity) {
						for (const cb of this.entityUpdateCallbacks) cb(entity);
					}
				}
			},
		});
	}

	async start(): Promise<void> {
		const agents = await this.syncSystem.start();
		this.dashboardAgents = [...agents];
	}

	stop(): void {
		this.syncSystem.stop();
	}

	async getWorldState() {
		return fetchWorldState(this.baseUrl);
	}

	async getDashboardAgents(): Promise<DashboardAgent[]> {
		return this.dashboardAgents;
	}

	onAction(cb: (action: AgentAction) => void): () => void {
		this.actionCallbacks.add(cb);
		return () => { this.actionCallbacks.delete(cb); };
	}

	onEntityUpdate(cb: (entity: WorldEntity) => void): () => void {
		this.entityUpdateCallbacks.add(cb);
		return () => { this.entityUpdateCallbacks.delete(cb); };
	}

	onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void {
		this.connectionStatusCallbacks.add(cb);
		return () => { this.connectionStatusCallbacks.delete(cb); };
	}

	async sendCommand(endpoint: string, body: Record<string, unknown>): Promise<void> {
		await fetch(`${this.baseUrl}${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}
}

// ── Factory ───────────────────────────────────────────────────────────

export function createServerProvider(baseUrl: string): DataProvider {
	return new ServerProvider(baseUrl);
}
