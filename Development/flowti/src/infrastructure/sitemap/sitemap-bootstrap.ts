import type { WorkspaceLeaf } from "obsidian";
import type { PluginSitemap } from "../../domain/sitemap/plugin-sitemap-types";
import type { PluginHandlerRegistry, ActionContext, ConditionContext } from "../handlers/plugin-handler-registry";
import type { ConditionEvaluator } from "../handlers/condition-evaluator";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import { SitemapHubView } from "../../ui/views/sitemap-hub-view";
import { SitemapLeafView } from "../../ui/views/sitemap-leaf-view";

export interface SitemapBootstrapDeps {
	plugin: {
		app: { workspace: { getLeaf(newLeaf: boolean): { setViewState(state: { type: string }): void } } };
		registerView(type: string, creator: (leaf: WorkspaceLeaf) => unknown): void;
		addCommand(command: { id: string; name: string; icon?: string; callback?: () => void; checkCallback?: (checking: boolean) => boolean }): void;
		addRibbonIcon(icon: string, label: string, callback: () => void): void;
	};
	eventBus: IEventBus;
	logger: ILogger;
	handlerRegistry: PluginHandlerRegistry;
	conditionEvaluator: ConditionEvaluator;
	legacyViewFactories: Map<string, (leaf: WorkspaceLeaf) => unknown>;
}

export class SitemapBootstrap {
	private sitemap: PluginSitemap;
	private deps: SitemapBootstrapDeps;
	private registeredViewTypes: string[] = [];
	private commandIds: string[] = [];

	constructor(sitemap: PluginSitemap, deps: SitemapBootstrapDeps) {
		this.sitemap = sitemap;
		this.deps = deps;
	}

	registerAll(): void {
		this.registerViews();
		this.registerCommands();
		this.registerRibbon();
	}

	private registerViews(): void {
		for (const [viewId, viewDef] of Object.entries(this.sitemap.views)) {
			if (viewDef.legacy) {
				const factory = this.deps.legacyViewFactories.get(viewDef.type);
				if (!factory) {
					this.deps.logger.debug(`Legacy view factory not found for "${viewDef.type}" (${viewId}) — will be registered later`);
					continue;
				}
				this.safeRegister(viewDef.type, (leaf) => factory(leaf) as never);
				this.registeredViewTypes.push(viewDef.type);
				continue;
			}

			if (viewDef.tabs) {
				// Hub view — tabs + handlers
				this.safeRegister(viewDef.type, (leaf) =>
					new SitemapHubView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry) as never,
				);
			} else if (viewDef.component || viewDef.handler) {
				// Leaf view — component or handler
				this.safeRegister(viewDef.type, (leaf) =>
					new SitemapLeafView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry) as never,
				);
			}
			this.registeredViewTypes.push(viewDef.type);
		}
	}

	/** Register a view type, tolerating "already registered" errors during hot-reload. */
	private safeRegister(type: string, creator: (leaf: WorkspaceLeaf) => unknown): void {
		try {
			this.deps.plugin.registerView(type, creator);
		} catch (err) {
			if (err instanceof Error && err.message.includes("existing view type")) {
				this.deps.logger.debug(`View "${type}" already registered (hot-reload)`);
			} else {
				throw err;
			}
		}
	}

	private registerCommands(): void {
		for (const cmdDef of this.sitemap.commands) {
			const handler = this.deps.handlerRegistry.getAction(cmdDef.handler);
			if (!handler) {
				this.deps.logger.warn(`Action handler not found for command "${cmdDef.id}": ${cmdDef.handler}`);
				continue;
			}

			const buildActionCtx = (): ActionContext => ({
				eventBus: this.deps.eventBus,
				app: this.deps.plugin.app,
				logger: this.deps.logger,
			});

			if (cmdDef.conditions) {
				this.deps.plugin.addCommand({
					id: cmdDef.id,
					name: cmdDef.name,
					icon: cmdDef.icon,
					checkCallback: (checking) => {
						const condCtx: ConditionContext = {
							app: this.deps.plugin.app,
							eventBus: this.deps.eventBus,
						};
						if (cmdDef.conditions!.hidden) {
							if (this.deps.conditionEvaluator.evaluate(cmdDef.conditions!.hidden, condCtx)) {
								return false;
							}
						}
						if (cmdDef.conditions!.disabled) {
							if (this.deps.conditionEvaluator.evaluate(cmdDef.conditions!.disabled, condCtx)) {
								return false;
							}
						}
						if (!checking) {
							void handler(buildActionCtx());
						}
						return true;
					},
				});
			} else {
				this.deps.plugin.addCommand({
					id: cmdDef.id,
					name: cmdDef.name,
					icon: cmdDef.icon,
					callback: () => {
						void handler(buildActionCtx());
					},
				});
			}

			this.commandIds.push(cmdDef.id);
		}
	}

	private registerRibbon(): void {
		for (const ribbonDef of this.sitemap.ribbon) {
			this.deps.plugin.addRibbonIcon(ribbonDef.icon, ribbonDef.label, () => {
				if (ribbonDef.conditions?.hidden) {
					const condCtx: ConditionContext = {
						app: this.deps.plugin.app,
						eventBus: this.deps.eventBus,
					};
					if (this.deps.conditionEvaluator.evaluate(ribbonDef.conditions.hidden, condCtx)) {
						return;
					}
				}

				if (ribbonDef.action.startsWith("view:")) {
					const viewType = ribbonDef.action.slice(5);
					this.deps.plugin.app.workspace.getLeaf(true).setViewState({ type: viewType });
					return;
				}

				const handler = this.deps.handlerRegistry.getAction(ribbonDef.action);
				if (handler) {
					void handler({
						eventBus: this.deps.eventBus,
						app: this.deps.plugin.app,
						logger: this.deps.logger,
					});
				}
			});
		}
	}

	/** Log warnings for any sitemap commands whose action handlers are not registered. */
	validate(): void {
		const missing: string[] = [];
		for (const cmdDef of this.sitemap.commands) {
			if (!this.deps.handlerRegistry.getAction(cmdDef.handler)) {
				missing.push(`command "${cmdDef.id}" -> handler "${cmdDef.handler}"`);
			}
		}
		if (missing.length > 0) {
			this.deps.logger.warn(`SitemapBootstrap: ${missing.length} unregistered handler(s):\n${missing.join("\n")}`);
		}
	}

	unregisterAll(): void {
		this.registeredViewTypes = [];
		this.commandIds = [];
	}
}
