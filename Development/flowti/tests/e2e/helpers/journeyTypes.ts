/**
 * TypeScript types for declarative journey configuration.
 *
 * A JourneyDefinition is a JSON file that fully describes a user journey:
 * metadata, steps, and actions. The JourneyExecutor reads this definition
 * and generates vitest describe/it blocks that run via the JourneyRunner.
 *
 * Actions use a finite set of tools (command, click, input, highlight,
 * wait, assert, emit, navigate, eval, screenshot, manual, notice, theme,
 * plus lifecycle tools: create-file, delete-file, open-file, close-leaves).
 * Complex logic uses the `eval` tool as an escape hatch.
 *
 * Variable interpolation: `{{variableName}}` in any string field.
 * Built-in variables: `{{PLUGIN_ID}}`.
 */

// ─── Tool names ──────────────────────────────────────────────────────

export type ToolName =
	| "command"
	| "click"
	| "input"
	| "highlight"
	| "wait"
	| "assert"
	| "emit"
	| "navigate"
	| "eval"
	| "screenshot"
	| "manual"
	| "notice"
	| "theme"
	// Lifecycle tools — tagged for setup/teardown operations
	| "create-file"
	| "delete-file"
	| "open-file"
	| "close-leaves";

// ─── Journey definition ─────────────────────────────────────────────

export interface JourneyDefinition {
	/** Journey display name. e.g. "Canvas Session" */
	journey: string;
	/** Chapter number for vitest describe block. e.g. 5 → "Chapter 5: Canvas Session" */
	chapter: number;
	/** What this journey validates. */
	description?: string;
	/** Relative path to the test source file (from plugin root). */
	testSource?: string;
	/** Vault-relative path to the generated journey report. */
	reportPath?: string;
	/** Vault-relative path to the generated journey canvas. */
	canvasPath?: string;
	/** Tools used by this journey (self-documenting, validated on load). */
	tools: ToolName[];
	/** Steps run before the journey. Failures block main steps; teardown still runs. */
	setup?: StepDefinition[];
	/** Ordered list of steps. Each step generates one vitest `it()` block. */
	steps: StepDefinition[];
	/** Steps run after the journey. Always execute, even when main steps fail. */
	teardown?: StepDefinition[];
}

// ─── Step definition ────────────────────────────────────────────────

export interface StepUiContext {
	view?: string;
	viewName?: string;
	tab?: string;
	tabName?: string;
	components?: string[];
}

export interface StepDefinition {
	/** Step identifier, used as screenshot filename prefix. e.g. "01-start-canvas-session" */
	id: string;
	/** Human-readable step title. */
	title: string;
	/** Section number in the guide (1-based). */
	guideSection: number;
	/** What this step does and why. */
	description?: string;
	/** What state or data this step expects to be present. */
	expectedInput?: string;
	/** What the step should produce or change. */
	expectedOutput?: string;
	/**
	 * @deprecated Use explicit `screenshot` tool actions in the actions array instead.
	 * Retained for backward compatibility with imperative journeys.
	 */
	capture?: "afterSettle" | "afterAction";
	/** UI context — which view, tab, and components are involved. */
	uiContext?: StepUiContext;
	/** EventBus events triggered or asserted. */
	events?: string[];
	/** Obsidian/Flowti commands executed. */
	commands?: string[];
	/** User interactions performed. */
	interactions?: string[];
	/** Analytics queries run or validated. */
	queries?: string[];
	/** Ordered list of actions to execute within this step. */
	actions: ActionDefinition[];
}

// ─── Action definitions (discriminated union on `tool`) ─────────────

export type ActionDefinition =
	| CommandAction
	| ClickAction
	| InputAction
	| HighlightAction
	| WaitAction
	| ScreenshotAction
	| NavigateAction
	| AssertAction
	| EmitAction
	| EvalAction
	| ManualAction
	| NoticeAction
	| ThemeAction
	// Lifecycle tools
	| CreateFileAction
	| DeleteFileAction
	| OpenFileAction
	| CloseLeavesAction;

