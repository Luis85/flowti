/**
 * TypeScript types for declarative journey configuration.
 *
 * A JourneyDefinition is a JSON file that fully describes a user journey:
 * metadata, steps, and actions. The JourneyExecutor reads this definition
 * and generates vitest describe/it blocks that run via the JourneyRunner.
 *
 * Actions use a finite set of tools (command, click, input, highlight,
 * wait, assert, emit, navigate, eval, screenshot, manual, notice, theme,
 * plus lifecycle tools: create-file, delete-file, open-file, open-url, close-leaves, seed,
 * and interactive tools: visual-inspection).
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
	| "ribbon"
	// Lifecycle tools — tagged for setup/teardown operations
	| "create-file"
	| "delete-file"
	| "open-file"
	| "open-url"
	| "close-leaves"
	| "close-modals"
	| "seed"
	// Input tools
	| "set-input"
	// Frontmatter tools
	| "frontmatter"
	// Query tools
	| "query-trace"
	// Logging tools
	| "write-run-log"
	// Scroll tools
	| "scroll-to"
	// Interactive inspection tools
	| "visual-inspection"
	// Assert tools
	| "assert-text"
	| "assert-number"
	// Spinner tools
	| "spinner";

// ─── Lifecycle configuration ────────────────────────────────────────

/** Controls what the executor does in beforeAll. Default: all true. */
export interface JourneyLifecycle {
	/** If false, skip ensurePluginEnabled in beforeAll. Default: true. */
	enablePlugin?: boolean;
	/** If false, skip ensureInstalled check in beforeAll. Default: true. */
	checkInstalled?: boolean;
	/** If false, skip startEventTrace in beforeAll. Default: true. */
	startTrace?: boolean;
	/** If false, skip openActivityLog in beforeAll. Default: true. */
	openActivityLog?: boolean;
}

// ─── Journey definition ─────────────────────────────────────────────

/** Journey type classification. */
export type JourneyType =
	| "functional"
	| "regression"
	| "smoke"
	| "exploratory"
	| "blueprint"
	| "integration";

/** Service Blueprint swimlane for step classification. */
export type BlueprintSwimlane =
	| "customer"    // Customer actions (what the user does)
	| "frontstage"  // Visible interactions (UI, feedback, responses)
	| "backstage"   // Behind-the-scenes processing (services, events)
	| "support";    // Supporting systems (storage, external APIs)

/** An improvement idea or note captured during journey development. */
export interface JourneyImprovement {
	/** Short title of the improvement. */
	title: string;
	/** Detailed description. */
	description?: string;
	/** Priority: nice-to-have, should-have, must-have. */
	priority?: "nice-to-have" | "should-have" | "must-have";
	/** Date the idea was captured (ISO string). */
	added?: string;
}

export interface JourneyDefinition {
	/** Journey display name. e.g. "Canvas Session" */
	journey: string;
	/** Chapter number for vitest describe block. e.g. 5 → "Chapter 5: Canvas Session". Optional — omit for unnumbered journeys. */
	chapter?: number;
	/** If true, skip this entire journey during execution. All steps register as skipped. */
	skip?: boolean;
	/** What this journey validates. */
	description?: string;
	/** Relative path to the test source file (from plugin root). */
	testSource?: string;
	/** Vault-relative path to the generated journey report. */
	reportPath?: string;
	/** Vault-relative path to the generated journey canvas. */
	canvasPath?: string;
	/** Tools used by this journey (self-documenting). Optional — derived from actions if omitted. */
	tools?: ToolName[];
	/** Lifecycle configuration — controls beforeAll behavior. */
	lifecycle?: JourneyLifecycle;
	/** Window properties to set after all steps pass (e.g. ["_e2ePrerequisitesPassed"]). */
	gateFlags?: string[];
	/** If true, write an anchor file with pass/fail status for skip-mode detection. */
	anchor?: boolean;

