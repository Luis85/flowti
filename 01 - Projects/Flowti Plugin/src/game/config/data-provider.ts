/**
 * DataProvider — pluggable data-sourcing interface for the Agent World (Excalibur).
 *
 * **Production (Flowti Obsidian plugin):** use {@link createCliDataProvider} in
 * `cli-data-provider.ts`. The **Flowti CLI is data authority**: roster and world
 * snapshots live under `<vault>/.flowti/` as JSON; the plugin reads the vault via
 * `fs` and watches `world-state.json`. Agent tasks and chat go through
 * {@link ICliExecutor} (child `node .flowti/bin/main.mjs …` + JSONL) — **no**
 * in-game HTTP server or SSE requirement.
 *
 * Other implementations may exist for tests or tooling; they must honor the same
 * contract: `start()` → subscribe via `on*` → `stop()`. Each `on*` returns unsubscribe.
 *
 * @see docs/agent-world-architecture.md
 */

import type { AgentAction, DashboardAgent, WorldState, WorldEntity, ConnectionStatus } from "../data/types.js";

export interface DataProvider {
	/** Load the initial world state snapshot. Returns null if unavailable. */
	getWorldState(): Promise<WorldState | null>;

	/** Load the initial agent roster. */
	getDashboardAgents(): Promise<DashboardAgent[]>;

	/** Re-read roster from disk (dashboard JSON + fallbacks) and notify roster subscribers. */
	reloadDashboardAgents(): Promise<DashboardAgent[]>;

	/**
	 * Subscribe to agent action events (e.g. from CLI-written world state or in-proc bridges).
	 * Returns an unsubscribe function.
	 */
	onAction(cb: (action: AgentAction) => void): () => void;

	/**
	 * Subscribe to entity updates (e.g. watched `world-state.json` or equivalent).
	 * Returns an unsubscribe function.
	 */
	onEntityUpdate(cb: (entity: WorldEntity) => void): () => void;

	/**
	 * Subscribe to connection status changes.
	 * Returns an unsubscribe function.
	 */
	onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void;

	/**
	 * Subscribe to agent roster changes (e.g. `.flowti/agents/data/agent-dashboard.json` updated).
	 * Returns an unsubscribe function.
	 */
	onDashboardAgentsChange(cb: (agents: readonly DashboardAgent[]) => void): () => void;

	/** Base URL (or empty string) used to resolve sprite asset paths. */
	readonly assetBasePath: string;

	/** Begin data flow — connect transports, start polling, emit initial state. */
	start(): Promise<void>;

	/** Tear down all connections, timers, and subscriptions. */
	stop(): void;
}
