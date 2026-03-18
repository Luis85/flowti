/**
 * Agent domain bootstrap — creates HttpAgentService, registers view.
 */

import type { IEventBus } from "../infrastructure/events/types";
import type { Plugin, WorkspaceLeaf } from "obsidian";
import { HttpAgentService } from "../infrastructure/agents/http-agent-service";
import { SseClient } from "../infrastructure/agents/sse-client";
import { ObsidianContextProvider } from "../infrastructure/agents/obsidian-context-provider";
import { AgentSidepanelView, type AgentSidepanelDeps } from "../ui/agents/AgentSidepanelView";
import { VIEW_TYPE_AGENT_SIDEBAR } from "../ui/agents/types";

export interface AgentSetupDeps {
	readonly plugin: Plugin;
	readonly eventBus: IEventBus;
	readonly cliServerUrl?: string;
}

export interface AgentSetupResult {
	readonly agentService: HttpAgentService;
	readonly sseClient: SseClient;
	readonly contextProvider: ObsidianContextProvider;
}

export function setupAgentDomain(deps: AgentSetupDeps): AgentSetupResult {
	const baseUrl = deps.cliServerUrl ?? "http://localhost:3000";
	const agentService = new HttpAgentService(baseUrl);
	const sseClient = new SseClient(`${baseUrl}/events`);

	sseClient.on("agent-action", (data) => {
		agentService.handleServerEvent("agent-action", data);
	});

	let connected = false;
	function ensureConnected(): void {
		if (connected) return;
		connected = true;
		void agentService.connect().catch(() => { /* CLI server not running */ });
		sseClient.connect();
	}

	const contextProvider = new ObsidianContextProvider(
		deps.plugin.app.workspace,
		deps.plugin.app.vault,
	);

	const viewDeps: AgentSidepanelDeps = { eventBus: deps.eventBus, agentService, contextProvider };
	try {
		deps.plugin.registerView(VIEW_TYPE_AGENT_SIDEBAR, (leaf: WorkspaceLeaf) => {
			ensureConnected();
			return new AgentSidepanelView(leaf, viewDeps);
		});
	} catch (err) {
		if (err instanceof Error && !err.message.includes("existing view type")) throw err;
	}

	deps.plugin.addCommand({
		id: "open-agent-panel",
		name: "Open Agent Panel",
		callback: () => {
			const leaf = deps.plugin.app.workspace.getRightLeaf(false);
			if (leaf) void leaf.setViewState({ type: VIEW_TYPE_AGENT_SIDEBAR, active: true });
		},
	});

	return { agentService, sseClient, contextProvider };
}
