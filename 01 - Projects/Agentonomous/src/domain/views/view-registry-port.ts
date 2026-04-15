// Domain-pure interface — no Obsidian import.
// Infrastructure ViewRegistry satisfies ViewRegistryPort<Plugin, PluginContext>.
export interface ViewRegistryPort<P = unknown, C = unknown> {
	registerAll(plugin: P, ctx: C): void;
	openView(plugin: P, type: string): Promise<void>;
}
