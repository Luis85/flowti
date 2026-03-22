/**
 * Agent domain bootstrap — creates CliExecutor, registers views.
 *
 * **CLI is data authority** for agents; the plugin reads vault `.flowti` JSON and
 * displays it in Excalibur (Agent World). See `docs/agent-world-architecture.md`.
 *
 * - No HTTP game server — agents run as CLI child processes
 * - CliExecutor spawns `node .flowti/bin/main.mjs agent:start` per agent
 * - JSONL over stdin/stdout + `.flowti/var/agents/*.events.jsonl`
 * - Views registered early (Obsidian restores layout from saved leaf types)
 */

import type { IEventBus } from "../infrastructure/events/types.js";
import type { App, Plugin, WorkspaceLeaf } from "obsidian";
import type { FlowtiSettings } from "../domain/settings/settings.js";
import { CliExecutor } from "../infrastructure/agents/cli-executor.js";
import { ObsidianContextProvider } from "../infrastructure/agents/obsidian-context-provider.js";
import { AgentSidepanelView, type AgentSidepanelDeps } from "../ui/agents/agent-sidepanel-view.js";
import { AgentWorldView, type AgentWorldViewDeps } from "../ui/agents/agent-world-view.js";
import { VIEW_TYPE_AGENT_SIDEBAR, VIEW_TYPE_AGENT_WORLD } from "../ui/agents/types.js";
import { WorldContext } from "../domain/agents/world-context.js";
import type { ICliExecutor } from "../infrastructure/agents/cli-executor.js";
import type { IAgentWorldPerfDashboard } from "../infrastructure/services/perfTypes.js";

export interface AgentSetupDeps {
	readonly plugin: Plugin;
	readonly app: App;
	readonly eventBus: IEventBus;
	readonly getSettings: () => FlowtiSettings;
}

export interface AgentSetupResult {
	readonly cliExecutor: ICliExecutor;
	readonly contextProvider: ObsidianContextProvider;
	readonly worldContext: WorldContext;
}

export function setupAgentDomain(deps: AgentSetupDeps): AgentSetupResult {
	const vaultBasePath = (deps.app.vault.adapter as unknown as { basePath: string }).basePath;
	const cliExecutor = new CliExecutor(vaultBasePath);

	const contextProvider = new ObsidianContextProvider(
		deps.plugin.app.workspace,
		deps.plugin.app.vault,
	);

	const worldContext = new WorldContext({
		contextProvider,
		workspace: deps.app.workspace as unknown as import("../domain/agents/world-context.js").WorkspaceDep,
		vaultAdapter: deps.app.vault.adapter as { exists(p: string): Promise<boolean>; read(p: string): Promise<string> },
		eventBus: deps.eventBus,
		vaultBasePath,
	});

	const vaultAdapter = deps.app.vault.adapter as unknown as {
		list(path: string): Promise<{ files: string[]; folders: string[] }>;
		read(path: string): Promise<string>;
	};

	const viewDeps: AgentSidepanelDeps = {
		eventBus: deps.eventBus,
		cliExecutor,
		contextProvider,
		worldContext,
		vaultAdapter,
		agentsDir: "03 - Resources/Agents",
		vaultBasePath,
		app: deps.app,
		getSettings: deps.getSettings,
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
		worldContext,
		cliExecutor,
		/** Lazy — PerfAggregator is created in plugin `onLayoutReady`, after this view is registered. */
		getPerfDashboard: () => {
			const p = deps.plugin as { getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined };
			return p.getPerfDashboard?.();
		},
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

	return { cliExecutor, contextProvider, worldContext };
}
