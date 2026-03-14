/**
 * unified-page.ts — Unified PageObject type system for sitemap + component architecture.
 *
 * Every entry in `configs/sitemap.json` is a `PageObject` — simultaneously
 * a navigable view (for the CLI router) and a valid component definition
 * (for Storybook, visualization, and the component system).
 *
 * Design principles:
 * - Actions follow HTML event naming (`on*` prefix)
 * - Forms are their own component (`kind: "form"`) with HTML field types
 * - PageObject pattern: pages define use-cases as actions (the DSL)
 * - Components declare input/output events
 * - At a glance: kind, label, description, parent, route, children, actions, properties
 */

// ── Sitemap root ────────────────────────────────────────────────────

export interface UnifiedSitemap {
	readonly version: 2;
	readonly pages: Record<string, PageObject>;
}

// ── Page kinds ──────────────────────────────────────────────────────

/** PageObject kind — drives rendering strategy and Storybook category. */
export type PageKind =
	| "page" | "form" | "layout" | "dialog" | "list"
	| "component" | "ui-component"
	| "system" | "container" | "c4-component" | "person";

export const PAGE_KINDS: readonly PageKind[] = [
	"page", "form", "layout", "dialog", "list",
	"component", "ui-component",
	"system", "container", "c4-component", "person",
];

// ── The PageObject ──────────────────────────────────────────────────

export type PageContext = "project";

export interface PageObject {
	// ── Identity ────────────────────────────────────────────────────
	readonly kind: PageKind;
	readonly label: string;
	readonly description: string;
	readonly icon?: string;
	readonly domain?: string;
	readonly status?: "draft" | "active" | "deprecated";

	// ── Navigation tree ─────────────────────────────────────────────
	readonly parent?: string;
	readonly route?: RouteConfig;
	readonly context?: readonly PageContext[];

	// ── Actions (the PageObject DSL) ────────────────────────────────
	readonly actions: readonly PageAction[];

	// ── Children (component composition) ────────────────────────────
	readonly children?: readonly PageChild[];

	// ── Dynamic content sources ─────────────────────────────────────
	readonly dataSources?: readonly DataSource[];

	// ── Lifecycle hooks (HTML on* naming) ────────────────────────────
	readonly onBeforeRender?: string;
	readonly onNavigate?: string;
	readonly onLeave?: string;

	// ── Component properties (Storybook / visualization) ────────────
	readonly properties?: readonly PageProperty[];
	readonly variants?: readonly PageVariant[];
	readonly states?: readonly PageState[];

	// ── Form fields (kind: "form" only) ─────────────────────────────
	readonly fields?: readonly FormField[];
	readonly validation?: readonly ValidationRule[];

	// ── Events I/O contract ─────────────────────────────────────────
	readonly emits?: readonly EventDeclaration[];
	readonly accepts?: readonly EventDeclaration[];

	// ── Component metadata ──────────────────────────────────────────
	readonly stores?: readonly StoreRef[];
	readonly relationships?: readonly Relationship[];
	readonly requirements?: readonly string[];
	readonly features?: readonly string[];
	readonly configPath?: string;
}

// ── Actions ─────────────────────────────────────────────────────────

/** Action trigger type — what happens when the action is invoked. */
export type ActionType = "navigate" | "handler" | "command" | "signal" | "form";

/**
 * A PageObject action. Follows HTML event naming (on* prefix).
 * Replaces the old item.navigate/handler/command/signal split.
 */
export interface PageAction {
	/** HTML event name: onClick, onSubmit, onNavigate, etc. */
	readonly name: string;
	/** Human-readable label shown in menus. */
	readonly label: string;
	/** Description for documentation and Storybook. */
	readonly description?: string;

	/** What happens when triggered. */
	readonly type: ActionType;
	/** Target: view ID (navigate), handler ID (handler), command ID (command), signal name (signal), form page ID (form). */
	readonly target?: string;
	/** Parameters passed when navigating. */
	readonly params?: Readonly<Record<string, unknown>>;

	/** Explicit shortcut key for CLI menu; auto-assigned if omitted. */
	readonly key?: string;

	/** Condition controlling when this action is disabled. */
	readonly disabled?: DisabledCondition;
	/** Message shown when the action is disabled. */
	readonly disabledMessage?: string;
	/** Condition controlling when this action is hidden. */
	readonly hidden?: HiddenCondition;

	/** Output event name this action produces. */
	readonly emits?: string;
	/** Input event name that triggers this action. */
	readonly accepts?: string;

	/** Visual grouping — actions in the same group render together, separators between groups. */
	readonly group?: string;
}

// ── Form fields ─────────────────────────────────────────────────────

