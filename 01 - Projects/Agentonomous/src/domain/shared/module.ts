import type { Result } from './result.js';
import type { EventBus } from './event-bus.js';
import type { LoggerPort } from './logger-port.js';
import type { NotificationPort } from './notification-port.js';
import type { SettingsPort } from '../settings/settings-port.js';
import type { ViewRegistryPort } from '../views/view-registry-port.js';
import type { CommandEntry } from '../commands/command-types.js';

export interface ModulePorts {
	readonly eventBus: EventBus;
	readonly logger: LoggerPort;
	readonly settings: SettingsPort;
	readonly notifications: NotificationPort;
	readonly views: ViewRegistryPort;
}

export interface Module {
	readonly id: string;
	readonly name: string;
	readonly dependsOn?: readonly string[];
	readonly settingsKey?: string;
	readonly settingsDefaults?: unknown;
	readonly settingsVersion?: number;
	validateSettings?(raw: unknown): Result<unknown, string>;
	migrate?(fromVersion: number, blob: unknown): Result<unknown, string>;
	readonly commands?: readonly CommandEntry[];
	init(ports: ModulePorts, settings: unknown): Promise<void>;
	destroy(): void;
}

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
	init(ports: ModulePorts, settings: TSettings): Promise<void>;
	destroy(): void;
}): Module {
	return def as Module;
}
