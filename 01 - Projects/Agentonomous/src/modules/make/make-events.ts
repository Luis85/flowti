import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { BulkDeleteReport, MoveReport, TypeId } from '../../domain/make/types.js';
import type { MakeSettings } from './make-settings.js';

declare module '../../domain/shared/event-bus.js' {
	interface EventMap {
		'make:type-created':             { readonly schema: TypeSchema };
		'make:type-updated':             { readonly schema: TypeSchema };
		'make:type-deleted':             { readonly typeId: TypeId; readonly name: string };
		'make:instance-created':         { readonly typeId: TypeId; readonly path: string };
		'make:instance-deleted':         { readonly typeId: TypeId; readonly path: string };
		/** Fired when a file was deleted via deleteInstance but its folder does not
		 *  match any registered type (orphan from a prior type rename/delete). */
		'make:orphan-deleted':           { readonly path: string };
		/** Fired ONCE by service.deleteInstances regardless of how many paths were
		 *  deleted. The store consumer triggers a single loadInstances refresh. */
		'make:instances-deleted-batch':  { readonly typeId: TypeId } & BulkDeleteReport;
		// Declared in Slice G for forward-staging; emitter sites land in Slice J (move-instances).
		'make:instances-moved':          { readonly typeId: TypeId; readonly report: MoveReport };
		'make:base-regenerated':         { readonly typeId: TypeId; readonly basePath: string };
		'make:favorite-toggled':         { readonly typeId: TypeId; readonly favorited: boolean };
		'make:settings-changed':         { readonly settings: MakeSettings };
	}
}
export {};
