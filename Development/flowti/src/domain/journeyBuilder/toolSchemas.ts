/**
 * Tool schema registry for the Journey Builder action builder.
 *
 * Maps each tool name to its form field definitions. The ActionForm component
 * uses this to render the correct inputs for any tool without per-tool components.
 */

import type { JourneyToolName, ToolCategory, ToolSchemaDef } from "./types";

/** Ordered list of tool categories for UI grouping. */
export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
	{ id: "interaction", label: "Interaction" },
	{ id: "assertion", label: "Assertion" },
	{ id: "lifecycle", label: "Lifecycle" },
	{ id: "feedback", label: "Feedback" },
	{ id: "data", label: "Data" },
];

/** Schema definitions for all 30 journey tools. */
export const TOOL_SCHEMAS: Record<JourneyToolName, ToolSchemaDef> = {
	// ── Interaction ──
	command: {
		name: "command",
		label: "Command",
		category: "interaction",
		fields: [
			{ key: "id", label: "Command ID", type: "text", required: true, placeholder: "e.g. flowti:open-journey-builder" },
		],
	},
	click: {
		name: "click",
		label: "Click",
		category: "interaction",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. .my-button" },
		],
	},
	input: {
		name: "input",
		label: "Input",
		category: "interaction",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. input.my-field" },
			{ key: "value", label: "Value", type: "text", required: true, placeholder: "Text to type" },
		],
	},
	"set-input": {
		name: "set-input",
		label: "Set Input",
		category: "interaction",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. input.my-field" },
			{ key: "value", label: "Value", type: "text", required: true, placeholder: "Value to set" },
			{ key: "dispatchEvent", label: "Dispatch Event", type: "select", options: [
				{ value: "true", label: "Yes" },
				{ value: "false", label: "No" },
			] },
		],
	},
	highlight: {
		name: "highlight",
		label: "Highlight",
		category: "interaction",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. .highlight-target" },
			{ key: "style", label: "Style", type: "select", options: [
				{ value: "element", label: "Element" },
				{ value: "button", label: "Button" },
				{ value: "input", label: "Input" },
			] },
			{ key: "target", label: "Target", type: "select", options: [
				{ value: "dom", label: "DOM" },
				{ value: "webview", label: "Webview" },
			] },
			{ key: "duration", label: "Duration (ms)", type: "number", placeholder: "Auto-remove after ms" },
		],
	},
	navigate: {
		name: "navigate",
		label: "Navigate",
		category: "interaction",
		fields: [
			{ key: "hub", label: "Hub ID", type: "text", required: true, placeholder: "e.g. flowti-user-hub" },
			{ key: "viewType", label: "View Type", type: "text", required: true, placeholder: "e.g. flowti-user-hub" },
			{ key: "tab", label: "Tab ID", type: "text", required: true, placeholder: "e.g. sessions" },
		],
	},
	ribbon: {
		name: "ribbon",
		label: "Ribbon",
		category: "interaction",
		fields: [
			{ key: "label", label: "Aria Label", type: "text", required: true, placeholder: "Partial match against aria-label" },
		],
	},
	"scroll-to": {
		name: "scroll-to",
		label: "Scroll To",
		category: "interaction",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. .scroll-target" },
			{ key: "target", label: "Target", type: "select", options: [
				{ value: "dom", label: "DOM" },
				{ value: "webview", label: "Webview" },
			] },
			{ key: "behavior", label: "Behavior", type: "select", options: [
				{ value: "smooth", label: "Smooth" },
				{ value: "instant", label: "Instant" },
			] },
			{ key: "block", label: "Block", type: "select", options: [
				{ value: "start", label: "Start" },
				{ value: "center", label: "Center" },
				{ value: "end", label: "End" },
				{ value: "nearest", label: "Nearest" },
			] },
		],
	},

	// ── Assertion ──
	assert: {
		name: "assert",
		label: "Assert",
		category: "assertion",
		fields: [
			{ key: "type", label: "Type", type: "select", required: true, options: [
				{ value: "visible", label: "Visible" },
				{ value: "not-visible", label: "Not Visible" },
				{ value: "text", label: "Text" },
				{ value: "event", label: "Event" },
				{ value: "leaf", label: "Leaf" },
				{ value: "eval", label: "Eval" },
				{ value: "count", label: "Count" },
				{ value: "attr", label: "Attribute" },
			] },
			{ key: "selector", label: "CSS Selector", type: "text", placeholder: "For visible/not-visible/text/count/attr" },
			{ key: "contains", label: "Contains", type: "text", placeholder: "Expected text content" },
			{ key: "event", label: "Event Name", type: "text", placeholder: "For event assertion" },
			{ key: "viewType", label: "View Type", type: "text", placeholder: "For leaf assertion" },
			{ key: "code", label: "Code", type: "textarea", placeholder: "JavaScript for eval assertion" },
			{ key: "expected", label: "Expected", type: "text", placeholder: "Expected eval result" },
			{ key: "count", label: "Count", type: "number", placeholder: "Expected element count" },
			{ key: "attr", label: "Attribute", type: "text", placeholder: "Attribute name" },
			{ key: "value", label: "Value", type: "text", placeholder: "Expected attribute value" },
		],
	},
	"assert-text": {
		name: "assert-text",
		label: "Assert Text",
		category: "assertion",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. .my-element" },
			{ key: "contains", label: "Contains", type: "text", required: true, placeholder: "Expected text" },
		],
	},
	"assert-number": {
		name: "assert-number",
		label: "Assert Number",
		category: "assertion",
		fields: [
			{ key: "selector", label: "CSS Selector", type: "text", required: true, placeholder: "e.g. .counter" },
			{ key: "operator", label: "Operator", type: "select", required: true, options: [
				{ value: "eq", label: "Equals (==)" },
				{ value: "gt", label: "Greater than (>)" },
				{ value: "gte", label: "Greater or equal (>=)" },
				{ value: "lt", label: "Less than (<)" },
				{ value: "lte", label: "Less or equal (<=)" },
			] },
			{ key: "value", label: "Value", type: "number", required: true, placeholder: "Number to compare" },
		],
	},

	// ── Lifecycle ──
	"create-file": {
		name: "create-file",
		label: "Create File",
		category: "lifecycle",
		fields: [
			{ key: "path", label: "Path", type: "text", required: true, placeholder: "Vault-relative path" },
			{ key: "content", label: "Content", type: "textarea", required: true, placeholder: "File content" },
			{ key: "store", label: "Store As", type: "text", placeholder: "Variable name for created path" },
		],
	},
	"delete-file": {
		name: "delete-file",
		label: "Delete File",
		category: "lifecycle",
		fields: [
			{ key: "path", label: "Path", type: "text", required: true, placeholder: "Vault-relative path" },
		],
	},
	"open-file": {
		name: "open-file",
		label: "Open File",
		category: "lifecycle",
		fields: [
			{ key: "path", label: "Path", type: "text", required: true, placeholder: "Vault-relative path" },
		],
	},
	"open-url": {
		name: "open-url",
		label: "Open URL",
		category: "lifecycle",
		fields: [
			{ key: "url", label: "URL", type: "text", required: true, placeholder: "https://..." },
		],
	},
	"close-leaves": {
		name: "close-leaves",
		label: "Close Leaves",
		category: "lifecycle",
		fields: [
			{ key: "viewType", label: "View Type", type: "text", required: true, placeholder: "e.g. flowti-user-hub" },
		],
	},
	"close-modals": {
		name: "close-modals",
		label: "Close Modals",
		category: "lifecycle",
		fields: [],
	},
	seed: {
		name: "seed",
		label: "Seed",
		category: "lifecycle",
		fields: [
			{ key: "id", label: "Seed ID", type: "text", required: true, placeholder: "e.g. welcome-note" },
			{ key: "mode", label: "Mode", type: "select", options: [
				{ value: "create", label: "Create" },
				{ value: "verify", label: "Verify" },
				{ value: "delete", label: "Delete" },
			] },
		],
	},

	// ── Feedback ──
	wait: {
		name: "wait",
		label: "Wait",
		category: "feedback",
		fields: [
			{ key: "ms", label: "Duration (ms)", type: "number", required: true, placeholder: "e.g. 500" },
		],
	},
	screenshot: {
		name: "screenshot",
		label: "Screenshot",
		category: "feedback",
		fields: [
			{ key: "label", label: "Label", type: "text", placeholder: "Filename label (auto-numbered if omitted)" },
		],
	},
	notice: {
		name: "notice",
		label: "Notice",
		category: "feedback",
		fields: [
			{ key: "message", label: "Message", type: "text", required: true, placeholder: "Toast message" },
			{ key: "duration", label: "Duration (ms)", type: "number", placeholder: "Default: 5000" },
			{ key: "style", label: "Style", type: "select", options: [
				{ value: "success", label: "Success" },
				{ value: "error", label: "Error" },
			] },
		],
	},
	theme: {
		name: "theme",
		label: "Theme",
		category: "feedback",
		fields: [
			{ key: "theme", label: "Theme", type: "text", required: true, placeholder: "e.g. obsidian, moonstone" },
		],
	},
	manual: {
		name: "manual",
		label: "Manual",
		category: "feedback",
		fields: [
			{ key: "instruction", label: "Instruction", type: "textarea", required: true, placeholder: "What the operator should do" },
			{ key: "timeout", label: "Timeout (ms)", type: "number", placeholder: "Default: 300000" },
			{ key: "interactive", label: "Interactive", type: "select", options: [
				{ value: "true", label: "Yes" },
				{ value: "false", label: "No" },
			] },
		],
	},
	"visual-inspection": {
		name: "visual-inspection",
		label: "Visual Inspection",
		category: "feedback",
		fields: [
			{ key: "prompt", label: "Prompt", type: "textarea", required: true, placeholder: "What to inspect" },
			{ key: "timeout", label: "Timeout (ms)", type: "number", placeholder: "Default: 300000" },
			{ key: "interactive", label: "Interactive", type: "select", options: [
				{ value: "true", label: "Yes" },
				{ value: "false", label: "No" },
			] },
		],
	},
	spinner: {
		name: "spinner",
		label: "Spinner",
		category: "feedback",
		fields: [
			{ key: "id", label: "Spinner ID", type: "text", required: true, placeholder: "Unique ID for start/stop" },
			{ key: "mode", label: "Mode", type: "select", required: true, options: [
				{ value: "start", label: "Start" },
				{ value: "stop", label: "Stop" },
			] },
			{ key: "message", label: "Message", type: "text", placeholder: "Spinner message (start only)" },
		],
	},
	"write-run-log": {
		name: "write-run-log",
		label: "Write Run Log",
		category: "feedback",
		fields: [
			{ key: "message", label: "Message", type: "textarea", required: true, placeholder: "Log line to append" },
		],
	},

	// ── Data ──
	emit: {
		name: "emit",
		label: "Emit",
		category: "data",
		fields: [
			{ key: "event", label: "Event Name", type: "text", required: true, placeholder: "e.g. session.start" },
		],
	},
	eval: {
		name: "eval",
		label: "Eval",
		category: "data",
		fields: [
			{ key: "code", label: "Code", type: "textarea", required: true, placeholder: "JavaScript to execute" },
			{ key: "store", label: "Store As", type: "text", placeholder: "Variable name for result" },
		],
	},
	frontmatter: {
		name: "frontmatter",
		label: "Frontmatter",
		category: "data",
		fields: [
			{ key: "path", label: "Path", type: "text", required: true, placeholder: "Vault-relative path" },
			{ key: "mode", label: "Mode", type: "select", required: true, options: [
				{ value: "set", label: "Set" },
				{ value: "read", label: "Read" },
			] },
			{ key: "property", label: "Property", type: "text", required: true, placeholder: "YAML property name" },
			{ key: "value", label: "Value", type: "text", placeholder: "For set mode" },
			{ key: "store", label: "Store As", type: "text", placeholder: "Variable name (read mode)" },
		],
	},
	"query-trace": {
		name: "query-trace",
		label: "Query Trace",
		category: "data",
		fields: [
			{ key: "event", label: "Event Type", type: "text", required: true, placeholder: "Event type to search" },
			{ key: "limit", label: "Limit", type: "number", placeholder: "Default: 10" },
			{ key: "store", label: "Store As", type: "text", placeholder: "Variable name for result" },
		],
	},
};

/** Returns tool schemas for a given category, sorted by label. */
export function getToolsByCategory(category: ToolCategory): ToolSchemaDef[] {
	return Object.values(TOOL_SCHEMAS)
		.filter((s) => s.category === category)
		.sort((a, b) => a.label.localeCompare(b.label));
}
