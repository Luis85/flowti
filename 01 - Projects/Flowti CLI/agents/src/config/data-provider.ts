/**
 * DataProvider — pluggable data-sourcing interface for the Agent World game.
 *
 * Implementations of this interface decouple the game from any specific
 * transport layer. The default implementation (`ServerProvider`) connects
 * to the Flowti CLI dev-server via SSE and REST. The `BridgeProvider`
 * implementation bridges an Obsidian plugin's in-memory EventBus, enabling
 * the game to be embedded directly inside the plugin without a network hop.
 *
 * The game's boot sequence calls `start()`, subscribes to updates via the
 * `on*` methods, and calls `stop()` on teardown. All `on*` methods return
 * an unsubscribe function.
 */

import type { AgentAction, DashboardAgent, WorldState, WorldEntity } from "../data/types.js";
import type { ConnectionStatus } from "../data/event-stream.js";

export interface DataProvider {
	/** Load the initial world state snapshot. Returns null if unavailable. */
	getWorldState(): Promise<WorldState | null>;

	/** Load the initial agent roster. */
	getDashboardAgents(): Promise<DashboardAgent[]>;

	/**
	 * Subscribe to agent action events (SSE agent-action or equivalent).
	 * Returns an unsubscribe function.
	 */
	onAction(cb: (action: AgentAction) => void): () => void;

	/**
	 * Subscribe to entity update events (SSE world-state or equivalent).
	 * Returns an unsubscribe function.
	 */
	onEntityUpdate(cb: (entity: WorldEntity) => void): () => void;

	/**
	 * Subscribe to connection status changes.
	 * Returns an unsubscribe function.
	 */
	onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void;

	/**
	 * Send a command to an agent or the runtime.
	 * @param endpoint - The relative endpoint path (e.g. "/api/agent/run").
	 * @param body - The JSON-serialisable request payload.
	 */
	sendCommand(endpoint: string, body: Record<string, unknown>): Promise<void>;

	/** Base URL (or empty string) used to resolve sprite asset paths. */
	readonly assetBasePath: string;

	/** Begin data flow — connect transports, start polling, emit initial state. */
	start(): Promise<void>;

	/** Tear down all connections, timers, and subscriptions. */
	stop(): void;
}
