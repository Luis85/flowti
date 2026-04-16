import type { EventBus } from '../domain/shared/event-bus.js';
import type { LoggerPort } from '../domain/shared/logger-port.js';
import type { NotificationPort } from '../domain/shared/notification-port.js';
import type { SettingsPort } from '../domain/settings/settings-port.js';
import type { CommandPort } from '../domain/commands/command-port.js';
import type { ViewRegistryPort } from '../domain/views/view-registry-port.js';
import type { Module, ModulePorts } from '../domain/shared/module.js';
import type { Unsubscribe } from '../domain/shared/unsubscribe.js';
import { isOk } from '../domain/shared/result.js';
import { topologicalSort } from '../domain/shared/utils/topo-sort.js';
import { ErrorHandler } from './error-handler.js';
import { CORE_SETTINGS_DEFAULTS, validateCoreSettings, type CoreSettings } from '../domain/settings/plugin-settings.js';

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
	private readonly modules: readonly Module[];
	private sortedModules: Module[] = [];
	private errorHandler: ErrorHandler | null = null;
	private settingsUnsub: Unsubscribe | null = null;
	private currentCoreSettings: CoreSettings = CORE_SETTINGS_DEFAULTS;

	constructor(ports: CorePorts, modules: readonly Module[]) {
		this.ports = ports;
		this.modules = modules;
	}

	async init(): Promise<void> {
		this.state = 'initializing';
		this.ports.eventBus.emit('core', { phase: 'initializing' });

		this.errorHandler = new ErrorHandler(
			this.ports.eventBus,
			this.ports.logger,
			this.ports.notifications,
		);

		const validationErrors = this.collectValidationErrors();
		if (validationErrors.length > 0) {
			this.ports.eventBus.emit('core', { phase: 'validation', errors: validationErrors });
			this.ports.logger.error('core', `Startup validation failed: ${validationErrors.join('; ')}`);
			this.state = 'destroyed';
			return;
		}

		const blob = await this.loadSettingsBlob();
		this.currentCoreSettings = this.resolveCoreSettings(blob);
		const modulePorts = this.buildModulePorts();

		for (const m of this.sortedModules) {
			await m.init(modulePorts, this.resolveModuleSettings(m, blob));
		}

		this.registerAllCommands();

		this.settingsUnsub = this.ports.settings.subscribe(async (_raw) => {
			const freshBlob = await this.loadSettingsBlob();
			this.currentCoreSettings = this.resolveCoreSettings(freshBlob);
		});

		this.state = 'ready';
		this.ports.eventBus.emit('core', { phase: 'ready' });
		this.ports.logger.info('core', 'Plugin initialized');
	}

	destroy(): void {
		this.ports.eventBus.emit('core', { phase: 'destroying' });
		this.settingsUnsub?.();

		for (const m of [...this.sortedModules].reverse()) {
			m.destroy();
		}

		this.ports.commands.unregisterAll();
		this.errorHandler?.destroy();
		this.state = 'destroyed';
		this.ports.eventBus.emit('core', { phase: 'destroyed' });
	}

	get ready(): boolean {
		return this.state === 'ready';
	}

	get coreSettings(): CoreSettings {
		return this.currentCoreSettings;
	}

	private collectValidationErrors(): string[] {
		const errors: string[] = [
			...this.checkDuplicateIds(),
			...this.checkDuplicateSettingsKeys(),
			...this.checkDuplicateCommandIds(),
		];

		const sortResult = topologicalSort(
			this.modules,
			(m) => m.id,
			(m) => m.dependsOn ?? [],
		);

		if (!isOk(sortResult)) {
			errors.push(sortResult.error);
		} else {
			this.sortedModules = sortResult.value;
		}

		return errors;
	}

	private checkDuplicateIds(): string[] {
		const errors: string[] = [];
		const seen = new Set<string>();
		for (const m of this.modules) {
			if (seen.has(m.id)) errors.push(`duplicate module id "${m.id}"`);
			seen.add(m.id);
		}
		return errors;
	}

	private checkDuplicateSettingsKeys(): string[] {
		const errors: string[] = [];
		const seen = new Set<string>();
		for (const m of this.modules) {
			if (m.settingsKey === undefined) continue;
			if (seen.has(m.settingsKey)) errors.push(`duplicate settingsKey "${m.settingsKey}"`);
			seen.add(m.settingsKey);
		}
		return errors;
	}

	private checkDuplicateCommandIds(): string[] {
		const errors: string[] = [];
		const seen = new Set<string>();
		for (const m of this.modules) {
			for (const cmd of m.commands ?? []) {
				if (seen.has(cmd.id)) errors.push(`duplicate command id "${cmd.id}"`);
				seen.add(cmd.id);
			}
		}
		return errors;
	}

	private async loadSettingsBlob(): Promise<Record<string, unknown>> {
		const loaded = await this.ports.settings.load();
		const rawSettings = isOk(loaded) ? loaded.value : null;
		return (typeof rawSettings === 'object' && rawSettings !== null)
			? rawSettings as Record<string, unknown>
			: {};
	}

	private buildModulePorts(): ModulePorts {
		return {
			eventBus: this.ports.eventBus,
			logger: this.ports.logger,
			settings: this.ports.settings,
			notifications: this.ports.notifications,
			views: this.ports.views,
		};
	}

	private resolveModuleSettings(m: Module, blob: Record<string, unknown>): unknown {
		if (m.settingsKey === undefined) {
			return m.settingsDefaults;
		}
		const section = blob[m.settingsKey];
		if (section === undefined) {
			return m.settingsDefaults;
		}
		if (m.validateSettings !== undefined) {
			const validated = m.validateSettings(section);
			return isOk(validated) ? validated.value : m.settingsDefaults;
		}
		return section;
	}

	private resolveCoreSettings(blob: Record<string, unknown>): CoreSettings {
		const section = blob['core'];
		if (section === undefined) return CORE_SETTINGS_DEFAULTS;
		const result = validateCoreSettings(section);
		return isOk(result) ? result.value : CORE_SETTINGS_DEFAULTS;
	}

	private registerAllCommands(): void {
		for (const m of this.sortedModules) {
			for (const cmd of m.commands ?? []) {
				this.ports.commands.register(cmd);
			}
		}
	}
}