export interface CommandAction {
	tool: "command";
	/** Command ID without plugin prefix. e.g. "flowti:start-canvas-session" */
	id: string;
	description?: string;
}

export interface ClickAction {
	tool: "click";
	/** CSS selector for the element to click. */
	selector: string;
	description?: string;
}

export interface InputAction {
	tool: "input";
	/** CSS selector for the input element. */
	selector: string;
	/** Value to type into the input. */
	value: string;
	description?: string;
}

export interface HighlightAction {
	tool: "highlight";
	/** CSS selector for the element to highlight. */
	selector: string;
	/** Highlight style. Default: "element". */
	style?: "element" | "button" | "input";
	description?: string;
}

export interface WaitAction {
	tool: "wait";
	/** Milliseconds to wait. */
	ms: number;
	description?: string;
}

export interface ScreenshotAction {
	tool: "screenshot";
	/** Label used in filename: `{stepId}--{label}.png`. Auto-numbered if omitted. */
	label?: string;
	description?: string;
}

export interface ManualAction {
	tool: "manual";
	/** What the operator should do manually. */
	instruction: string;
	description?: string;
}

export interface NoticeAction {
	tool: "notice";
	/** Message to display in the Obsidian Notice toast. Supports {{variable}} interpolation. */
	message: string;
	/** Duration in milliseconds. Default: 5000. */
	duration?: number;
	description?: string;
}

export interface ThemeAction {
	tool: "theme";
	/** Theme name to switch to. Use "obsidian" for default dark or "moonstone" for default light. */
	theme: string;
	description?: string;
}

export interface NavigateAction {
	tool: "navigate";
	/** Hub ID. e.g. "flowti-user-hub" */
	hub: string;
	/** View type. e.g. "flowti-user-hub" */
	viewType: string;
	/** Tab ID. e.g. "sessions" */
	tab: string;
	description?: string;
}

export interface AssertAction {
	tool: "assert";
	/** Assertion type. */
	type: "visible" | "not-visible" | "text" | "event" | "leaf" | "eval";
	/** CSS selector (for visible, not-visible, text). */
	selector?: string;
	/** Expected text content (for text assertion). */
	contains?: string;
	/** Event name (for event assertion). */
	event?: string;
	/** Expected event payload fields (for event assertion). */
	payload?: Record<string, unknown>;
	/** View type (for leaf assertion). */
	viewType?: string;
	/** JavaScript code (for eval assertion). */
	code?: string;
	/** Expected eval result (for eval assertion). */
	expected?: string;
	description?: string;
}

export interface EmitAction {
	tool: "emit";
	/** EventBus event name. */
	event: string;
	/** Event payload. String values support {{variable}} interpolation. */
	payload?: Record<string, unknown>;
	description?: string;
}

export interface EvalAction {
	tool: "eval";
	/** JavaScript code to execute in Obsidian. Supports {{variable}} interpolation. */
	code: string;
	/** Store the eval result in a named variable for later use. */
	store?: string;
	/** Optional assertion on the eval result. */
	expect?: EvalExpectation;
	description?: string;
}

export type EvalExpectation =
	| { type: "equals"; value: string }
	| { type: "truthy" }
	| { type: "json"; match: Record<string, unknown> };

// ─── Lifecycle tool actions ─────────────────────────────────────────

export interface CreateFileAction {
	tool: "create-file";
	/** Vault-relative path for the new file. Supports {{variable}} interpolation. */
	path: string;
	/** File content. Supports {{variable}} interpolation. */
	content: string;
	/** Store the created path in a named variable for later use (e.g. in teardown). */
	store?: string;
	description?: string;
}

export interface DeleteFileAction {
	tool: "delete-file";
	/** Vault-relative path of the file to delete. Supports {{variable}} interpolation. */
	path: string;
	description?: string;
}

export interface OpenFileAction {
	tool: "open-file";
	/** Vault-relative path of the file to open. Supports {{variable}} interpolation. */
	path: string;
	description?: string;
}

export interface CloseLeavesAction {
	tool: "close-leaves";
	/** View type of leaves to close. e.g. "flowti-user-hub", "markdown" */
	viewType: string;
	description?: string;
}
