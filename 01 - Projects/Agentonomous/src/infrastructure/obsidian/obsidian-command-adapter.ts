import type { Plugin } from 'obsidian';
import type { CommandPort } from '../../domain/commands/command-port.js';
import type { CommandEntry } from '../../domain/commands/command-types.js';
import type { ViewRegistryPort } from '../../domain/views/view-registry-port.js';
import type { LoggerPort } from '../../domain/shared/logger-port.js';

const LOG_SOURCE = 'ObsidianCommandAdapter';

export class ObsidianCommandAdapter implements CommandPort {
	private readonly plugin: Plugin;
	private readonly viewRegistry: ViewRegistryPort;
	private readonly logger: LoggerPort;
	private readonly ribbonElements = new Map<string, HTMLElement>();

	constructor(plugin: Plugin, viewRegistry: ViewRegistryPort, logger: LoggerPort) {
		this.plugin = plugin;
		this.viewRegistry = viewRegistry;
		this.logger = logger;
	}

	register(entry: CommandEntry): void {
		const userCallback = entry.callback;
		const viewType = entry.opensView;
		// The two steps are run independently so a failure of one does not
		// swallow the other: if the view type is not yet registered at startup,
		// the router.push inside the callback still navigates, and when the
		// view eventually mounts it lands on the right route. Each step's
		// rejection is logged via LoggerPort.
		const combined = async (): Promise<void> => {
			if (viewType !== undefined) {
				try {
					await this.viewRegistry.openView(this.plugin, viewType);
				} catch (err) {
					this.logger.error(LOG_SOURCE, `openView failed for command "${entry.id}"`, err);
				}
			}
			if (userCallback !== undefined) {
				try {
					await userCallback();
				} catch (err) {
					this.logger.error(LOG_SOURCE, `callback failed for command "${entry.id}"`, err);
				}
			}
		};

		this.plugin.addCommand({
			id: entry.id,
			name: entry.name,
			callback: () => { void combined(); },
		});

		if (entry.ribbon !== undefined) {
			const el = this.plugin.addRibbonIcon(
				entry.ribbon.icon,
				entry.ribbon.title,
				() => { void combined(); },
			);
			if (!entry.ribbon.visibleByDefault) {
				el.style.display = 'none';
			}
			this.ribbonElements.set(entry.id, el);
		}
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
