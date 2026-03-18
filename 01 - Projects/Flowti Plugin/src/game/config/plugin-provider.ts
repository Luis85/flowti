import type { DataProvider } from "./data-provider.js";
import type { AgentAction, DashboardAgent, WorldState, WorldEntity, ConnectionStatus } from "../data/types.js";

const AGENT_ROSTER_PATH = ".flowti/agents/data/agent-dashboard.json";
const WORLD_STATE_PATH = ".flowti/var/world-state.json";

const RELAYED_EVENTS = [
	"agent.status.changed",
	"agent.message.received",
	"agent.message.sent",
] as const;

export interface PluginProviderDeps {
	readonly vaultAdapter: {
		exists(path: string): Promise<boolean>;
		read(path: string): Promise<string>;
	};
	readonly eventBus: {
		on(type: string, cb: (event: { type: string; payload: unknown }) => void): () => void;
		emit?(type: string, payload: unknown): void;
	};
	readonly sseClient?: {
		connect(): void;
		disconnect(): void;
		on(event: string, cb: (data: unknown) => void): () => void;
	};
	readonly serverBaseUrl?: string;
}

export function createPluginProvider(deps: PluginProviderDeps): DataProvider {
	let agents: DashboardAgent[] = [];
	let worldState: WorldState | null = null;
	const actionCallbacks = new Set<(action: AgentAction) => void>();
	const entityCallbacks = new Set<(entity: WorldEntity) => void>();
	const connectionCallbacks = new Set<(status: ConnectionStatus) => void>();
	const unsubs: Array<() => void> = [];

	return {
		async start(): Promise<void> {
			try {
				const rosterExists = await deps.vaultAdapter.exists(AGENT_ROSTER_PATH);
				if (rosterExists) {
					const raw = await deps.vaultAdapter.read(AGENT_ROSTER_PATH);
					const data = JSON.parse(raw) as { agents?: DashboardAgent[] };
					agents = data.agents ?? [];
				}
			} catch { agents = []; }

			try {
				const stateExists = await deps.vaultAdapter.exists(WORLD_STATE_PATH);
				if (stateExists) {
					const raw = await deps.vaultAdapter.read(WORLD_STATE_PATH);
					worldState = JSON.parse(raw) as WorldState;
				}
			} catch { worldState = null; }

			for (const eventType of RELAYED_EVENTS) {
				const unsub = deps.eventBus.on(eventType, (event) => {
					const action = event.payload as AgentAction;
					for (const cb of actionCallbacks) cb(action);
				});
				unsubs.push(unsub);
			}

			if (deps.sseClient) {
				try {
					deps.sseClient.connect();
					unsubs.push(deps.sseClient.on("agent-action", (data) => {
						for (const cb of actionCallbacks) cb(data as AgentAction);
					}));
					unsubs.push(deps.sseClient.on("entity-update", (data) => {
						for (const cb of entityCallbacks) cb(data as WorldEntity);
					}));
					for (const cb of connectionCallbacks) cb("connected");
				} catch { /* SSE not available */ }
			}
		},

		stop(): void {
			for (const unsub of unsubs) unsub();
			unsubs.length = 0;
			deps.sseClient?.disconnect();
		},

		async getWorldState(): Promise<WorldState | null> { return worldState; },
		async getDashboardAgents(): Promise<DashboardAgent[]> { return agents; },

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

		async sendCommand(endpoint: string, body: Record<string, unknown>): Promise<void> {
			if (deps.serverBaseUrl) {
				await fetch(`${deps.serverBaseUrl}${endpoint}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
			} else if (deps.eventBus.emit) {
				deps.eventBus.emit("world.command", { endpoint, body });
			}
		},

		get assetBasePath(): string { return ""; },
	};
}
