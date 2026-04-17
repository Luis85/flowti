/**
 * View declaration types.
 *
 * `ViewIntent` is the platform-neutral declaration — what modules say they
 * need.  It carries the view type, display metadata, and where it should
 * mount.  Modules put these in `Module.views` without caring about Obsidian,
 * Vue, or any rendering detail.
 *
 * `ViewRegistration` extends the intent with a factory.  The factory is
 * host-specific (Obsidian `WorkspaceLeaf` → `ItemView`), so the infrastructure
 * layer owns it.  `main.ts` zips module intents with infra registrations by
 * matching view `type`.
 */
export type ViewLocation = 'main' | 'left' | 'right';

export interface ViewIntent {
	readonly type: string;
	readonly displayName: string;
	readonly icon: string;
	readonly defaultLocation: ViewLocation;
}

export interface ViewRegistration<Leaf = never, View = unknown, Ctx = never> extends ViewIntent {
	readonly viewFactory: (leaf: Leaf, ctx: Ctx) => View;
}
