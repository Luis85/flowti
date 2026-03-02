/**
 * Tool catalog — source of truth for Journey Runner tool metadata.
 *
 * Each tool entry defines its name, description, tags, and use-cases.
 * Tags classify tools by purpose (e.g. "lifecycle" for setup/teardown-specific tools).
 * Use-cases document when and why to reach for each tool.
 *
 * Consumed by:
 *   - Report generator (tool tags, descriptions in reports/canvas)
 *   - Validation (ensure all tools are registered)
 *   - Documentation (PRD Tool Reference syncs from this catalog)
 */
import type { ToolName } from "./journeyTypes";

// ─── Tool metadata ──────────────────────────────────────────────────

export interface ToolMeta {
	/** Tool name matching the ToolName union. */
	name: ToolName;
	/** Short description of what the tool does. */
	description: string;
	/** Classification tags. e.g. ["lifecycle"] for setup/teardown-specific tools. */
	tags: string[];
	/** Human-readable use-case descriptions — when and why to use this tool. */
	useCases: string[];
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
	},
};
