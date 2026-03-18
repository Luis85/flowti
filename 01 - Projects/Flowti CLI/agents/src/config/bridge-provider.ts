/**
 * BridgeProvider — adapts `window.__flowtiWorldBridge` to the DataProvider interface.
 *
 * When the Agent World game is embedded inside the Obsidian Flowti Plugin, the
 * plugin sets `window.__flowtiWorldBridge` before mounting the game. This provider
 * wraps that bridge so the game can use it transparently via the DataProvider
 * contract, with no network hops or SSE connections required.
 */

import type { DataProvider } from "./data-provider.js";
import type { AgentAction, DashboardAgent, WorldEntity, WorldState } from "../data/types.js";
import type { ConnectionStatus } from "../data/event-stream.js";

export interface WorldBridge {
	readonly containerElement: HTMLElement;
	getWorldState(): Promise<WorldState>;
	onAction(cb: (action: AgentAction) => void): () => void;
	onEntityUpdate(cb: (entity: WorldEntity) => void): () => void;
	sendCommand(endpoint: string, body: unknown): Promise<void>;
	readonly assetBasePath: string;
	readonly serverOnline: boolean;
	dispose(): void;
}

export function createBridgeProvider(bridge: WorldBridge): DataProvider {
	return {
		async getWorldState(): Promise<WorldState | null> {
			return bridge.getWorldState();
		},

		async getDashboardAgents(): Promise<DashboardAgent[]> {
			const state = await bridge.getWorldState();
			if (!state) return [];
			return Object.values(state.entities)
				.filter((entity): entity is WorldEntity => entity.type === "agent")
				.map((entity) => entity.components as unknown as DashboardAgent);
		},

		onAction(cb: (action: AgentAction) => void): () => void {
			return bridge.onAction(cb);
		},

		onEntityUpdate(cb: (entity: WorldEntity) => void): () => void {
			return bridge.onEntityUpdate(cb);
		},

		onConnectionStatus(_cb: (status: ConnectionStatus) => void): () => void {
			// The bridge manages its own connection lifecycle internally.
			// No external subscription is needed; return a no-op unsubscribe.
			return () => { /* no-op */ };
		},

		async sendCommand(endpoint: string, body: Record<string, unknown>): Promise<void> {
			return bridge.sendCommand(endpoint, body);
		},

		get assetBasePath(): string {
			return bridge.assetBasePath;
		},

		async start(): Promise<void> {
			// The bridge is already initialised by the Plugin before this provider
			// is constructed. Nothing to do.
		},

		stop(): void {
			bridge.dispose();
		},
	};
}