	// ── Classification ──────────────────────────────────────
	/** Journey type classification. Default: "functional". */
	type?: JourneyType;
	/** High-level category (e.g. "onboarding", "analytics", "settings"). */
	category?: string;
	/** Business domain (e.g. "user", "session", "hub", "ingestion"). */
	domain?: string;
	/** Actors involved in this journey (e.g. ["User", "Admin", "System"]). */
	actors?: string[];
	/** Services exercised during this journey (e.g. ["SettingsService", "EventBus"]). */
	services?: string[];

	// ── Improvements ───────────────────────────────────────
	/** Ideas, enhancements, and notes captured during development. */
	improvements?: JourneyImprovement[];

	// ── Steps ───────────────────────────────────────────────
	/** Steps run before the journey. Failures block main steps; teardown still runs. */
	setup?: StepDefinition[];
	/** Ordered list of steps. Each step generates one vitest `it()` block.
	 *  Steps can reference other journeys via JourneyRefStep — they are
	 *  resolved and flattened before test registration. */
	steps: StepOrRef[];
	/** Steps run after the journey. Always execute, even when main steps fail. */
	teardown?: StepDefinition[];
}

// ─── Composable journey refs ────────────────────────────────────────

/** References another journey — its steps are flattened into the parent at resolution time. */
export interface JourneyRefStep {
	/** Filename stem of the referenced journey. e.g. "getting-started" → getting-started.journey.json */
	ref: string;
	/** Why this journey is included (documentation only). */
	description?: string;
}

/** A step entry in a journey — either a concrete step or a reference to another journey. */
export type StepOrRef = StepDefinition | JourneyRefStep;

/** Type guard: returns true if the entry is a journey reference (has `ref`, no `actions`). */
export function isJourneyRef(step: StepOrRef): step is JourneyRefStep {
	return "ref" in step && !("actions" in step);
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
	/** Service Blueprint swimlane. Classifies this step's position in the service flow. */
	swimlane?: BlueprintSwimlane;
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
	/** If true, skip this step during execution. Registers as skipped in results. */
	skip?: boolean;
	/** If true, this step is under development. The executor runs it normally,
	 *  then terminates — remaining steps register as skipped. */
	dev?: boolean;
	/** Ideas and notes captured during development of this step. */
	improvements?: JourneyImprovement[];
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
	| OpenUrlAction
	| CloseLeavesAction
	| CloseModalsAction
	| SeedAction
	| RibbonAction
	// Input tools
	| SetInputAction
	// Frontmatter tools
	| FrontmatterAction
	// Query tools
	| QueryTraceAction
	// Logging tools
	| WriteRunLogAction
	// Scroll tools
	| ScrollToAction
	// Interactive inspection tools
	| VisualInspectionAction
	// Assert tools
	| AssertTextAction
	| AssertNumberAction
	// Spinner tools
	| SpinnerAction;

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
	/** Target DOM context. "webview" highlights inside the active Electron webview. Default: "dom". */
	target?: "dom" | "webview";
	/** Auto-remove the highlight after this many milliseconds. Omit to persist until next step. */
	duration?: number;
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
	/** Timeout in milliseconds before auto-failing. Default: 300000 (5 minutes). */
	timeout?: number;
	/** If false, skip the modal and auto-approve — the step appears only as a checklist item on reports. Default: true. */
	interactive?: boolean;
	description?: string;
}

export interface NoticeAction {
	tool: "notice";
	/** Message to display in the Obsidian Notice toast. Supports {{variable}} interpolation. */
	message: string;
	/** Duration in milliseconds. Default: 5000. */
	duration?: number;
	/** Visual style: "success" (green), "error" (red), or default (neutral). */
	style?: "success" | "error";
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
	type: "visible" | "not-visible" | "text" | "event" | "leaf" | "eval" | "count" | "attr";
	/** CSS selector (for visible, not-visible, text, count, attr). */
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
	/** Expected count (for count assertion). */
	count?: number;
	/** Attribute name (for attr assertion). */
	attr?: string;
	/** Expected attribute value (for attr assertion). */
	value?: string;
	description?: string;
}

