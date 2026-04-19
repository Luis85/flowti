import type { MakeService } from './make-service.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeEventHandlers } from './make-module.js';
import type { WorkspacePort } from '../../domain/shared/workspace-port.js';
import type { LoggerPort } from '../../domain/shared/logger-port.js';

/**
 * A read-only reactive reference compatible with Vue's Readonly<Ref<T>>.
 * Defined structurally here so make-context.ts stays Vue-free (module
 * layer must not import from 'vue'). The UI layer creates the actual
 * Vue ref via createMakeContext() in src/ui/make-context-factory.ts.
 */
export type ReadonlyRef<T> = { readonly value: T };

/**
 * Context exposed by the Make module to Vue consumers. Provided at app
 * mount via PluginContextKey's neighbour MakeContextKey. Consumers
 * should inject via useMakeContext().
 *
 * Writes to settings$ flow through SettingsPort → onSettingsChange (the
 * sole mutator). ReadonlyRef<T> prevents .value = reassignment at the
 * type layer.
 */
export type MakeContext = {
	readonly service:   MakeService;
	readonly settings$: ReadonlyRef<MakeSettings>;
	readonly subscribe: (handlers: MakeEventHandlers) => () => void;
	readonly workspace: WorkspacePort;
	readonly logger:    LoggerPort;
};
