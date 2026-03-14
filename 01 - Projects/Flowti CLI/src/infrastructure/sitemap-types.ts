/**
 * sitemap-types.ts — Declarative UI schema for the Flowti CLI sitemap.
 *
 * Re-exports page types from the unified PageObject system and provides
 * infrastructure-level runtime types (handler signatures, router context,
 * navigation stack) used by the sitemap engine.
 */

import type { MenuResult, MenuEntry, ProjectContext } from "./types.js";
import type { CliDeps } from "./deps.js";

// ── Re-exports from unified PageObject system ───────────────────────

export type {
	UnifiedSitemap as Sitemap,
	PageObject, PageAction, PageKind, ActionType,
	FormField, FieldType, FieldOption, ValidationRule,
	DataSource, EventDeclaration,
	PageChild, PageProperty, PageVariant, PageState,
	StoreRef, Relationship, RouteConfig,
	DisabledCondition, HiddenCondition, PageContext,
} from "../domain/sitemap/unified-page.js";

// ── Navigation stack entry ──────────────────────────────────────────

/**
 * A single frame in the navigation stack.
 *
 * `params` carries view-specific data (e.g. a selected component ID)
 * so handlers can receive arguments without relying on module-level state.
 */
export interface StackEntry {
	readonly viewId: string;
	readonly params?: Readonly<Record<string, unknown>>;
}

// ── Runtime context passed to handlers ──────────────────────────────

export interface RouterContext {
	readonly project?: ProjectContext;
	readonly tools?: Readonly<Record<string, boolean>>;
	readonly deps: CliDeps;
	/**
	 * Parameters passed via `navigate:<viewId>?<params>` or `StackEntry.params`.
	 * Handlers read these instead of relying on module-level state.
	 */
	readonly params?: Readonly<Record<string, unknown>>;
	/**
	 * Data source entries resolved by the router for view handlers.
	 * Keyed by data source slot name (or data source ID if no slot).
	 * View handlers merge these with their own dynamic entries.
	 */
	readonly dataSourceEntries?: Readonly<Record<string, readonly MenuEntry[]>>;
}

// ── Handler signatures ──────────────────────────────────────────────

/** Handles a dynamic view — builds and runs its own menu, returns navigation signal. */
export type ViewHandler = (ctx: RouterContext) => Promise<MenuResult>;

/** Handles a single menu item action. */
export type ActionHandler = (ctx: RouterContext) => Promise<MenuResult | void>;

/** Evaluates a boolean condition for disabled/hidden gating. */
export type ConditionHandler = (ctx: RouterContext) => boolean;

/** Called before a view renders (e.g., to print a status banner). */
export type BeforeRenderHandler = (ctx: RouterContext) => void;
