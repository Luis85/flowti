import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";

export interface TabContext {
	tabId: string;
	viewId: string;
	eventBus: IEventBus;
	searchText?: string;
	/** The WorkspaceLeaf hosting this view (available in SitemapLeafView contexts) */
	leaf?: unknown;
}

export interface ActionContext {
	eventBus: IEventBus;
	app: unknown;
	logger: ILogger;
	params?: Record<string, string>;
}

export interface ConditionContext {
	app: unknown;
	eventBus: IEventBus;
}

export interface DataSourceContext {
	eventBus: IEventBus;
	params?: Record<string, string>;
}

export type TabCleanup = () => void;
export type TabHandler = (container: HTMLElement, ctx: TabContext) => void | TabCleanup | Promise<void | TabCleanup>;
export type ActionHandler = (ctx: ActionContext) => void | Promise<void>;
export type ConditionHandler = (ctx: ConditionContext) => boolean;
export type DataSourceHandler = (ctx: DataSourceContext) => unknown | Promise<unknown>;

export class PluginHandlerRegistry {
	private tabs = new Map<string, TabHandler>();
	private actions = new Map<string, ActionHandler>();
	private conditions = new Map<string, ConditionHandler>();
	private dataSources = new Map<string, DataSourceHandler>();

	registerTabHandler(id: string, handler: TabHandler): void {
		this.tabs.set(id, handler);
	}

	getTabHandler(id: string): TabHandler | undefined {
		return this.tabs.get(id);
	}

	registerAction(id: string, handler: ActionHandler): void {
		this.actions.set(id, handler);
	}

	getAction(id: string): ActionHandler | undefined {
		return this.actions.get(id);
	}

	registerCondition(id: string, handler: ConditionHandler): void {
		this.conditions.set(id, handler);
	}

	getCondition(id: string): ConditionHandler | undefined {
		return this.conditions.get(id);
	}

	registerDataSource(id: string, handler: DataSourceHandler): void {
		this.dataSources.set(id, handler);
	}

	getDataSource(id: string): DataSourceHandler | undefined {
		return this.dataSources.get(id);
	}

	hasHandler(id: string): boolean {
		return this.tabs.has(id) || this.actions.has(id) || this.conditions.has(id) || this.dataSources.has(id);
	}

	getRegisteredIds(): string[] {
		return [
			...this.tabs.keys(),
			...this.actions.keys(),
			...this.conditions.keys(),
			...this.dataSources.keys(),
		];
	}

	clear(): void {
		this.tabs.clear();
		this.actions.clear();
		this.conditions.clear();
		this.dataSources.clear();
	}
}
