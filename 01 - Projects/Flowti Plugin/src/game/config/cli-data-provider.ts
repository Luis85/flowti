/**
 * CLI-backed DataProvider — **Flowti CLI / vault JSON is authoritative** for roster
 * and world entities. The plugin displays that state inside Excalibur; it does not
 * run a separate API server for the game.
 *
 * Reads vault files directly; agent tasks / Talk use {@link ICliExecutor} (JSONL
 * subprocesses). No server process required for the Agent World canvas.
 *
 * File paths:
 *   Agent roster:  <vault>/.flowti/agents/data/agent-dashboard.json
 *   World state:   <vault>/.flowti/var/world-state.json
 *   CLI binary:    <vault>/.flowti/bin/main.mjs
 *
 * If `agent-dashboard.json` is missing or has an empty `agents` array, the
 * provider falls back to: (1) agent entities in `world-state.json`, (2) markdown
 * definitions under `03 - Resources/Agents` (`type: Agent` frontmatter), (3) CLI
 * `listAgents()`.
 *
 * The roster file is **watched** so Agent World updates when `agent:dashboard-sync`
 * runs (e.g. from the agent sidepanel).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DataProvider } from "./data-provider.js";
import type { DashboardAgent, WorldState, WorldEntity, AgentAction, ConnectionStatus } from "../data/types.js";
import type { ICliExecutor } from "../../infrastructure/agents/cli-executor.js";
import { findNodeBinary } from "../../infrastructure/agents/cli-executor.js";
import { watchJsonFile, type FileWatcher } from "../../infrastructure/agents/file-watcher.js";
import { dashboardAgentsFromWorldState } from "./world-state-agents.js";
import {
	dashboardAgentsFromAgentsMarkdownDir,
	DEFAULT_AGENTS_MARKDOWN_DIR,
} from "./agent-markdown-roster.js";

const AGENT_ROSTER_SUBPATH = ".flowti/agents/data/agent-dashboard.json";
const WORLD_STATE_SUBPATH = ".flowti/var/world-state.json";
const CLI_BINARY_SUBPATH = ".flowti/bin/main.mjs";

export function createCliDataProvider(
	vaultBasePath: string,
	cliExecutor?: ICliExecutor,
): DataProvider {
	let agents: DashboardAgent[] = [];
	let worldState: WorldState | null = null;

	const actionCallbacks = new Set<(action: AgentAction) => void>();
	const entityCallbacks = new Set<(entity: WorldEntity) => void>();
	const connectionCallbacks = new Set<(status: ConnectionStatus) => void>();
	const rosterCallbacks = new Set<(agents: readonly DashboardAgent[]) => void>();

	const watchers: FileWatcher[] = [];

	const rosterPath = join(vaultBasePath, AGENT_ROSTER_SUBPATH);
	const worldStatePath = join(vaultBasePath, WORLD_STATE_SUBPATH);
	const cliBinPath = join(vaultBasePath, CLI_BINARY_SUBPATH);

	function applyRosterFallbacksFromSyncSources(): void {
		if (agents.length === 0) {
			agents = dashboardAgentsFromWorldState(worldState);
		}
		if (agents.length === 0) {
			agents = dashboardAgentsFromAgentsMarkdownDir(vaultBasePath, DEFAULT_AGENTS_MARKDOWN_DIR);
		}
	}

	function notifyRosterSubscribers(): void {
		const snapshot = [...agents];
		for (const cb of rosterCallbacks) {
			try { cb(snapshot); } catch { /* subscriber error */ }
		}
	}

	async function loadAgentsFull(): Promise<void> {
		try {
			if (existsSync(rosterPath)) {
				const raw = readFileSync(rosterPath, "utf-8");
				const data = JSON.parse(raw) as { agents?: DashboardAgent[] };
				agents = Array.isArray(data.agents) ? data.agents : [];
			} else {
				agents = [];
			}
		} catch {
			agents = [];
		}

		applyRosterFallbacksFromSyncSources();

		if (agents.length === 0 && cliExecutor) {
			try {
				const listed = await cliExecutor.listAgents();
				agents = listed
					.filter((a) => a.name.length > 0)
					.map((a) => {
						const st = a.status.toLowerCase();
						const rowStatus: DashboardAgent["status"] =
							st === "busy" || st === "working" ? "busy"
								: st === "unassigned" ? "unassigned"
									: "idle";
						return {
							name: a.name,
							agentType: "ai",
							domain: a.domain,
							status: rowStatus,
						} satisfies DashboardAgent;
					});
			} catch {
				/* CLI unavailable — leave [] */
			}
		}
	}

	function applyRosterFromWatchPayload(data: { agents?: DashboardAgent[] }): void {
		const incoming = Array.isArray(data.agents) ? data.agents : [];
		const economyMap = new Map(agents.map(a => [a.name, {
			level: a.level, coin: a.coin, tokens: a.tokens,
			xp: a.xp, trustTier: a.trustTier, capabilities: a.capabilities,
		}]));
		agents = incoming.map(a => {
			const eco = economyMap.get(a.name);
			if (!eco) return a;
			return {
				...a,
				level: a.level ?? eco.level,
				coin: a.coin ?? eco.coin,
				tokens: a.tokens ?? eco.tokens,
				xp: a.xp ?? eco.xp,
				trustTier: a.trustTier ?? eco.trustTier,
				capabilities: a.capabilities ?? eco.capabilities,
			};
		});
		applyRosterFallbacksFromSyncSources();
		notifyRosterSubscribers();
	}

	return {
		async start(): Promise<void> {
			try {
				if (existsSync(worldStatePath)) {
					const raw = readFileSync(worldStatePath, "utf-8");
					worldState = JSON.parse(raw) as WorldState;
				}
			} catch {
				worldState = null;
			}

			await loadAgentsFull();

			const worldStateWatcher = watchJsonFile<WorldState>(
				worldStatePath,
				(updated) => {
					worldState = updated;
					for (const entity of Object.values(updated.entities)) {
						for (const cb of entityCallbacks) {
							try { cb(entity); } catch { /* subscriber error */ }
						}
					}
				},
			);
			watchers.push(worldStateWatcher);

			const rosterWatcher = watchJsonFile<{ agents?: DashboardAgent[] }>(
				rosterPath,
				(data) => { applyRosterFromWatchPayload(data); },
			);
			watchers.push(rosterWatcher);

			const nodeOk = findNodeBinary() !== null;
			const isConnected = nodeOk && existsSync(cliBinPath);
			const status: ConnectionStatus = isConnected ? "connected" : "disconnected";
			setTimeout(() => {
				for (const cb of connectionCallbacks) {
					try { cb(status); } catch { /* subscriber error */ }
				}
			}, 0);
		},

		stop(): void {
			for (const watcher of watchers) {
				watcher.close();
			}
			watchers.length = 0;
		},

		async getWorldState(): Promise<WorldState | null> {
			return worldState;
		},

		async getDashboardAgents(): Promise<DashboardAgent[]> {
			return agents;
		},

		async reloadDashboardAgents(): Promise<DashboardAgent[]> {
			await loadAgentsFull();
			notifyRosterSubscribers();
			return agents;
		},

		onAction(cb: (action: AgentAction) => void): () => void {
			actionCallbacks.add(cb);
			return () => { actionCallbacks.delete(cb); };
		},

		onEntityUpdate(cb: (entity: WorldEntity) => void): () => void {
			entityCallbacks.add(cb);
			return () => { entityCallbacks.delete(cb); };
		},

		onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void {
			connectionCallbacks.add(cb);
			return () => { connectionCallbacks.delete(cb); };
		},

		onDashboardAgentsChange(cb: (next: readonly DashboardAgent[]) => void): () => void {
			rosterCallbacks.add(cb);
			return () => { rosterCallbacks.delete(cb); };
		},

		get assetBasePath(): string {
			return "";
		},
	};
}
