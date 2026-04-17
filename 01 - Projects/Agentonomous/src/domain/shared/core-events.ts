import type { LogLevel } from './logger-port.js';

declare module './event-bus.js' {
	interface EventMap {
		log: { level: LogLevel; source: string; message: string; data?: unknown };
		error: { code: string; message: string; source: string; severity: 'user' | 'system' | 'fatal'; data?: unknown };
		settings: {
			action: 'changed' | 'replaced';
			changes: ReadonlyArray<{ key: string; previous?: unknown; current?: unknown }>;
		};
		core: { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'validation'; degraded?: boolean; errors?: string[] };
		command: { id: string; trigger: 'palette' | 'ribbon' | 'hotkey' };
	}
}
