// Domain-pure interface — no Obsidian import.
// Infrastructure ViewRegistry satisfies ViewRegistryPort<Plugin, PluginContext>.
import type { Result } from '../shared/result.js';

export interface ViewRegistryPort<P = unknown, C = unknown> {
	registerAll(plugin: P, ctx: C): void;
	openView(plugin: P, type: string): Promise<Result<void, string>>;
}
