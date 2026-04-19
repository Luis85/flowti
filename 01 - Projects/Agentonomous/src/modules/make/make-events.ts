import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MoveReport, TypeId } from '../../domain/make/types.js';
import type { MakeSettings } from './make-settings.js';

declare module '../../domain/shared/event-bus.js' {
	interface EventMap {
		'make:type-created':      { readonly schema: TypeSchema };
		'make:type-updated':      { readonly schema: TypeSchema };
		'make:type-deleted':      { readonly typeId: TypeId; readonly name: string };
		'make:instance-created':  { readonly typeId: TypeId; readonly path: string };
		'make:instance-deleted':  { readonly typeId: TypeId | null; readonly path: string };
		// Declared in Slice G for forward-staging; emitter sites land in Slice J (move-instances).
		'make:instances-moved':   { readonly typeId: TypeId; readonly report: MoveReport };
		'make:base-regenerated':  { readonly typeId: TypeId; readonly basePath: string };
		'make:favorite-toggled':  { readonly typeId: TypeId; readonly favorited: boolean };
		'make:settings-changed':  { readonly settings: MakeSettings };
	}
}
export {};
