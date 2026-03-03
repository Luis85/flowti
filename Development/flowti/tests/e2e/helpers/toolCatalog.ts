/**
 * Tool catalog — source of truth for Journey Runner tool metadata.
 *
 * Each tool entry defines its name, description, tags, use-cases, params, and examples.
 * Tags classify tools by purpose (e.g. "lifecycle" for setup/teardown-specific tools).
 * Use-cases document when and why to reach for each tool.
 * Params document the configuration options for each tool.
 * Examples show concrete JSON action snippets for the Tool Reference.
 *
 * Consumed by:
 *   - Report generator (tool tags, descriptions in reports/canvas)
 *   - Validation (ensure all tools are registered)
 *   - Documentation (PRD Tool Reference syncs from this catalog)
 */
import type { ToolName } from "./journeyTypes";

// ─── Tool metadata ──────────────────────────────────────────────────

export interface ToolParam {
	/** Parameter name as used in the JSON action. */
	name: string;
	/** Data type: "string", "number", "boolean", "object". */
	type: string;
	/** Whether this parameter is required. */
	required: boolean;
	/** Short description of the parameter. */
	description: string;
	/** Allowed values for enum-like parameters. */
	values?: string[];
}

export interface ToolExample {
	/** Short label describing what this example does. */
	title: string;
	/** The action JSON object as it appears in a journey step. */
	action: Record<string, unknown>;
}

export interface ToolMeta {
	/** Tool name matching the ToolName union. */
	name: ToolName;
	/** Short description of what the tool does. */
	description: string;
	/** Classification tags. e.g. ["lifecycle"] for setup/teardown-specific tools. */
	tags: string[];
	/** Human-readable use-case descriptions — when and why to use this tool. */
	useCases: string[];
	/** Configuration parameters — documents the tool's JSON action fields. */
	params: ToolParam[];
	/** Example action snippets — shown in the generated Tool Reference. */
	examples: ToolExample[];
}

// ─── Catalog ────────────────────────────────────────────────────────

