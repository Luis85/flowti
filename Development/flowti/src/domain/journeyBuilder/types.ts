/**
 * Domain types for the Journey Builder action system.
 *
 * These types define the runtime schema for building journey actions visually.
 * The produced JSON matches the format consumed by the E2E journey runner.
 */

/** All tool names supported by the journey runner. */
export type JourneyToolName =
	| "command" | "click" | "input" | "set-input" | "highlight"
	| "wait" | "screenshot" | "navigate" | "assert" | "assert-text"
	| "assert-number" | "assert-value" | "emit" | "eval" | "manual" | "notice"
	| "theme" | "ribbon" | "create-file" | "delete-file" | "copy-file"
	| "move-file" | "open-file" | "open-url" | "close-leaves" | "close-modals"
	| "seed" | "select" | "frontmatter" | "query-trace" | "write-run-log"
	| "scroll-to" | "visual-inspection" | "spinner";

/** A single action in a journey step. */
export interface JourneyAction {
	tool: JourneyToolName;
	description?: string;
	[key: string]: unknown;
}

/** Tool categories for grouping in the UI. */
export type ToolCategory = "interaction" | "assertion" | "lifecycle" | "feedback" | "data";

/** Field definition for rendering a tool's form. */
export interface ToolFieldDef {
	key: string;
	label: string;
	type: "text" | "number" | "select" | "textarea";
	required?: boolean;
	placeholder?: string;
	options?: { value: string; label: string }[];
	/** When set, field is only visible if action[field] matches one of values. */
	visibleWhen?: { field: string; values: string[] };
}

/** Complete tool schema entry. */
export interface ToolSchemaDef {
	name: JourneyToolName;
	label: string;
	category: ToolCategory;
	fields: ToolFieldDef[];
}
