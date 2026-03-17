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

/** Pre-built action sequence template. */
export interface ActionTemplate {
	id: string;
	label: string;
	description: string;
	icon: string;
	actions: JourneyAction[];
}

/** Built-in action templates for quick multi-action creation. */
export const ACTION_TEMPLATES: ActionTemplate[] = [
	{
		id: "open-command",
		label: "Open via command",
		description: "Run a command, wait, then verify the view opened",
		icon: "terminal",
		actions: [
			{ tool: "command", id: "" },
			{ tool: "wait", ms: 500 },
			{ tool: "assert", type: "leaf", viewType: "" },
		],
	},
	{
		id: "click-element",
		label: "Click element",
		description: "Click a UI element and wait for the result",
		icon: "pointer",
		actions: [
			{ tool: "click", selector: "" },
			{ tool: "wait", ms: 300 },
		],
	},
	{
		id: "verify-visible",
		label: "Verify visible",
		description: "Assert that an element is visible on screen",
		icon: "eye",
		actions: [
			{ tool: "assert", type: "visible", selector: "" },
		],
	},
	{
		id: "take-screenshot",
		label: "Take screenshot",
		description: "Capture a labeled screenshot of the current state",
		icon: "camera",
		actions: [
			{ tool: "screenshot", label: "" },
		],
	},
];
