/**
 * sitemap-types.ts — Declarative UI schema for the Flowti CLI sitemap.
 *
 * Defines the structure of `configs/sitemap.json`, which declares every view,
 * menu item, and navigation target using the PageObject pattern.
 * The CLI runtime reads this definition and builds menus from it.
 */

import type { MenuResult, ProjectContext } from "./types.js";
import type { CliDeps } from "./deps.js";

// ── Sitemap root ────────────────────────────────────────────────────

export interface Sitemap {
	readonly version: 1;
	readonly views: Record<string, ViewDefinition>;
}

// ── View definitions (discriminated union on `type`) ────────────────

export type ViewDefinition = StaticView | DynamicView;

/**
 * Component-compatible metadata shared by both static and dynamic views.
 *
 * These fields are ignored by the router but enable:
 * 1. Self-describing sitemap — read the JSON to understand any PageObject
 * 2. Component system import — convert views to ComponentDefinitions
 * 3. Application visualization — render the sitemap as a navigable diagram
 */
export interface ViewComponentMeta {
	/** Visual icon identifier (matches component system icons). */
	readonly icon?: string;
	/** Business domain grouping for diagram clustering. */
	readonly domain?: string;
	/** Lifecycle status: draft, active, or deprecated. */
	readonly status?: "draft" | "active" | "deprecated";
	/** Human-readable summary of what this view does. */
	readonly description?: string;
	/**
	 * Parent view ID — establishes a hierarchy between PageObjects.
	 * Used to build a tree of views for visualization and component import.
	 * Navigation items already imply parent→child, but `parent` makes the
	 * relationship explicit for dynamic views and reverse lookups.
	 */
	readonly parent?: string;
	/**
	 * Web router configuration — properties that feed into framework routers
	 * (Angular Router, React Router, Vue Router, etc.) when the sitemap is
	 * used to generate a web application.
	 */
	readonly route?: RouteConfig;
}

/**
 * Web routing configuration for a PageObject.
 *
 * Maps to common concepts across Angular Router, React Router, Vue Router,
 * and similar frameworks. The CLI itself does not use these properties —
 * they are consumed by code generators and visualization tools.
 */
export interface RouteConfig {
	/** URL path segment (e.g. "dashboard", "settings/:id", "users/:userId/profile"). */
	readonly path?: string;
	/** Named route guards to run before activation (e.g. "auth", "admin"). */
	readonly guards?: readonly string[];
	/** Whether the route's component should be lazy-loaded. */
	readonly lazy?: boolean;
	/** Redirect target view ID (for alias/redirect routes). */
	readonly redirectTo?: string;
	/** Named router outlet (for frameworks that support multiple outlets). */
	readonly outlet?: string;
	/** Static data passed to the route (title, breadcrumb, permissions, etc.). */
	readonly data?: Readonly<Record<string, unknown>>;
	/** Whether this route matches the full path or just a prefix. */
	readonly pathMatch?: "full" | "prefix";
}

/** A menu whose items are fully declared in the sitemap JSON. */
export interface StaticView extends ViewComponentMeta {
	readonly type?: "menu";
	readonly title: string;
	readonly context?: readonly ViewContext[];
	readonly beforeRender?: string;
	readonly items: readonly SitemapEntry[];
}

/**
 * A view whose core content is built at runtime by a registered handler.
 *
 * When `items` is provided the view becomes a **hybrid**: the router
 * pre-builds `MenuEntry[]` from the sitemap items and passes them to
 * the handler via `ctx.sitemapEntries`. The handler can merge these
 * with its own data-driven entries before calling `runMenu()`.
 * When `items` is omitted the handler has full control (pure dynamic).
 *
 * Documentary fields (`description`, `capabilities`, `configPath`) are
 * ignored by the router but make the sitemap self-describing — anyone
 * reading sitemap.json can see what a dynamic view offers without
 * tracing into handler code.
 */
export interface DynamicView extends ViewComponentMeta {
	readonly type: "dynamic";
	readonly title: string;
	readonly context?: readonly ViewContext[];
	readonly handler: string;
	/** Called before the view renders (e.g. status banner). */
	readonly beforeRender?: string;
	/**
	 * Optional declarative menu items — editable from the sitemap JSON
	 * just like static views. When present, the router converts them to
	 * `MenuEntry[]` and supplies them via `ctx.sitemapEntries`.
	 */
	readonly items?: readonly SitemapEntry[];
	/** List of operations/actions this view provides. */
	readonly capabilities?: readonly string[];
	/** Dot-path to the flowti.config.json section that drives this view. */
	readonly configPath?: string;
}

export type ViewContext = "project";

// ── Sitemap entries (items + separators) ────────────────────────────

