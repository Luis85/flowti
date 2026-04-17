import type { Result } from './result.js';
import type { EventBus } from './event-bus.js';
import type { LoggerPort } from './logger-port.js';
import type { NotificationPort } from './notification-port.js';
import type { SettingsPort } from '../settings/settings-port.js';
import type { ViewRegistryPort } from '../views/view-registry-port.js';
import type { CommandEntry } from '../commands/command-types.js';
import type { TranslationPort } from './translation-port.js';
import type { PlatformPort } from './platform-port.js';
import type { VaultPort } from './vault-port.js';
import type { StoragePort } from './storage-port.js';
import type { ViewIntent } from '../views/view-registration.js';

/** Scoped ports injected into every module at init time. */
export interface ModulePorts {
	/** Typed pub/sub for cross-module communication. The only sanctioned coupling mechanism. */
	readonly eventBus: EventBus;
	/** Structured logger (debug/info/warn/error). Dual console + bus output. */
	readonly logger: LoggerPort;
	/** Load/save the merged settings blob. Modules read only their own settingsKey section. */
	readonly settings: SettingsPort;
	/** Show user-facing toast notifications. Use for user-severity errors only. */
	readonly notifications: NotificationPort;
	/** Register and open Obsidian views. */
	readonly views: ViewRegistryPort;
	/** i18n translation function. All user-facing strings must go through this. */
	readonly t: TranslationPort;
	/** Platform adapter (locale, etc). */
	readonly platform: PlatformPort;
	/** Vault CRUD + frontmatter access. */
	readonly vault: VaultPort;
	/** Namespaced keyed JSON storage for structured per-module data. */
	readonly storage: StoragePort;
}

/** A self-contained feature unit. Registered with PluginCore and lifecycle-managed. */
export interface Module {
	/** Unique identifier across all registered modules. Duplicates are fatal at startup. */
	readonly id: string;

	/** Human-readable name for logs, settings UI, and health reports. */
	readonly name: string;

	/** Module IDs that must complete init() before this one. Circular deps are fatal. Unknown deps are fatal. */
	readonly dependsOn?: readonly string[];

	/** Key in the merged settings blob. Must not collide across modules. Omit for modules with no settings. */
	readonly settingsKey?: string;

	/** Default settings used when no persisted data exists or validation fails. */
	readonly settingsDefaults?: unknown;

	/** Schema version for settings migration. Increment when the settings shape changes. */
	readonly settingsVersion?: number;

	/** Validates raw persisted settings blob. Return ok(validated) or err(reason). On err, defaults are used. */
	validateSettings?(raw: unknown): Result<unknown, string>;

	/** Migrates settings from an older version. Called in a loop until version matches settingsVersion. */
	migrate?(fromVersion: number, blob: unknown): Result<unknown, string>;

	/** Commands to register with Obsidian. Declared as data; PluginCore handles registration. */
	readonly commands?: readonly CommandEntry[];

	/** Per-locale message maps for vue-i18n. Keys are locale codes (e.g. 'en'). */
	readonly messages?: Record<string, Record<string, string>>;

	/** File extensions this module claims, paired with their view type. */
	readonly extensions?: readonly { readonly ext: string; readonly viewType: string }[];

	/** Platform-neutral view declarations. Infrastructure resolves each to a concrete factory by `type`. */
	readonly views?: readonly ViewIntent[];

	/** Called after dependencies are ready. Receives scoped ports and validated settings. May subscribe to EventBus. */
	init(ports: ModulePorts, settings: unknown): Promise<void>;

	/**
	 * Called when the module's settings section changes at runtime.  Receives
	 * the new validated settings (same shape `init` would see).  Use this to
	 * reconfigure live state (e.g. resize a buffer, rebind a listener) without
	 * requiring a plugin reload.
	 */
	onSettingsChange?(next: unknown): void;

	/** Called on plugin unload in reverse dependency order. Must unsubscribe all listeners and clear intervals. */
	destroy(): void;
}

/**
 * Type-safe module builder. Preserves TSettings at the definition site
 * for compile-time safety, then erases to Module (unknown settings)
 * for the heterogeneous collection in PluginCore.
 *
 * Required way to create modules. Direct Module literals lose type safety.
 */
export function defineModule<TSettings = unknown>(def: {
	readonly id: string;
	readonly name: string;
	readonly dependsOn?: readonly string[];
	readonly settingsKey?: string;
	readonly settingsDefaults?: TSettings;
	readonly settingsVersion?: number;
	validateSettings?(raw: unknown): Result<TSettings, string>;
	migrate?(fromVersion: number, blob: unknown): Result<TSettings, string>;
	readonly commands?: readonly CommandEntry[];
	readonly messages?: Record<string, Record<string, string>>;
	readonly extensions?: readonly { readonly ext: string; readonly viewType: string }[];
	readonly views?: readonly ViewIntent[];
	init(ports: ModulePorts, settings: TSettings): Promise<void>;
	onSettingsChange?(next: TSettings): void;
	destroy(): void;
}): Module {
	return def as Module;
}
