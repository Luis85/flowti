/**
 * Agent domain bootstrap — creates HttpAgentService, registers view.
 *
 * Connection strategy:
 * - View is registered immediately (so Obsidian can restore it from layout)
 * - Server connection deferred to onLayoutReady (silent, non-blocking)
 * - If the server isn't running, gives up quietly — no console spam
 * - If a connection succeeds then drops, SSE client auto-reconnects
 * - "Restart the world" spawns `flowti serve` and waits for healthy
 */

import type { IEventBus } from "../infrastructure/events/types.js";
import type { App, Plugin, WorkspaceLeaf } from "obsidian";
import { HttpAgentService } from "../infrastructure/agents/http-agent-service.js";
import { SseClient } from "../infrastructure/agents/sse-client.js";
import { ObsidianContextProvider } from "../infrastructure/agents/obsidian-context-provider.js";
import { launchCliServer, getServerStatus, killServer, clearServerRegistry, writeServerRegistryForExisting } from "../infrastructure/agents/server-launcher.js";
import { AgentSidepanelView, type AgentSidepanelDeps } from "../ui/agents/agent-sidepanel-view.js";
import { AgentWorldView, type AgentWorldViewDeps } from "../ui/agents/agent-world-view.js";
import { VIEW_TYPE_AGENT_SIDEBAR, VIEW_TYPE_AGENT_WORLD } from "../ui/agents/types.js";

export interface AgentSetupDeps {
	readonly plugin: Plugin;
	readonly app: App;
	readonly eventBus: IEventBus;
	readonly cliServerUrl?: string;
}

export interface AgentSetupResult {
	readonly agentService: HttpAgentService;
	readonly sseClient: SseClient;
	readonly contextProvider: ObsidianContextProvider;
	/** Call once layout is ready to attempt server connection silently. */
	readonly connectWhenReady: () => void;
}

export function setupAgentDomain(deps: AgentSetupDeps): AgentSetupResult {
	const baseUrl = deps.cliServerUrl ?? "http://localhost:3000";
	const agentService = new HttpAgentService(baseUrl);
	const sseClient = new SseClient(`${baseUrl}/events`);

	sseClient.on("agent-action", (data) => {
		agentService.handleServerEvent("agent-action", data);
	});

	const contextProvider = new ObsidianContextProvider(
		deps.plugin.app.workspace,
		deps.plugin.app.vault,
	);

	const vaultPath = (deps.app.vault.adapter as unknown as { basePath: string }).basePath;

	const viewDeps: AgentSidepanelDeps = {
		eventBus: deps.eventBus,
		agentService,
		contextProvider,
		startServer: async () => {
			const result = await launchCliServer(vaultPath, baseUrl);
			if (result.ok) {
				await agentService.connect();
				sseClient.connect();
			}
			return result;
		},
		getServerStatus: () => getServerStatus(vaultPath),
		stopServer: (pid: number) => {
			killServer(pid);
			clearServerRegistry(vaultPath);
			sseClient.disconnect();
			agentService.disconnect();
		},
		openInBrowser: () => {
			const existing = deps.plugin.app.workspace.getLeavesOfType("flowti-agent-world");
			if (existing.length > 0) {
				void deps.plugin.app.workspace.revealLeaf(existing[0]);
			} else {
				const leaf = deps.plugin.app.workspace.getLeaf(true);
				void leaf.setViewState({ type: "flowti-agent-world", active: true });
			}
		},
	};

	// Register view immediately — Obsidian needs the factory to restore layout
	try {
		deps.plugin.registerView(VIEW_TYPE_AGENT_SIDEBAR, (leaf: WorkspaceLeaf) => {
			return new AgentSidepanelView(leaf, viewDeps);
		});
	} catch (err) {
		if (err instanceof Error && !err.message.includes("existing view type")) throw err;
	}

	deps.plugin.addCommand({
		id: "open-agent-panel",
		name: "Open agent panel",
		callback: () => {
			void deps.plugin.app.workspace.getRightLeaf(false)
				?.setViewState({ type: VIEW_TYPE_AGENT_SIDEBAR, active: true });
		},
	});

	// Register world view immediately — Obsidian needs the factory to restore layout
	const worldDeps: AgentWorldViewDeps = {
		plugin: deps.plugin,
		eventBus: deps.eventBus,
		sseClient,
		serverBaseUrl: baseUrl,
		contextProvider,
	};
	try {
		deps.plugin.registerView(VIEW_TYPE_AGENT_WORLD, (leaf: WorkspaceLeaf) =>
			new AgentWorldView(leaf, worldDeps),
		);
	} catch (err) {
		if (err instanceof Error && !err.message.includes("existing view type")) throw err;
	}

	deps.plugin.addCommand({
		id: "open-agent-world",
		name: "Open agent world",
		callback: () => {
			const existing = deps.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_WORLD);
			if (existing.length > 0) {
				void deps.app.workspace.revealLeaf(existing[0]);
			} else {
				const leaf = deps.app.workspace.getLeaf(true);
				void leaf.setViewState({ type: VIEW_TYPE_AGENT_WORLD, active: true });
			}
		},
	});

	// Deferred connection — called from onLayoutReady, never from view factory
	// When SSE loses connection permanently, reset to offline state
	sseClient.onDisconnect(() => {
		agentService.disconnect();
		clearServerRegistry(vaultPath);
		connected = false;
	});

	let connected = false;
	function connectWhenReady(): void {
		if (connected) return;
		connected = true;
		void agentService.connect()
			.then(() => {
				sseClient.connect();
				// If server is running but no registry (started externally), create one
				if (!getServerStatus(vaultPath).entry) {
					writeServerRegistryForExisting(vaultPath, baseUrl);
				}
			})
			.catch(() => { /* server not running — silent */ });
	}

	return { agentService, sseClient, contextProvider, connectWhenReady };
}