/** HTML input field types. */
export type FieldType =
	| "text" | "number" | "email" | "url" | "tel" | "password"
	| "date" | "datetime-local" | "time"
	| "select" | "radio" | "checkbox" | "toggle"
	| "textarea" | "file" | "hidden" | "color" | "range";

export const FIELD_TYPES: readonly FieldType[] = [
	"text", "number", "email", "url", "tel", "password",
	"date", "datetime-local", "time",
	"select", "radio", "checkbox", "toggle",
	"textarea", "file", "hidden", "color", "range",
];

/** An option for select/radio fields. */
export interface FieldOption {
	readonly value: string;
	readonly label: string;
	readonly disabled?: boolean;
}

/** A form field definition following HTML input standards. */
export interface FormField {
	/** Field name (maps to data key in submitted form data). */
	readonly name: string;
	/** Human-readable label. */
	readonly label: string;
	/** HTML input type. */
	readonly type: FieldType;
	/** Placeholder text. */
	readonly placeholder?: string;
	/** Default value. */
	readonly defaultValue?: string | number | boolean;
	/** Whether the field is required. */
	readonly required?: boolean;
	/** Condition controlling when this field is disabled. */
	readonly disabled?: DisabledCondition;
	/** Condition controlling when this field is hidden. */
	readonly hidden?: HiddenCondition;

	// ── Constraints ─────────────────────────────────────────────────
	readonly min?: number;
	readonly max?: number;
	readonly minLength?: number;
	readonly maxLength?: number;
	/** Regex validation pattern. */
	readonly pattern?: string;

	// ── Options (select/radio) ──────────────────────────────────────
	readonly options?: readonly FieldOption[];
}

/** A form-level validation rule. */
export interface ValidationRule {
	readonly field: string;
	readonly rule: "required" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "custom";
	readonly value?: string | number;
	readonly message: string;
}

// ── Data sources ────────────────────────────────────────────────────

/** A dynamic content source injected at render time. */
export interface DataSource {
	/** Registered data source provider ID. */
	readonly id: string;
	/** Named slot where content is injected. */
	readonly slot?: string;
	/** Parameters passed to the provider. */
	readonly params?: Readonly<Record<string, unknown>>;
}

// ── Events I/O ──────────────────────────────────────────────────────

/** An event declaration in the input/output contract. */
export interface EventDeclaration {
	/** Event name (e.g., "raid:item-created"). */
	readonly name: string;
	/** Human-readable description. */
	readonly description?: string;
	/** TypeScript type as string (for documentation). */
	readonly payload?: string;
}

// ── Component sub-types ─────────────────────────────────────────────

/** A typed property for Storybook controls and visualization. */
export interface PageProperty {
	readonly key: string;
	readonly type: "string" | "number" | "boolean";
	readonly default?: string | number | boolean;
	readonly description?: string;
}

/** A named preset of property values rendered as an individual Storybook story. */
export interface PageVariant {
	readonly name: string;
	readonly label?: string;
	readonly props: Readonly<Record<string, string | number | boolean>>;
}

/** An interactive state the page/component can be in. */
export interface PageState {
	readonly name: string;
	readonly label?: string;
	readonly description?: string;
	readonly props: Readonly<Record<string, string | number | boolean>>;
}

/** A reference to a child page/component composed into this page. */
export interface PageChild {
	/** Page/component ID reference. */
	readonly ref: string;
	/** Slot or region where the child is placed (e.g., "header", "sidebar", "content"). */
	readonly slot?: string;
	/** Whether the child is optional. */
	readonly optional?: boolean;
}

/** A store (state management) dependency. */
export interface StoreRef {
	readonly name: string;
	readonly technology?: string;
	readonly description?: string;
}

/** An explicit relationship between two pages/components. */
export interface Relationship {
	readonly target: string;
	readonly type: "uses" | "calls" | "depends-on" | "sends-data-to" | "receives-data-from";
	readonly description?: string;
	readonly technology?: string;
}

// ── Conditions ──────────────────────────────────────────────────────

/**
 * Controls when an action/field is disabled.
 * - `boolean`           — literal true/false
 * - `string`            — registered ConditionHandler ID
 * - `{ unless: string }` — expression evaluated against RouterContext
 */
export type DisabledCondition = boolean | string | { readonly unless: string };

/**
 * Controls when an action/field is hidden (not rendered at all).
 * - `boolean` — literal
 * - `string`  — registered ConditionHandler ID
 */
export type HiddenCondition = boolean | string;

// ── Route config ────────────────────────────────────────────────────

/** Web routing configuration for framework code generators. */
export interface RouteConfig {
	readonly path?: string;
	readonly guards?: readonly string[];
	readonly lazy?: boolean;
	readonly redirectTo?: string;
	readonly outlet?: string;
	readonly data?: Readonly<Record<string, unknown>>;
	readonly pathMatch?: "full" | "prefix";
}
