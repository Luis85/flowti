import type { EventBus } from '../domain/shared/event-bus.js';
import type { LoggerPort } from '../domain/shared/logger-port.js';
import type { NotificationPort } from '../domain/shared/notification-port.js';
import type { SettingsPort } from '../domain/settings/settings-port.js';
import type { CommandPort } from '../domain/commands/command-port.js';
import type { CommandEntry } from '../domain/commands/command-types.js';
import type { ViewRegistryPort } from '../domain/views/view-registry-port.js';
import type { Unsubscribe } from '../domain/shared/unsubscribe.js';
import { isOk } from '../domain/shared/result.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../domain/settings/plugin-settings.js';
import { ErrorHandler } from './error-handler.js';

export interface CorePorts {
	readonly settings: SettingsPort;
	readonly commands: CommandPort;
	readonly views: ViewRegistryPort;
	readonly logger: LoggerPort;
	readonly notifications: NotificationPort;
	readonly eventBus: EventBus;
}

export class PluginCore {
	private state: 'idle' | 'initializing' | 'ready' | 'destroyed' = 'idle';
	private readonly ports: CorePorts;
	private readonly commandEntries: readonly CommandEntry[];
	private errorHandler: ErrorHandler | null = null;
	private settingsUnsub: Unsubscribe | null = null;
	private currentSettings: PluginSettings = DEFAULT_SETTINGS;

	constructor(ports: CorePorts, commandEntries: readonly CommandEntry[]) {
		this.ports = ports;
		this.commandEntries = commandEntries;
	}

	async init(): Promise<void> {
		this.state = 'initializing';
		this.ports.eventBus.emit('core', { phase: 'initializing' });

		this.errorHandler = new ErrorHandler(
			this.ports.eventBus,
			this.ports.logger,
			this.ports.notifications,
		);

		const loaded = await this.ports.settings.load();
		this.currentSettings = isOk(loaded) ? loaded.value : DEFAULT_SETTINGS;

		this.ports.logger.setLevel(this.currentSettings.logLevel);

		for (const entry of this.commandEntries) {
			this.ports.commands.register(entry);
		}

		this.settingsUnsub = this.ports.settings.subscribe((s) => {
			const previous = this.currentSettings;
			this.currentSettings = s;
			this.ports.eventBus.emit('settings', { previous, current: s });

			if (previous.logLevel !== s.logLevel) {
				this.ports.logger.setLevel(s.logLevel);
			}

			if (previous.showRibbonIcon !== s.showRibbonIcon) {
				this.ports.commands.setRibbonVisibility?.(s.showRibbonIcon);
			}
		});

		this.state = 'ready';
		this.ports.eventBus.emit('core', { phase: 'ready' });
		this.ports.logger.info('core', 'Plugin initialized');
	}

	destroy(): void {
		this.ports.eventBus.emit('core', { phase: 'destroying' });
		this.settingsUnsub?.();
		this.ports.commands.unregisterAll();
		this.errorHandler?.destroy();
		this.state = 'destroyed';
		this.ports.eventBus.emit('core', { phase: 'destroyed' });
	}

	get ready(): boolean {
		return this.state === 'ready';
	}

	get settings(): PluginSettings {
		return this.currentSettings;
	}
}