export type SitemapEntry = SitemapItem | SitemapSeparator | SitemapSlot | SitemapListProvider;

export interface SitemapSeparator {
	readonly separator: true;
	readonly hidden?: HiddenCondition;
}

/**
 * A named placeholder in a hybrid dynamic view's items.
 *
 * Slots mark where the handler should insert its data-driven entries.
 * The router groups sitemap-built `MenuEntry[]` into segments keyed
 * by slot name, delivered via `ctx.sitemapSlots`.
 *
 * Example sitemap JSON:
 * ```json
 * "items": [
 *   { "slot": "dynamic-items" },
 *   { "separator": true },
 *   { "key": "c", "label": "Add Component", "handler": "comp:add" },
 *   { "key": "b", "label": "Back", "signal": "back" }
 * ]
 * ```
 *
 * The handler receives `ctx.sitemapSlots["dynamic-items"]` as an empty
 * array (the slot itself produces no entries) and `ctx.sitemapSlots["_after"]`
 * with the built entries for Add Component + Back.
 */
export interface SitemapSlot {
	readonly slot: string;
}

/**
 * A declarative list provider entry in a sitemap view.
 *
 * Instead of a static item, this tells the router to call a registered
 * `ListProviderHandler` which returns an array of `MenuEntry[]` at runtime.
 * The provider can read `ctx.params` and `ctx.project` to build data-driven items.
 *
 * Example sitemap JSON:
 * ```json
 * "items": [
 *   { "listProvider": "component-list" },
 *   { "separator": true },
 *   { "key": "c", "label": "Add Component", "handler": "comp:add" }
 * ]
 * ```
 */
export interface SitemapListProvider {
	readonly listProvider: string;
}

/**
 * A single menu item in a static view.
 *
 * Exactly ONE action field must be set: `navigate`, `command`, `handler`, or `signal`.
 * - `navigate` — push target view onto the navigation stack
 * - `command`  — dispatch through CommandRegistry (reuses existing controllers)
 * - `handler`  — call a registered ActionHandler for complex logic
 * - `signal`   — navigation control: "back" pops stack, "quit" exits, "start" returns to root
 */
export interface SitemapItem {
	readonly key: string;
	readonly label: string;
	readonly navigate?: string;
	/** Static params to pass when navigating (merged with runtime params). */
	readonly navigateParams?: Readonly<Record<string, unknown>>;
	readonly command?: string;
	readonly handler?: string;
	readonly signal?: "back" | "quit" | "start";
	readonly disabled?: DisabledCondition;
	readonly disabledMessage?: string;
	readonly hidden?: HiddenCondition;
}

// ── Conditions ──────────────────────────────────────────────────────

/**
 * Controls when a menu item is disabled.
 * - `boolean`           — literal true/false
 * - `string`            — registered ConditionHandler ID
 * - `{ unless: string }` — expression evaluated against RouterContext
 */
export type DisabledCondition = boolean | string | { readonly unless: string };

/**
 * Controls when a menu item is hidden (not rendered at all).
 * - `boolean` — literal
 * - `string`  — registered ConditionHandler ID
 */
export type HiddenCondition = boolean | string;

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
	 * Pre-built menu entries from sitemap `items` on a hybrid dynamic view.
	 * Only populated when a dynamic view declares `items` in the sitemap.
	 * Handlers can merge these with their own data-driven entries.
	 *
	 * When items contain no `{ slot }` markers, this is a flat array of all entries.
	 * When slots are present, use `sitemapSlots` for positional control.
	 */
	readonly sitemapEntries?: readonly import("./types.js").MenuEntry[];
	/**
	 * Sitemap entries split by named slots.
	 *
	 * `"_before"` — entries before the first slot.
	 * `"<slot-name>"` — the slot itself (always an empty array, marks insertion point).
	 * Entries after a slot are in the next segment (next slot name, or `"_after"`).
	 * `"_after"` — entries after the last slot.
	 *
	 * Example: `[A, B, { slot: "data" }, C, D, { slot: "libs" }, E]`
	 * produces: `{ _before: [A,B], data: [], _between_data_libs: [C,D], libs: [], _after: [E] }`
	 *
	 * Simplified: the handler can use `_before` / slot names / `_after` to assemble
	 * `[...slots._before, ...myDynamicItems, ...slots._after]`.
	 */
	readonly sitemapSlots?: Readonly<Record<string, readonly import("./types.js").MenuEntry[]>>;
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

/**
 * Returns a dynamic list of menu entries at runtime.
 *
 * Used by `SitemapListProvider` entries in sitemap JSON. The router calls
 * the provider, inserts the returned entries at the provider's position,
 * then continues building the rest of the menu from static items.
 */
export type ListProviderHandler = (ctx: RouterContext) => import("./types.js").MenuEntry[];
