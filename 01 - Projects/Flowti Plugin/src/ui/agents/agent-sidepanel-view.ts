/**
 * Obsidian ItemView shell for the Agent Sidepanel.
 * Mounts the root <flowti-agent-sidepanel> Lit component.
 * Handler wires data and events.
 */

import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types.js";
import type { ICliExecutor } from "../../infrastructure/agents/cli-executor.js";
import type { IContextProvider } from "../../domain/agents/context-provider.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import { VIEW_TYPE_AGENT_SIDEBAR } from "./types.js";

export interface AgentSidepanelDeps {
	readonly eventBus: IEventBus;
	readonly cliExecutor?: ICliExecutor;
	readonly contextProvider?: IContextProvider;
	readonly worldContext?: WorldContext;
}

export class AgentSidepanelView extends ItemView {
	private deps: AgentSidepanelDeps;
	private dispose: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, deps: AgentSidepanelDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENT_SIDEBAR;
	}

	getDisplayText(): string {
		return "Agent panel";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("ft-agent-sidebar");
		this.contentEl.empty();

		const { mountAgentSidepanel } = await import("../../infrastructure/handlers/agent-handlers.js");
		this.dispose = mountAgentSidepanel(this.contentEl, this.deps);
	}

	async onClose(): Promise<void> {
		if (this.dispose) {
			this.dispose();
			this.dispose = null;
		}
	}
}