export const TOOL_CATALOG: Record<ToolName, ToolMeta> = {
	command: {
		name: "command",
		description: "Execute an Obsidian command by ID",
		tags: [],
		useCases: [
			"Open a hub view via command palette",
			"Trigger plugin commands (e.g. start session, open settings)",
			"Execute built-in Obsidian commands",
		],
		params: [
			{ name: "id", type: "string", required: true, description: "Command ID (e.g. \"flowti:open-user-hub\")" },
		],
		examples: [
			{
				title: "Open the User Hub view",
				action: { tool: "command", id: "flowti:open-user-hub" },
			},
			{
				title: "Start a new session",
				action: { tool: "command", id: "flowti:start-session" },
			},
		],
	},
	click: {
		name: "click",
		description: "Click a DOM element by CSS selector",
		tags: [],
		useCases: [
			"Dismiss a modal or dialog",
			"Select a template card or list item",
			"Press a button in the UI",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the element to click" },
		],
		examples: [
			{
				title: "Click the primary action button",
				action: { tool: "click", selector: ".mod-cta" },
			},
			{
				title: "Select a list item by test ID",
				action: { tool: "click", selector: "[data-test-id='item-1']" },
			},
		],
	},
	input: {
		name: "input",
		description: "Type text into an input field",
		tags: [],
		useCases: [
			"Fill a form field (e.g. session goal, file name)",
			"Enter a search query in the command palette",
			"Type filter text in a hub search bar",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the input element" },
			{ name: "value", type: "string", required: true, description: "Text to type into the input" },
		],
		examples: [
			{
				title: "Type a search query",
				action: { tool: "input", selector: "[data-test-id='search']", value: "analytics" },
			},
		],
	},
	highlight: {
		name: "highlight",
		description: "Add visual CSS annotation to a DOM element",
		tags: [],
		useCases: [
			"Annotate UI elements for screenshot documentation",
			"Draw attention to active tab or selected item (element style)",
			"Show button interaction targets with animated pulse (button style)",
			"Indicate input focus state with glow effect (input style)",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the element to highlight" },
			{ name: "style", type: "string", required: false, description: "Highlight style (default: \"element\")", values: ["element", "button", "input"] },
			{ name: "target", type: "string", required: false, description: "DOM context (default: \"dom\")", values: ["dom", "webview"] },
			{ name: "duration", type: "number", required: false, description: "Auto-remove after this many ms (omit to persist)" },
		],
		examples: [
			{
				title: "Highlight the active tab",
				action: { tool: "highlight", selector: ".ft-tab.is-active", style: "element" },
			},
			{
				title: "Pulse a button target",
				action: { tool: "highlight", selector: ".ft-btn-primary", style: "button" },
			},
		],
	},
	wait: {
		name: "wait",
		description: "Pause execution for a specified duration",
		tags: [],
		useCases: [
			"Wait for async rendering or DOM updates to settle",
			"Allow theme transition CSS animations to complete",
			"Give Obsidian time to index a newly created file",
		],
		params: [
			{ name: "ms", type: "number", required: true, description: "Milliseconds to wait" },
		],
		examples: [
			{
				title: "Wait for UI to settle",
				action: { tool: "wait", ms: 500 },
			},
		],
	},
	screenshot: {
		name: "screenshot",
		description: "Capture a labeled screenshot of the current state",
		tags: [],
		useCases: [
			"Document UI state for journey reports and canvases",
			"Create before/after comparisons (e.g. theme switching)",
			"Capture transient UI states (modals, notices, highlights)",
		],
		params: [
			{ name: "label", type: "string", required: false, description: "Label for filename: {stepId}--{label}.png (auto-numbered if omitted)" },
		],
		examples: [
			{
				title: "Capture the hub overview",
				action: { tool: "screenshot", label: "hub-overview" },
			},
		],
	},
	navigate: {
		name: "navigate",
		description: "Navigate to a hub tab via the EventBus",
		tags: [],
		useCases: [
			"Switch tabs within a hub view",
			"Verify hub.tab.changed events in the event trace",
			"Set up a specific tab context before testing its content",
		],
		params: [
			{ name: "hub", type: "string", required: true, description: "Hub ID (e.g. \"flowti-user-hub\")" },
			{ name: "viewType", type: "string", required: true, description: "View type (e.g. \"flowti-user-hub\")" },
			{ name: "tab", type: "string", required: true, description: "Tab ID (e.g. \"sessions\")" },
		],
		examples: [
			{
				title: "Switch to the Sessions tab",
				action: { tool: "navigate", hub: "flowti-user-hub", viewType: "flowti-user-hub", tab: "sessions" },
			},
		],
	},
	assert: {
		name: "assert",
		description: "Validate DOM, event, or eval state",
		tags: [],
		useCases: [
			"Check element visibility or absence (visible, not-visible)",
			"Verify text content of a DOM element (text)",
			"Confirm an event was emitted with expected payload (event)",
			"Assert a workspace leaf exists by view type (leaf)",
			"Evaluate a JavaScript expression and compare result (eval)",
		],
		params: [
			{ name: "type", type: "string", required: true, description: "Assertion type", values: ["visible", "not-visible", "text", "event", "leaf", "eval", "count", "attr"] },
			{ name: "selector", type: "string", required: false, description: "CSS selector (for visible, not-visible, text, count, attr)" },
			{ name: "contains", type: "string", required: false, description: "Expected text substring (for text)" },
			{ name: "event", type: "string", required: false, description: "Event name (for event)" },
			{ name: "payload", type: "object", required: false, description: "Expected event payload fields (for event)" },
			{ name: "viewType", type: "string", required: false, description: "View type (for leaf)" },
			{ name: "code", type: "string", required: false, description: "JavaScript expression (for eval)" },
			{ name: "expected", type: "string", required: false, description: "Expected eval result (for eval)" },
			{ name: "count", type: "number", required: false, description: "Expected element count (for count)" },
			{ name: "attr", type: "string", required: false, description: "Attribute name (for attr)" },
			{ name: "value", type: "string", required: false, description: "Expected attribute value (for attr)" },
		],
		examples: [
			{
				title: "Check element is visible",
				action: { tool: "assert", type: "visible", selector: ".ft-hub" },
			},
			{
				title: "Verify event was emitted",
				action: { tool: "assert", type: "event", event: "hub.tab.changed" },
			},
		],
	},
	emit: {
		name: "emit",
		description: "Emit an event on the plugin EventBus",
		tags: [],
		useCases: [
			"Trigger domain event handlers (e.g. session.pause)",
			"Simulate user actions via events",
			"Test event-driven workflows with custom payloads",
		],
		params: [
			{ name: "event", type: "string", required: true, description: "EventBus event name" },
			{ name: "payload", type: "object", required: false, description: "Event payload (string values support {{variable}} interpolation)" },
		],
		examples: [
			{
				title: "Emit a tab change event",
				action: { tool: "emit", event: "hub.tab.changed", payload: { hub: "user-hub", tab: "sessions" } },
			},
		],
	},
	eval: {
		name: "eval",
		description: "Execute JavaScript in Obsidian and optionally store the result",
		tags: [],
		useCases: [
			"Query plugin state (e.g. active session, settings)",
			"Store values for cross-step variable passing",
			"Perform complex operations not covered by other tools",
		],
		params: [
			{ name: "code", type: "string", required: true, description: "JavaScript code to execute (supports {{variable}} interpolation)" },
			{ name: "store", type: "string", required: false, description: "Store the result in a named variable" },
			{ name: "expect", type: "object", required: false, description: "Assertion on the result: { type: \"equals\", value } | { type: \"truthy\" } | { type: \"json\", match }" },
		],
		examples: [
			{
				title: "Store the event trace length",
				action: { tool: "eval", code: "window._e2eEventTrace.length", store: "traceCount" },
			},
			{
				title: "Assert a boolean expression",
				action: { tool: "eval", code: "window._flowtiInstalled === true", expect: { type: "truthy" } },
			},
		],
	},
	manual: {
		name: "manual",
		description: "Document a human QA checkpoint",
		tags: [],
		useCases: [
			"Visual regression review (compare screenshots to expected layout)",
			"Verify content correctness that automated assertions can't check",
			"Cross-reference multiple screenshots within a step",
		],
		params: [
			{ name: "instruction", type: "string", required: true, description: "What the operator should do manually" },
			{ name: "timeout", type: "number", required: false, description: "Timeout in ms before auto-failing (default: 300000)" },
			{ name: "interactive", type: "boolean", required: false, description: "If false, auto-approve — appears only on reports (default: true)" },
		],
		examples: [
			{
				title: "Visual regression checkpoint",
				action: { tool: "manual", instruction: "Verify the dashboard layout matches the design mockup" },
			},
		],
	},
	notice: {
		name: "notice",
		description: "Display an Obsidian notice toast message",
		tags: [],
		useCases: [
			"Annotate test progress in screenshots (e.g. 'Step 3/10')",
			"Show step status or summary for visual documentation",
			"Display interpolated variable values for debugging",
		],
		params: [
			{ name: "message", type: "string", required: true, description: "Message to display (supports {{variable}} interpolation)" },
			{ name: "duration", type: "number", required: false, description: "Duration in ms (default: 5000)" },
			{ name: "style", type: "string", required: false, description: "Visual style", values: ["success", "error"] },
		],
		examples: [
			{
				title: "Show step progress",
				action: { tool: "notice", message: "Step 3/10 — Verifying tabs" },
			},
			{
				title: "Show a success message",
				action: { tool: "notice", message: "All checks passed!", style: "success" },
			},
		],
	},
	theme: {
		name: "theme",
		description: "Switch Obsidian's CSS theme",
		tags: [],
		useCases: [
			"Dark/light mode comparison screenshots",
			"Verify theme-aware styling in Flowti components",
			"Set a consistent baseline theme before screenshot capture",
		],
		params: [
			{ name: "theme", type: "string", required: true, description: "Theme name (\"obsidian\" for dark, \"moonstone\" for light)" },
		],
		examples: [
			{
				title: "Switch to dark mode",
				action: { tool: "theme", theme: "obsidian" },
			},
			{
				title: "Switch to light mode",
				action: { tool: "theme", theme: "moonstone" },
			},
		],
	},
	ribbon: {
		name: "ribbon",
		description: "Click a ribbon button by aria-label with visual highlight",
		tags: [],
		useCases: [
			"Click a ribbon sidebar icon to open a hub view",
			"Demonstrate ribbon button interaction with purple pulse highlight",
			"Verify ribbon buttons are accessible and clickable",
		],
		params: [
			{ name: "label", type: "string", required: true, description: "Text to match against the ribbon button's aria-label (partial match)" },
		],
		examples: [
			{
				title: "Click the Flowti ribbon button",
				action: { tool: "ribbon", label: "Open Flowti" },
			},
		],
	},
	"create-file": {
		name: "create-file",
		description: "Create a file in the vault via the Obsidian API",
		tags: ["lifecycle"],
		useCases: [
			"Seed test data files during setup",
			"Create markdown or CSV content for journey steps to interact with",
			"Scaffold vault folder structure before testing",
		],
		params: [
			{ name: "path", type: "string", required: true, description: "Vault-relative path for the new file (supports {{variable}})" },
			{ name: "content", type: "string", required: true, description: "File content (supports {{variable}})" },
			{ name: "store", type: "string", required: false, description: "Store the created path in a named variable" },
		],
		examples: [
			{
				title: "Create a test markdown file",
				action: { tool: "create-file", path: "test/sample.md", content: "# Sample\nTest content" },
			},
		],
	},
	"delete-file": {
		name: "delete-file",
		description: "Delete a vault file via the Obsidian API",
		tags: ["lifecycle"],
		useCases: [
			"Clean up test files during teardown",
			"Remove seed data after a journey completes",
			"Reset vault to pre-test state",
		],
		params: [
			{ name: "path", type: "string", required: true, description: "Vault-relative path of the file to delete (supports {{variable}})" },
		],
		examples: [
			{
				title: "Clean up a test file",
				action: { tool: "delete-file", path: "test/sample.md" },
			},
		],
	},
	"copy-file": {
		name: "copy-file",
		description: "Copy a file on the filesystem (absolute or vault-relative paths)",
		tags: ["lifecycle"],
		useCases: [
			"Duplicate a seed file to a new location during setup",
			"Back up a file before modifying it in a test",
			"Copy files between vault and non-vault locations",
		],
		params: [
			{ name: "from", type: "string", required: true, description: "Source file path — absolute or vault-relative (supports {{variable}})" },
			{ name: "to", type: "string", required: true, description: "Destination file path — absolute or vault-relative (supports {{variable}})" },
		],
		examples: [
			{
				title: "Copy a file within the vault",
				action: { tool: "copy-file", from: "templates/default.md", to: "test/copy.md" },
			},
			{
				title: "Copy from an absolute path",
				action: { tool: "copy-file", from: "C:/backups/config.json", to: "test/config.json" },
			},
		],
	},
	"move-file": {
		name: "move-file",
		description: "Move or rename a file on the filesystem (absolute or vault-relative paths)",
		tags: ["lifecycle"],
		useCases: [
			"Rename a file during test setup or teardown",
			"Move files between vault and non-vault locations",
			"Relocate generated artifacts to a different folder",
		],
		params: [
			{ name: "from", type: "string", required: true, description: "Source file path — absolute or vault-relative (supports {{variable}})" },
			{ name: "to", type: "string", required: true, description: "Destination file path — absolute or vault-relative (supports {{variable}})" },
		],
		examples: [
			{
				title: "Rename a file",
				action: { tool: "move-file", from: "test/draft.md", to: "test/final.md" },
			},
			{
				title: "Move a file to an absolute path",
				action: { tool: "move-file", from: "test/export.csv", to: "C:/exports/export.csv" },
			},
		],
	},
	"open-file": {
		name: "open-file",
		description: "Open a vault file in an editor tab",
		tags: ["lifecycle"],
		useCases: [
			"Open a created file for visual verification",
			"Navigate to a specific vault file before testing",
			"Set up editor state with a target file open",
		],
		params: [
			{ name: "path", type: "string", required: true, description: "Vault-relative path of the file to open (supports {{variable}})" },
		],
		examples: [
			{
				title: "Open a vault file in the editor",
				action: { tool: "open-file", path: "test/sample.md" },
			},
		],
	},
	"open-url": {
		name: "open-url",
		description: "Open a URL in the Obsidian WebViewer via CLI 'web' command",
		tags: ["lifecycle"],
		useCases: [
			"Open external documentation or web resources during a journey",
			"Navigate to a web-based dashboard or API endpoint",
			"Verify WebViewer integration with external URLs",
		],
		params: [
			{ name: "url", type: "string", required: true, description: "URL to open (supports {{variable}})" },
		],
		examples: [
			{
				title: "Open an external URL",
				action: { tool: "open-url", url: "https://docs.example.com" },
			},
		],
	},
	"close-leaves": {
		name: "close-leaves",
		description: "Close all workspace leaves of a given view type",
		tags: ["lifecycle"],
		useCases: [
			"Clean up hub views during teardown",
			"Reset workspace layout between journey sections",
			"Close stale leaves that persist across steps",
		],
		params: [
			{ name: "viewType", type: "string", required: true, description: "View type of leaves to close (e.g. \"flowti-user-hub\")" },
		],
		examples: [
			{
				title: "Close all User Hub leaves",
				action: { tool: "close-leaves", viewType: "flowti-user-hub" },
			},
		],
	},
	"close-modals": {
		name: "close-modals",
		description: "Close all open Obsidian modals and dialogs",
		tags: ["lifecycle"],
		useCases: [
			"Dismiss stale modals during teardown",
			"Reset UI state between journey steps",
			"Ensure a clean workspace before assertions",
		],
		params: [],
		examples: [
			{
				title: "Dismiss all open modals",
				action: { tool: "close-modals" },
			},
		],
	},
	seed: {
		name: "seed",
		description: "Create, verify, or delete seed files from the centralized registry",
		tags: ["lifecycle"],
		useCases: [
			"Verify seed files exist in skip mode (mode: verify)",
			"Remove seed files before a fresh install (mode: delete)",
			"Repair missing seed files and folders (mode: create)",
		],
		params: [
			{ name: "id", type: "string", required: true, description: "Seed file identifier (e.g. \"welcome-note\", \"all\", \"folders\")" },
			{ name: "mode", type: "string", required: false, description: "Operation mode (default: \"create\")", values: ["create", "verify", "delete"] },
		],
		examples: [
			{
				title: "Create all seed data",
				action: { tool: "seed", id: "all", mode: "create" },
			},
			{
				title: "Verify seed files exist",
				action: { tool: "seed", id: "all", mode: "verify" },
			},
		],
	},
	"set-input": {
		name: "set-input",
		description: "Set an input value using React-compatible native setter with input/change events",
		tags: [],
		useCases: [
			"Set values on React-controlled inputs where insertText doesn't propagate",
			"Update input fields that use synthetic event handlers",
			"Set values on textarea or input elements with proper event dispatch",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the input element" },
			{ name: "value", type: "string", required: true, description: "Value to set (supports {{variable}})" },
			{ name: "dispatchEvent", type: "boolean", required: false, description: "Dispatch input/change events (default: true)" },
		],
		examples: [
			{
				title: "Set a form field value",
				action: { tool: "set-input", selector: "[data-test-id='name']", value: "My Session" },
			},
		],
	},
	frontmatter: {
		name: "frontmatter",
		description: "Read or set YAML frontmatter properties on a vault file",
		tags: [],
		useCases: [
			"Set a frontmatter property for test setup (mode: set)",
			"Read a frontmatter value into a variable for downstream assertions (mode: read)",
			"Verify frontmatter was updated by a previous step",
		],
		params: [
			{ name: "path", type: "string", required: true, description: "Vault-relative path of the file (supports {{variable}})" },
			{ name: "mode", type: "string", required: true, description: "Operation mode", values: ["set", "read"] },
			{ name: "property", type: "string", required: true, description: "Frontmatter property name" },
			{ name: "value", type: "string", required: false, description: "Property value (for \"set\" mode, supports {{variable}})" },
			{ name: "store", type: "string", required: false, description: "Store the read value in a named variable (for \"read\" mode)" },
		],
		examples: [
			{
				title: "Set a frontmatter property",
				action: { tool: "frontmatter", path: "file.md", mode: "set", property: "status", value: "active" },
			},
			{
				title: "Read a frontmatter value into a variable",
				action: { tool: "frontmatter", path: "file.md", mode: "read", property: "status", store: "fileStatus" },
			},
		],
	},
	"query-trace": {
		name: "query-trace",
		description: "Query the E2E event trace for events of a specific type",
		tags: [],
		useCases: [
			"Retrieve events emitted during a step for variable interpolation",
			"Count how many times a specific event was emitted",
			"Extract event payloads for cross-step data passing",
		],
		params: [
			{ name: "event", type: "string", required: true, description: "Event type to search for (supports {{variable}})" },
			{ name: "limit", type: "number", required: false, description: "Maximum number of events to return (default: 10)" },
			{ name: "store", type: "string", required: false, description: "Store the JSON result in a named variable" },
		],
		examples: [
			{
				title: "Query emitted tab-change events",
				action: { tool: "query-trace", event: "hub.tab.changed", store: "tabEvents" },
			},
		],
	},
	"write-run-log": {
		name: "write-run-log",
		description: "Append a line to the E2E Test Run log file at the vault root",
		tags: ["logging"],
		useCases: [
			"Log step results to E2E Test Run.md for live visibility",
			"Write chapter headers to structure the run log",
			"Record pass/fail details for post-run review",
		],
		params: [
			{ name: "message", type: "string", required: true, description: "Log line to append (supports {{variable}})" },
		],
		examples: [
			{
				title: "Write a chapter header",
				action: { tool: "write-run-log", message: "## Chapter 1: Setup" },
			},
		],
	},
	"visual-inspection": {
		name: "visual-inspection",
		description: "Show a pass/fail notice for operator visual inspection; on fail, prompt for reason",
		tags: ["interactive"],
		useCases: [
			"Verify visual layout or styling that cannot be asserted programmatically",
			"Confirm a rendered view matches design expectations",
			"Interactive QA gate with documented failure reason",
		],
		params: [
			{ name: "prompt", type: "string", required: true, description: "Prompt describing what to inspect (supports {{variable}})" },
			{ name: "timeout", type: "number", required: false, description: "Timeout in ms before auto-failing (default: 300000)" },
			{ name: "interactive", type: "boolean", required: false, description: "If false, auto-approve — appears only on reports (default: true)" },
		],
		examples: [
			{
				title: "Interactive visual QA gate",
				action: { tool: "visual-inspection", prompt: "Does the dashboard layout match the design?" },
			},
		],
	},
	"scroll-to": {
		name: "scroll-to",
		description: "Scroll an element into view in the DOM or inside a webview",
		tags: ["navigation"],
		useCases: [
			"Scroll to a specific section before taking a screenshot",
			"Bring a deeply nested element into the visible viewport",
			"Scroll inside a webview to reveal content below the fold",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the element to scroll into view" },
			{ name: "target", type: "string", required: false, description: "DOM context (default: \"dom\")", values: ["dom", "webview"] },
			{ name: "behavior", type: "string", required: false, description: "Scroll behavior (default: \"smooth\")", values: ["smooth", "instant"] },
			{ name: "block", type: "string", required: false, description: "Vertical alignment (default: \"center\")", values: ["start", "center", "end", "nearest"] },
		],
		examples: [
			{
				title: "Scroll an element into view",
				action: { tool: "scroll-to", selector: ".ft-footer", behavior: "smooth" },
			},
		],
	},
	"assert-text": {
		name: "assert-text",
		description: "Assert that an element's text content contains an expected string",
		tags: ["assert"],
		useCases: [
			"Verify a counter or label shows the expected text (e.g. 'Step 1 of 3')",
			"Check that a heading, badge, or status message contains expected content",
			"Safer alternative to assert type:text — requires 'contains' field, preventing field-name mistakes",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the element to check" },
			{ name: "contains", type: "string", required: true, description: "Expected text (checked via textContent.includes)" },
		],
		examples: [
			{
				title: "Verify label text",
				action: { tool: "assert-text", selector: ".ft-badge", contains: "3 items" },
			},
		],
	},
	"assert-number": {
		name: "assert-number",
		description: "Assert that an element's text content parses to a number matching a comparison",
		tags: ["assert"],
		useCases: [
			"Verify a count badge shows at least N items (gte)",
			"Assert a KPI card value equals a specific number (eq)",
			"Check that a progress indicator is below a threshold (lt, lte)",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the element whose textContent is parsed as a number" },
			{ name: "operator", type: "string", required: true, description: "Comparison operator", values: ["eq", "gt", "gte", "lt", "lte"] },
			{ name: "value", type: "number", required: true, description: "Value to compare against" },
		],
		examples: [
			{
				title: "Check count is at least 5",
				action: { tool: "assert-number", selector: ".ft-count", operator: "gte", value: 5 },
			},
		],
	},
	"assert-value": {
		name: "assert-value",
		description: "Assert that a form element's value matches an expected string",
		tags: ["assert"],
		useCases: [
			"Verify an input or textarea contains the expected value after set-input",
			"Check that a select dropdown has the correct selected option",
			"Confirm form field values are populated correctly after loading data",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the input, textarea, or select element" },
			{ name: "equals", type: "string", required: false, description: "Expected exact value (el.value === expected)" },
			{ name: "contains", type: "string", required: false, description: "Expected substring (el.value.includes(substr))" },
		],
		examples: [
			{
				title: "Verify input value matches exactly",
				action: { tool: "assert-value", selector: "input[data-test-id='name']", equals: "My Journey" },
			},
			{
				title: "Check textarea contains text",
				action: { tool: "assert-value", selector: "textarea.description", contains: "step" },
			},
		],
	},
	select: {
		name: "select",
		description: "Select an option from a <select> dropdown by value",
		tags: [],
		useCases: [
			"Choose a tool from a grouped select picker",
			"Select a swimlane, category, or type from a dropdown",
			"Set a dropdown value with proper change event dispatch",
		],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector for the <select> element" },
			{ name: "value", type: "string", required: true, description: "The option value to select" },
		],
		examples: [
			{
				title: "Select a dropdown option",
				action: { tool: "select", selector: "[data-test-id='tool-select']", value: "click" },
			},
		],
	},
	spinner: {
		name: "spinner",
		description: "Show or hide a persistent loading spinner notice",
		tags: ["feedback"],
		useCases: [
			"Indicate a long-running operation is in progress",
			"Show a spinner before a multi-action sequence and dismiss it when done",
			"Give the operator visual feedback while waiting for async work",
		],
		params: [
			{ name: "id", type: "string", required: true, description: "Unique ID to match start/stop pairs" },
			{ name: "mode", type: "string", required: true, description: "Show or dismiss the spinner", values: ["start", "stop"] },
			{ name: "message", type: "string", required: false, description: "Message shown alongside the spinner (start only, supports {{variable}})" },
		],
		examples: [
			{
				title: "Show a loading spinner",
				action: { tool: "spinner", id: "load", mode: "start", message: "Loading data..." },
			},
			{
				title: "Dismiss the spinner",
				action: { tool: "spinner", id: "load", mode: "stop" },
			},
		],
	},
};
