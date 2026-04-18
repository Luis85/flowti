declare module '../../domain/shared/event-bus.js' {
	interface EventMap {
		'make:type-created':      { readonly typeId: string; readonly name: string };
		'make:type-updated':      { readonly typeId: string; readonly name: string };
		'make:type-deleted':      { readonly typeId: string; readonly name: string };
		'make:instance-created':  { readonly typeId: string; readonly path: string };
		'make:instance-deleted':  { readonly typeId: string; readonly path: string };
		'make:base-regenerated':  { readonly typeId: string; readonly basePath: string };
		'make:favorite-toggled':  { readonly typeId: string; readonly isFavorite: boolean };
	}
}
export {};
