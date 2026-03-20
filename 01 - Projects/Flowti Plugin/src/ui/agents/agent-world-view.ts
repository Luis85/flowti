/**
 * Obsidian ItemView shell for the embedded Agent World (ExcaliburJS game).
 *
 * Lifecycle:
 *  1. onOpen  — creates engine via createAgentWorld(), starts game
 *  2. visible — engine runs
 *  3. hidden  — engine paused via IntersectionObserver
 *  4. onClose — full teardown (engine handle, observer)
 */

import { ItemView } from "obsidian";
import type { WorkspaceLeaf, Plugin } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { ICliExecutor } from "../../infrastructure/agents/cli-executor.js";
import { createAgentWorld, type AgentWorldHandle } from "../../game/engine.js";
import { createCliDataProvider } from "../../game/config/cli-data-provider.js";
import { VIEW_TYPE_AGENT_WORLD } from "./types.js";

export interface AgentWorldViewDeps {
	readonly plugin: Plugin;
	readonly eventBus: IEventBus;
	readonly worldContext?: WorldContext;
	readonly cliExecutor?: ICliExecutor;
}

export class AgentWorldView extends ItemView {
	private deps: AgentWorldViewDeps;
	private handle: AgentWorldHandle | null = null;
	private observer: IntersectionObserver | null = null;

	constructor(leaf: WorkspaceLeaf, deps: AgentWorldViewDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string { return VIEW_TYPE_AGENT_WORLD; }
	getDisplayText(): string { return "Agent world"; }
	getIcon(): string { return "globe"; }

	async onOpen(): Promise<void> {
		this.contentEl.empty();

		const container = this.contentEl.createDiv({ cls: "ft-world-container" });
		container.id = "flowti-world";

		// Resolve sprite base path via plugin manifest — points to plugin root.
		// getResourcePath() appends a cache-busting query string (?timestamp)
		// which breaks path concatenation, so we strip it.
		const pluginDir = this.app.vault.configDir + "/plugins/" + this.deps.plugin.manifest.id;
		const adapter = this.app.vault.adapter as { getResourcePath?(p: string): string };
		let spriteBasePath: string;
		if (adapter.getResourcePath) {
			const raw = adapter.getResourcePath(pluginDir);
			spriteBasePath = raw.split("?")[0];
		} else {
			spriteBasePath = pluginDir;
		}

		// Create CLI-backed data provider — reads vault files directly, no server needed
		const vaultBasePath = (this.app.vault.adapter as unknown as { basePath: string }).basePath;
		const provider = createCliDataProvider(vaultBasePath, this.deps.cliExecutor);

		// Listen for vault path clicks from game UI components
		container.addEventListener("open-vault-path", ((e: CustomEvent) => {
			const path = String(e.detail?.path ?? "");
			if (path) void this.app.workspace.openLinkText(path, "", false);
		}) as EventListener);

		// Create game
		this.handle = createAgentWorld({
			container,
			provider,
			spriteBasePath,
			cliExecutor: this.deps.cliExecutor,
			worldContext: this.deps.worldContext,
			vaultBasePath,
		});

		try {
			await this.handle.start();
		} catch {
			container.createDiv({
				cls: "ft-world-error",
				text: "Failed to start agent world.",
			});
		}

		// Visibility observer
		this.observer = new IntersectionObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			if (entry.isIntersecting) {
				this.handle?.resume();
			} else {
				this.handle?.pause();
			}
		});
		this.observer.observe(container);
	}

	async onClose(): Promise<void> {
		this.handle?.dispose();
		this.handle = null;
		this.observer?.disconnect();
		this.observer = null;
		this.contentEl.empty();
	}
}
