import type { EventBus } from '../domain/shared/event-bus.js';
import type { LoggerPort } from '../domain/shared/logger-port.js';
import type { NotificationPort } from '../domain/shared/notification-port.js';
import type { DialogPort } from '../domain/shared/dialog-port.js';
import type { SettingsPort } from '../domain/settings/settings-port.js';
import type { CommandPort } from '../domain/commands/command-port.js';
import type { ViewRegistryPort } from '../domain/views/view-registry-port.js';
import type { Module, ModulePorts } from '../domain/shared/module.js';
import type { Unsubscribe } from '../domain/shared/unsubscribe.js';
import type { TranslationPort } from '../domain/shared/translation-port.js';
import type { PlatformPort } from '../domain/shared/platform-port.js';
import type { VaultPort } from '../domain/shared/vault-port.js';
import type { StoragePort } from '../domain/shared/storage-port.js';
import type { AgentPort, TaskPort } from '../domain/agents/agent-port.js';
import type { FileExtensionPort } from '../domain/shared/file-extension-port.js';
import { isOk } from '../domain/shared/result.js';
import { topologicalSort } from '../domain/shared/utils/topo-sort.js';
import { diffSettingsBlob } from '../domain/settings/diff-settings-blob.js';
import { ErrorHandler } from './error-handler.js';
import { CORE_SETTINGS_DEFAULTS, validateCoreSettings, type CoreSettings } from '../domain/settings/plugin-settings.js';

export interface CorePorts {
	readonly settings: SettingsPort;
	readonly commands: CommandPort;
	readonly views: ViewRegistryPort;
	readonly logger: LoggerPort;
	readonly notifications: NotificationPort;
	readonly dialogs: DialogPort;
	readonly eventBus: EventBus;
	readonly t: TranslationPort;
	readonly platform: PlatformPort;
	readonly vault: VaultPort;
	readonly storage: StoragePort;
	readonly agents: AgentPort;
	readonly tasks: TaskPort;
	/** Merge per-locale messages from a module into the i18n instance. Platform-agnostic callback. */
	readonly i18nMerge?: (locale: string, messages: Record<string, string>) => void;
}

export class PluginCore {
	private state: 'idle' | 'initializing' | 'ready' | 'destroyed' = 'idle';
	private readonly ports: CorePorts;
	private readonly modules: readonly Module[];
	private sortedModules: Module[] = [];
	private errorHandler: ErrorHandler | null = null;
	private settingsUnsub: Unsubscribe | null = null;
	private currentCoreSettings: CoreSettings = CORE_SETTINGS_DEFAULTS;
	private initializedModuleIds = new Set<string>();
	private degradedModuleIds: string[] = [];
	private readonly initListenerDelta = new Map<string, number>();

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

		let blob = await this.loadSettingsBlob();
		this.currentCoreSettings = this.resolveCoreSettings(blob);
		const modulePorts = this.buildModulePorts();

		if (this.ports.i18nMerge !== undefined) {
			for (const m of this.sortedModules) {
				if (m.messages !== undefined) {
					for (const [locale, messages] of Object.entries(m.messages)) {
						this.ports.i18nMerge(locale, messages);
					}
				}
			}
		}

		const migratedBlob = await this.initModulesAndMigrate(modulePorts, blob);
		if (migratedBlob !== null) {
			await this.ports.settings.save(migratedBlob);
		}

		this.registerAllCommands();

		if (this.degradedModuleIds.length > 0) {
			this.ports.eventBus.emit('core', { phase: 'ready', degraded: true, errors: this.degradedModuleIds.map((id) => `Module "${id}" failed`) });
		}

		this.settingsUnsub = this.ports.settings.subscribe((raw) => {
			const previousBlob = blob;
			const freshBlob = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
				? raw as Record<string, unknown>
				: {};
			blob = freshBlob;
			this.currentCoreSettings = this.resolveCoreSettings(freshBlob);
			const changes = diffSettingsBlob(previousBlob, freshBlob);
			this.ports.eventBus.emit('settings', { action: 'changed', changes });
			this.dispatchSettingsChanges(changes, freshBlob);
		});

