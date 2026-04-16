import type { Plugin } from 'obsidian';
import type { CommandPort } from '../../domain/commands/command-port.js';
import type { CommandEntry } from '../../domain/commands/command-types.js';
import type { ViewRegistryPort } from '../../domain/views/view-registry-port.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export class ObsidianCommandAdapter implements CommandPort {
	private readonly plugin: Plugin;
	private readonly viewRegistry: ViewRegistryPort;
	private readonly ribbonElements = new Map<string, HTMLElement>();

	constructor(plugin: Plugin, viewRegistry: ViewRegistryPort) {
		this.plugin = plugin;
		this.viewRegistry = viewRegistry;
	}

	register(entry: CommandEntry): Unsubscribe {
		let callback = entry.callback ?? (() => {});

		if (entry.opensView !== undefined) {
			const viewType = entry.opensView;
			callback = () => this.viewRegistry.openView(this.plugin, viewType);
		}

		this.plugin.addCommand({
			id: entry.id,
			name: entry.name,
			callback: () => { void callback(); },
		});

		if (entry.ribbon !== undefined) {
			const el = this.plugin.addRibbonIcon(
				entry.ribbon.icon,
				entry.ribbon.title,
				() => { void callback(); },
			);
			if (!entry.ribbon.visibleByDefault) {
				el.style.display = 'none';
			}
			this.ribbonElements.set(entry.id, el);
		}

		return () => {
			const el = this.ribbonElements.get(entry.id);
			if (el !== undefined) {
				el.remove();
				this.ribbonElements.delete(entry.id);
			}
		};
	}

	setRibbonVisibility(visible: boolean): void {
		for (const el of this.ribbonElements.values()) {
			el.style.display = visible ? '' : 'none';
		}
	}

	unregisterAll(): void {
		for (const el of this.ribbonElements.values()) {
			el.remove();
		}
		this.ribbonElements.clear();
	}
}