export interface AssertTextAction {
	tool: "assert-text";
	/** CSS selector for the element to check. */
	selector: string;
	/** Expected text (checked via textContent.includes). */
	contains: string;
	description?: string;
}

export interface AssertNumberAction {
	tool: "assert-number";
	/** CSS selector for the element whose textContent is parsed as a number. */
	selector: string;
	/** Comparison operator. */
	operator: "eq" | "gt" | "gte" | "lt" | "lte";
	/** Value to compare against. */
	value: number;
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

export interface RibbonAction {
	tool: "ribbon";
	/** Text to match against the ribbon button's aria-label (partial match). */
	label: string;
	description?: string;
}

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

export interface OpenUrlAction {
	tool: "open-url";
	/** URL to open in the Obsidian WebViewer. Supports {{variable}} interpolation. */
	url: string;
	description?: string;
}

export interface CloseLeavesAction {
	tool: "close-leaves";
	/** View type of leaves to close. e.g. "flowti-user-hub", "markdown" */
	viewType: string;
	description?: string;
}

export interface CloseModalsAction {
	tool: "close-modals";
	description?: string;
}

export interface SeedAction {
	tool: "seed";
	/** Seed file identifier. e.g. "welcome-note", "supplier-csv", "all", "folders" */
	id: string;
	/** Operation mode. Default: "create". */
	mode?: "create" | "verify" | "delete";
	description?: string;
}

export interface WriteRunLogAction {
	tool: "write-run-log";
	/** The log line to append to E2E Test Run.md. Supports {{variable}} interpolation. */
	message: string;
	description?: string;
}

export interface SetInputAction {
	tool: "set-input";
	/** CSS selector for the input element. */
	selector: string;
	/** Value to set on the input. Supports {{variable}} interpolation. */
	value: string;
	/** If true, dispatch React-compatible input event. Default: true. */
	dispatchEvent?: boolean;
	description?: string;
}

export interface FrontmatterAction {
	tool: "frontmatter";
	/** Vault-relative path of the file. Supports {{variable}} interpolation. */
	path: string;
	/** Frontmatter operation: "set" writes a property, "read" stores a property value. */
	mode: "set" | "read";
	/** Frontmatter property name. */
	property: string;
	/** Property value (for "set" mode). Supports {{variable}} interpolation. */
	value?: string;
	/** Store the read value in a named variable (for "read" mode). */
	store?: string;
	description?: string;
}

export interface QueryTraceAction {
	tool: "query-trace";
	/** Event type to search for in the trace. Supports {{variable}} interpolation. */
	event: string;
	/** Maximum number of events to return. Default: 10. */
	limit?: number;
	/** Store the JSON result in a named variable. */
	store?: string;
	description?: string;
}

export interface ScrollToAction {
	tool: "scroll-to";
	/** CSS selector for the element to scroll into view. */
	selector: string;
	/** Target DOM context. "webview" scrolls inside the active Electron webview. Default: "dom". */
	target?: "dom" | "webview";
	/** Scroll behavior. Default: "smooth". */
	behavior?: "smooth" | "instant";
	/** Vertical alignment. Default: "center". */
	block?: "start" | "center" | "end" | "nearest";
	description?: string;
}

export interface VisualInspectionAction {
	tool: "visual-inspection";
	/** Prompt shown to the operator describing what to inspect. Supports {{variable}} interpolation. */
	prompt: string;
	/** Timeout in milliseconds before auto-failing. Default: 300000 (5 minutes). */
	timeout?: number;
	/** If false, skip the notice prompt and auto-approve — the step appears only on reports. Default: true. */
	interactive?: boolean;
	description?: string;
}

export interface SpinnerAction {
	tool: "spinner";
	/** Unique ID to match start/stop pairs. */
	id: string;
	/** "start" shows the spinner notice, "stop" dismisses it. */
	mode: "start" | "stop";
	/** Message shown alongside the spinner (start only). Supports {{variable}} interpolation. */
	message?: string;
	description?: string;
}