		this.state = 'ready';
		this.ports.eventBus.emit('core', { phase: 'ready' });
		this.ports.logger.info('core', 'Plugin initialized');
	}

	destroy(): void {
		this.ports.eventBus.emit('core', { phase: 'destroying' });
		this.settingsUnsub?.();

		for (const m of [...this.sortedModules].reverse()) {
			if (!this.initializedModuleIds.has(m.id)) continue;

			const delta = this.initListenerDelta.get(m.id) ?? 0;
			const before = this.ports.eventBus.listenerCount();
			m.destroy();
			const after = this.ports.eventBus.listenerCount();
			// A module that added N listeners at init time should unsubscribe at
			// least N on destroy. Anything less is a leak. Modules that never
			// subscribed (delta = 0) are never flagged.
			if (delta > 0 && after > before - delta) {
				this.ports.logger.warn('core', `Module "${m.id}" may have leaked event listener(s)`);
			}
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

	get degradedModules(): readonly string[] {
		return this.degradedModuleIds;
	}

	get registeredModules(): readonly Module[] {
		return this.sortedModules;
	}

	private collectValidationErrors(): string[] {
		const errors: string[] = [
			...this.checkDuplicateIds(),
			...this.checkDuplicateSettingsKeys(),
			...this.checkReservedSettingsKeys(),
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

	private checkReservedSettingsKeys(): string[] {
		// PluginCore owns the "core" settings section (logLevel, locale, etc.)
		// No module may claim it.
		const errors: string[] = [];
		for (const m of this.modules) {
			if (m.settingsKey === 'core') {
				errors.push(`module "${m.id}" cannot use reserved settingsKey "core"`);
			}
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
			dialogs: this.ports.dialogs,
			views: this.ports.views,
			t: this.ports.t,
			platform: this.ports.platform,
			vault: this.ports.vault,
			storage: this.ports.storage,
			agents: this.ports.agents,
			tasks: this.ports.tasks,
		};
	}

	/**
	 * Single migration + validation pass for one module's settings.  Returns
	 * the value to pass to init(), the migrated section (or undefined if the
	 * section was absent), and whether the section changed (so the caller can
	 * persist the blob back).
	 */
	private resolveSettingsFor(m: Module, blob: Record<string, unknown>): {
		settings: unknown;
		migratedSection: unknown;
		wasMigrated: boolean;
	} {
		if (m.settingsKey === undefined) {
			return { settings: m.settingsDefaults, migratedSection: undefined, wasMigrated: false };
		}
		const rawSection = blob[m.settingsKey];
		if (rawSection === undefined) {
			return { settings: m.settingsDefaults, migratedSection: undefined, wasMigrated: false };
		}

		const migratedSection = this.applyMigration(m, rawSection);
		const wasMigrated = migratedSection !== rawSection;

		let validated = migratedSection;
		if (m.validateSettings !== undefined) {
			const result = m.validateSettings(validated);
			validated = isOk(result) ? result.value : m.settingsDefaults;
		}

		return { settings: validated, migratedSection, wasMigrated };
	}

	private applyMigration(m: Module, section: unknown): unknown {
		if (m.settingsVersion === undefined || m.migrate === undefined) {
			return section;
		}
		return this.runMigrationLoop(m, m.migrate, section, m.settingsVersion);
	}

	private runMigrationLoop(
		m: Module,
		migrate: NonNullable<Module['migrate']>,
		section: unknown,
		targetVersion: number,
	): unknown {
		const sectionRecord = typeof section === 'object' && section !== null ? section as Record<string, unknown> : {};
		let version = typeof sectionRecord['_version'] === 'number' ? sectionRecord['_version'] : 0;
		let current = section;
		const maxIterations = targetVersion - version;

		for (let iterations = 0; version < targetVersion && iterations < maxIterations + 1; iterations++) {
			const migrated = migrate(version, current);
			if (!isOk(migrated)) {
				this.ports.logger.warn('core', `Migration failed for "${m.id}": ${migrated.error}`);
				return m.settingsDefaults;
			}
			current = migrated.value;
			version++;
		}

		if (typeof current === 'object' && current !== null) {
			(current as Record<string, unknown>)['_version'] = targetVersion;
		}
		return current;
	}

	/**
	 * Forward each changed section to the owning module's onSettingsChange
	 * hook (if it has one and was successfully initialized).
	 */
	private dispatchSettingsChanges(
		changes: ReadonlyArray<{ key: string }>,
		blob: Record<string, unknown>,
	): void {
		for (const change of changes) {
			const m = this.sortedModules.find((mod) => mod.settingsKey === change.key);
			if (m === undefined || !this.initializedModuleIds.has(m.id)) continue;
			if (m.onSettingsChange === undefined) continue;

			const { settings } = this.resolveSettingsFor(m, blob);
			try {
				m.onSettingsChange(settings);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				this.ports.logger.error('core', `Module "${m.id}" onSettingsChange failed: ${msg}`);
			}
		}
	}

	private resolveCoreSettings(blob: Record<string, unknown>): CoreSettings {
		const section = blob['core'];
		if (section === undefined) return CORE_SETTINGS_DEFAULTS;
		const result = validateCoreSettings(section);
		return isOk(result) ? result.value : CORE_SETTINGS_DEFAULTS;
	}

	/**
	 * Initialize all sorted modules, applying migrations exactly once along
	 * the way.  Returns a merged blob if any module's settings were migrated
	 * (so the caller can save it back), or null if nothing changed.
	 */
	private async initModulesAndMigrate(
		modulePorts: ModulePorts,
		blob: Record<string, unknown>,
	): Promise<Record<string, unknown> | null> {
		let migratedBlob: Record<string, unknown> | null = null;

		for (const m of this.sortedModules) {
			try {
				const { settings, migratedSection, wasMigrated } = this.resolveSettingsFor(m, blob);
				if (wasMigrated && m.settingsKey !== undefined) {
					const next: Record<string, unknown> = migratedBlob ?? { ...blob };
					next[m.settingsKey] = migratedSection;
					migratedBlob = next;
				}
				const baseline = this.ports.eventBus.listenerCount();
				await m.init(modulePorts, settings);
				this.initListenerDelta.set(m.id, this.ports.eventBus.listenerCount() - baseline);
				this.initializedModuleIds.add(m.id);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				this.ports.logger.error('core', `Module "${m.id}" failed to initialize: ${msg}`);
				this.degradedModuleIds.push(m.id);
			}
		}

		return migratedBlob;
	}

	/**
	 * Register all file extensions declared by initialized modules.
	 * Must be called AFTER views.registerAll() — Obsidian requires view
	 * types to exist before extensions can be associated with them.
	 */
	registerExtensions(port: FileExtensionPort): void {
		for (const m of this.sortedModules) {
			if (!this.initializedModuleIds.has(m.id)) continue;
			for (const entry of m.extensions ?? []) {
				port.register([entry.ext], entry.viewType);
			}
		}
	}

	private registerAllCommands(): void {
		for (const m of this.sortedModules) {
			if (!this.initializedModuleIds.has(m.id)) continue;
			for (const cmd of m.commands ?? []) {
				this.ports.commands.register(cmd);
			}
		}
	}
}
