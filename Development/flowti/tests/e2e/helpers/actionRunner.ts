/**
 * Action runner — dispatches declarative actions to CLI tools.
 *
 * Each action in a journey step is dispatched by its `tool` field.
 * String fields support {{variable}} interpolation for cross-step
 * data passing (e.g. session IDs from eval → emit payloads).
 */
import * as path from "node:path";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { ActionDefinition, AssertAction, CloseLeavesAction, CreateFileAction, DeleteFileAction, EmitAction, EvalAction, FrontmatterAction, ManualAction, NoticeAction, OpenFileAction, OpenUrlAction, QueryTraceAction, RibbonAction, ScreenshotAction, ScrollToAction, SeedAction, SetInputAction, SpinnerAction, ThemeAction, VisualInspectionAction, WriteRunLogAction } from "./journeyTypes";
import type { ManualVerification } from "./journey";
import { getAllSeeds, getSeedById, SEED_FOLDERS } from "./seedRegistry";
import { highlightElement, highlightButton, highlightInput, highlightRibbon, highlightWebView, highlightAssert, notifyAssert } from "./highlight";
import { navigateToTab } from "./navigation";
import { assertEventEmitted, getEventsSince, PLUGIN_ID } from "./fixtures";

// ─── Variable interpolation ─────────────────────────────────────────

/**
 * Replaces all `{{key}}` occurrences in a string with values from the
 * variables map. Throws if a referenced variable is not found.
 */
function resolve(template: string, variables: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		if (key in variables) return variables[key];
		throw new Error(`Variable '{{${key}}}' not found. Available: ${Object.keys(variables).join(", ")}`);
	});
}

/**
 * Deep-resolves all string values in a payload object.
 * Non-string values are passed through unchanged.
 */
function resolvePayload(
	payload: Record<string, unknown> | undefined,
	variables: Record<string, string>,
): Record<string, unknown> {
	if (!payload) return {};
	const resolved: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(payload)) {
		resolved[key] = typeof value === "string" ? resolve(value, variables) : value;
	}
	return resolved;
}

/** Escapes single quotes in selectors for safe injection into eval strings. */
function escapeSelector(selector: string): string {
	return selector.replace(/'/g, "\\'");
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

// ─── Screenshot collector ───────────────────────────────────────────

/**
 * Mutable context object for accumulating screenshot filenames during
 * a step's action sequence. Passed through executeAction calls.
 */
export interface ScreenshotCollector {
	/** Step ID prefix for screenshot filenames. */
	stepId: string;
	/** Absolute directory path for screenshot output. */
	screenshotDir: string;
	/** Accumulated screenshot filenames (e.g. "01-start--before.png"). */
	files: string[];
	/** Auto-increment counter for unlabeled screenshots. */
	counter: number;
}

/**
 * Builds the screenshot filename and absolute path.
 * With label: `{stepId}--{label}.png`
 * Without label: `{stepId}--{counter}.png` (auto-numbered)
 */
function resolveScreenshotPath(
	collector: ScreenshotCollector,
	label?: string,
): { filename: string; absolutePath: string } {
	const suffix = label ?? String(++collector.counter);
	const filename = `${collector.stepId}--${suffix}.png`;
	const absolutePath = path.join(collector.screenshotDir, filename);
	return { filename, absolutePath };
}

// ─── Manual verification collector ──────────────────────────────────

/**
 * Mutable context for accumulating manual verification results
 * during a step's action sequence.
 */
export interface ManualVerificationCollector {
	results: ManualVerification[];
}

// ─── Action dispatcher ──────────────────────────────────────────────

/**
 * Executes a single action from a journey step definition.
 *
 * @param cli              — ObsidianCli instance
 * @param action           — Action definition from the journey config
 * @param variables        — Mutable variable map (shared across steps)
 * @param traceBookmark    — Event trace index recorded at step start
 * @param collector        — Screenshot collector for accumulating filenames
 * @param manualCollector  — Manual verification collector for pass/fail results
 */
export async function executeAction(
	cli: ObsidianCli,
	action: ActionDefinition,
	variables: Record<string, string>,
	traceBookmark: number,
	collector?: ScreenshotCollector,
	manualCollector?: ManualVerificationCollector,
): Promise<void> {
	switch (action.tool) {
		case "command":
			executeCommand(cli, resolve(action.id, variables));
			break;
		case "click":
			executeClick(cli, resolve(action.selector, variables));
			break;
		case "input":
			executeInput(cli, resolve(action.selector, variables), resolve(action.value, variables));
			break;
		case "highlight":
			if (action.target === "webview") {
				highlightWebView(cli, resolve(action.selector, variables), action.duration);
			} else {
				executeHighlight(cli, resolve(action.selector, variables), action.style, action.duration);
			}
			break;
		case "wait":
			executeWait(cli, action.ms, action.description);
			await sleep(action.ms);
			break;
		case "screenshot": {
			if (collector) {
				const { filename, absolutePath } = resolveScreenshotPath(
					collector,
					(action as ScreenshotAction).label,
				);
				cli.screenshot(absolutePath);
				collector.files.push(filename);
			}
			break;
		}
		case "navigate":
			await navigateToTab(
				cli,
				resolve(action.hub, variables),
				resolve(action.viewType, variables),
				resolve(action.tab, variables),
			);
			break;
		case "assert":
			executeAssert(cli, action, variables, traceBookmark);
			break;
		case "emit":
			executeEmit(cli, action, variables);
			break;
		case "eval":
			executeEval(cli, action, variables);
			break;
		case "notice":
			executeNotice(cli, action, variables);
			break;
		case "theme":
			executeTheme(cli, action, variables);
			break;
		// ── Lifecycle tools ──────────────────────────────────────
		case "create-file":
			executeCreateFile(cli, action, variables);
			break;
		case "delete-file":
			executeDeleteFile(cli, action, variables);
			break;
		case "open-file":
			executeOpenFile(cli, action, variables);
			break;
		case "open-url":
			executeOpenUrl(cli, action, variables);
			break;
		case "close-leaves":
			executeCloseLeaves(cli, action, variables);
			break;
		case "close-modals":
			executeCloseModals(cli);
			break;
		case "ribbon":
			executeRibbon(cli, action, variables);
			break;
		case "seed":
			executeSeed(cli, action, variables);
			break;
		case "set-input":
			executeSetInput(cli, action, variables);
			break;
		case "frontmatter":
			executeFrontmatter(cli, action, variables);
			break;
		case "query-trace":
			executeQueryTrace(cli, action, variables, traceBookmark);
			break;
		case "write-run-log":
			executeWriteRunLog(cli, action, variables);
			break;
		case "scroll-to":
			executeScrollTo(cli, action, variables);
			break;
		case "manual":
			await executeManualVerification(cli, action, variables, manualCollector);
			break;
		case "visual-inspection":
			await executeVisualInspection(cli, action, variables);
			break;
		case "spinner":
			executeSpinner(cli, action, variables);
			break;
	}
}

// ─── Tool implementations ───────────────────────────────────────────

function executeCommand(cli: ObsidianCli, commandId: string): void {
	// Plugin commands use the flowti: namespace (e.g. "flowti:open-user-hub").
	// Obsidian prefixes the manifest ID, so the full ID becomes
	// "flowti-ibde:flowti:open-user-hub". Skip prefixing if already qualified.
	const fullId = commandId.startsWith(`${PLUGIN_ID}:`)
		? commandId
		: `${PLUGIN_ID}:${commandId}`;
	cli.executeCommand(fullId);
}

/** Duration (ms) for the brief highlight flash before an interaction. */
const INTERACTION_HIGHLIGHT_MS = 600;

function executeClick(cli: ObsidianCli, selector: string): void {
	const sel = escapeSelector(selector);
	highlightButton(cli, selector, INTERACTION_HIGHLIGHT_MS);
	const result = cli.eval(`document.querySelector('${sel}')?.click()`);
	if (!result.success) {
		throw new Error(`Click failed on '${selector}': ${result.error}`);
	}
}

function executeInput(cli: ObsidianCli, selector: string, value: string): void {
	const sel = escapeSelector(selector);
	const escapedValue = value.replace(/'/g, "\\'");
	highlightInput(cli, selector, INTERACTION_HIGHLIGHT_MS);
	const result = cli.eval([
		"(() => {",
		`  const input = document.querySelector('${sel}');`,
		"  if (!input) throw new Error('Input not found');",
		"  input.focus();",
		"  input.value = '';",
		`  document.execCommand('insertText', false, '${escapedValue}');`,
		"})()",
	].join(" "));
	if (!result.success) {
		throw new Error(`Input failed on '${selector}': ${result.error}`);
	}
}

function executeHighlight(cli: ObsidianCli, selector: string, style?: "element" | "button" | "input", duration?: number): void {
	switch (style) {
		case "button":
			highlightButton(cli, selector, duration);
			break;
		case "input":
			highlightInput(cli, selector, duration);
			break;
		default:
			highlightElement(cli, selector, duration);
			break;
	}
}

function executeAssert(
	cli: ObsidianCli,
	action: AssertAction,
	variables: Record<string, string>,
	traceBookmark: number,
): void {
	const desc = action.description ?? "";
	switch (action.type) {
		case "visible": {
			const rawSel = resolve(action.selector!, variables);
			const count = cli.domCount(rawSel);
			const passed = count > 0;
			highlightAssert(cli, rawSel, passed, desc || `visible: ${action.selector}`);
			if (!passed) {
				throw new Error(`Expected element '${action.selector}' to be visible`);
			}
			break;
		}
		case "not-visible": {
			const rawSel = resolve(action.selector!, variables);
			const count = cli.domCount(rawSel);
			const passed = count === 0;
			notifyAssert(cli, passed, desc || `not-visible: ${action.selector}`);
			if (!passed) {
				throw new Error(`Expected element '${action.selector}' to NOT be visible`);
			}
			break;
		}
		case "text": {
			const rawSel = resolve(action.selector!, variables);
			let text: string;
			try {
				text = cli.domText(rawSel);
			} catch {
				text = "";
			}
			const passed = text.includes(resolve(action.contains!, variables));
			highlightAssert(cli, rawSel, passed, desc || `text: "${action.contains}"`);
			if (!passed) {
				throw new Error(`Expected element '${action.selector}' to contain '${action.contains}', got '${text}'`);
			}
			break;
		}
		case "event": {
			const event = resolve(action.event!, variables);
			const payload = action.payload ? resolvePayload(action.payload, variables) : undefined;
			try {
				assertEventEmitted(cli, traceBookmark, event, payload);
				notifyAssert(cli, true, desc || `event: ${event}`);
			} catch (err) {
				notifyAssert(cli, false, desc || `event: ${event}`);
				throw err;
			}
			// Mark as asserted for Activity Log highlighting
			cli.eval(
				`(() => { const p = app.plugins.plugins['${PLUGIN_ID}']; if (p) { if (!p._e2eAssertedEvents) p._e2eAssertedEvents = []; p._e2eAssertedEvents.push('${event}'); } })()`,
			);
			break;
		}
		case "leaf": {
			const viewType = resolve(action.viewType!, variables);
			const count = cli.domCount(`.workspace-leaf-content[data-type='${viewType}']`);
			const passed = count > 0;
			notifyAssert(cli, passed, desc || `leaf: ${viewType}`);
			if (!passed) {
				throw new Error(`No leaf found with view type '${viewType}'`);
			}
			break;
		}
		case "eval": {
			const code = resolve(action.code!, variables);
			const check = cli.eval(code);
			if (!check.success) {
				notifyAssert(cli, false, desc || "eval assertion");
				throw new Error(`Eval assertion failed: ${check.error}`);
			}
			const expected = resolve(action.expected!, variables);
			const passed = check.value === expected;
			notifyAssert(cli, passed, desc || `eval: expected "${expected}"`);
			if (!passed) {
				throw new Error(`Expected '${expected}', got '${check.value}'`);
			}
			break;
		}
		case "count": {
			const rawSel = resolve(action.selector!, variables);
			const count = cli.domCount(rawSel);
			const expectedCount = action.count!;
			const passed = count === expectedCount;
			notifyAssert(cli, passed, desc || `count: ${expectedCount} of ${action.selector}`);
			if (!passed) {
				throw new Error(`Expected ${expectedCount} elements matching '${action.selector}', found ${count}`);
			}
			break;
		}
		case "attr": {
			const rawSel = resolve(action.selector!, variables);
			const attrName = action.attr!;
			const expectedValue = resolve(action.value!, variables);
			let attrValue: string;
			try {
				attrValue = cli.domAttr(rawSel, attrName);
			} catch {
				attrValue = "";
			}
			const passed = attrValue === expectedValue;
			highlightAssert(cli, rawSel, passed, desc || `attr ${attrName}="${expectedValue}"`);
			if (!passed) {
				throw new Error(`Expected attribute '${attrName}' to be '${expectedValue}' on '${action.selector}', got '${attrValue}'`);
			}
			break;
		}
	}
}

function executeEmit(cli: ObsidianCli, action: EmitAction, variables: Record<string, string>): void {
	const event = resolve(action.event, variables);
	const payload = resolvePayload(action.payload, variables);
	const payloadJson = JSON.stringify(payload);
	const result = cli.eval([
		`(() => {`,
		`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		`  if (!p) throw new Error('Plugin not loaded');`,
		`  p.eventBus.emit('${event}', ${payloadJson});`,
		`})()`,
	].join(" "));
	if (!result.success) {
		throw new Error(`Emit '${event}' failed: ${result.error}`);
	}
}

function executeNotice(cli: ObsidianCli, action: NoticeAction, variables: Record<string, string>): void {
	const message = resolve(action.message, variables);
	const duration = action.duration ?? 5000;
	if (action.style) {
		cli.styledNotice(message, action.style, duration);
	} else {
		cli.notice(message, duration);
	}
}

// ── Spinner helpers (shared with journeyExecutor) ───────────────────

/**
 * Shows a persistent loading spinner anchored to the bottom-right of the viewport.
 * Uses a standalone fixed-position DOM element (not Obsidian's Notice API) so it
 * cannot be pushed out or removed when new notices arrive.
 */
export function showSpinner(cli: ObsidianCli, id: string, message = "Loading\u2026"): void {
	const escapedId = id.replace(/'/g, "\\'");
	const escapedMsg = message.replace(/'/g, "\\'");
	const result = cli.eval([
		"(() => {",
		"  if (!window._e2eSpinners) window._e2eSpinners = {};",
		`  if (window._e2eSpinners['${escapedId}']) { window._e2eSpinners['${escapedId}'].remove(); delete window._e2eSpinners['${escapedId}']; }`,
		"  const el = document.createElement('div');",
		`  el.id = 'ft-spinner-${escapedId}';`,
		"  el.className = 'ft-e2e-spinner';",
		"  el.style.cssText = 'position:fixed; bottom:12px; right:12px; z-index:10000;"
			+ " display:flex; align-items:center; gap:8px;"
			+ " padding:8px 16px; border-radius:8px;"
			+ " background:var(--background-modifier-message);"
			+ " color:var(--text-normal); font-size:var(--font-ui-small);"
			+ " box-shadow:0 2px 8px rgba(0,0,0,0.15); pointer-events:none;';",
		"  const ring = document.createElement('div');",
		"  ring.style.cssText = 'width:16px; height:16px;"
			+ " border:2px solid var(--text-muted); border-top-color:transparent;"
			+ " border-radius:50%; animation:ft-spin 0.8s linear infinite; flex-shrink:0;';",
		"  el.appendChild(ring);",
		"  const txt = document.createElement('span');",
		`  txt.textContent = '${escapedMsg}';`,
		"  el.appendChild(txt);",
		"  document.body.appendChild(el);",
		`  window._e2eSpinners['${escapedId}'] = el;`,
		"})()",
	].join(" "));
	if (!result.success) {
		throw new Error(`spinner start '${id}' failed: ${result.error}`);
	}
}

/**
 * Hides a previously shown spinner by ID.
 * No-op if the spinner was already removed.
 */
export function hideSpinner(cli: ObsidianCli, id: string): void {
	const escapedId = id.replace(/'/g, "\\'");
	const result = cli.eval([
		"(() => {",
		`  if (window._e2eSpinners && window._e2eSpinners['${escapedId}']) {`,
		`    window._e2eSpinners['${escapedId}'].remove();`,
		`    delete window._e2eSpinners['${escapedId}'];`,
		"  }",
		"})()",
	].join(" "));
	if (!result.success) {
		throw new Error(`spinner stop '${id}' failed: ${result.error}`);
	}
}

function executeSpinner(cli: ObsidianCli, action: SpinnerAction, variables: Record<string, string>): void {
	const id = resolve(action.id, variables);
	const message = action.message ? resolve(action.message, variables) : undefined;
	if (action.mode === "start") {
		showSpinner(cli, id, message);
	} else {
		hideSpinner(cli, id);
	}
}

function executeTheme(cli: ObsidianCli, action: ThemeAction, variables: Record<string, string>): void {
	const theme = resolve(action.theme, variables);
	cli.setTheme(theme);
}

// ─── Lifecycle tool implementations ─────────────────────────────────

function executeCreateFile(cli: ObsidianCli, action: CreateFileAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	const content = resolve(action.content, variables);
	cli.createFile(filePath, content);
	if (action.store) {
		variables[action.store] = filePath;
	}
}

function executeDeleteFile(cli: ObsidianCli, action: DeleteFileAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	try {
		cli.deleteFile(filePath);
	} catch {
		// File may not exist — silent no-op matches original behavior
	}
}

function executeOpenFile(cli: ObsidianCli, action: OpenFileAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	cli.openFile(filePath);
}

function executeOpenUrl(cli: ObsidianCli, action: OpenUrlAction, variables: Record<string, string>): void {
	const url = resolve(action.url, variables);
	// Use the native CLI `web` command — handles plugin activation and view creation.
	cli.run("web", [`url=${url}`, "newtab"]);
}

function executeCloseLeaves(cli: ObsidianCli, action: CloseLeavesAction, variables: Record<string, string>): void {
	const viewType = resolve(action.viewType, variables);
	const result = cli.eval(
		`app.workspace.getLeavesOfType('${viewType}').forEach(l => l.detach())`,
	);
	if (!result.success) {
		throw new Error(`close-leaves '${viewType}' failed: ${result.error}`);
	}
}

function executeWait(cli: ObsidianCli, ms: number, description?: string): void {
	const label = description
		? `\u23f3 ${description} (${ms}ms)`
		: `\u23f3 Waiting ${ms}ms\u2026`;
	cli.notice(label, ms);
}

function executeCloseModals(cli: ObsidianCli): void {
	cli.eval(
		"document.querySelectorAll('.modal-container').forEach(el => el.remove())",
	);
}

function executeRibbon(cli: ObsidianCli, action: RibbonAction, variables: Record<string, string>): void {
	const label = resolve(action.label, variables);
	highlightRibbon(cli, label);
}

// ─── Seed tool implementation ────────────────────────────────────────

function executeSeed(cli: ObsidianCli, action: SeedAction, variables: Record<string, string>): void {
	const id = resolve(action.id, variables);
	const rawMode = action.mode ? resolve(action.mode, variables) : "create";
	const mode = rawMode as "create" | "verify" | "delete";

	// Special ID: "folders" — create all critical folders
	if (id === "folders") {
		if (mode !== "create") {
			throw new Error(`seed id="folders" only supports mode="create", got "${mode}"`);
		}
		for (const folder of SEED_FOLDERS) {
			try {
				cli.createFolder(folder);
			} catch {
				// Folder may already exist — silent no-op
			}
		}
		return;
	}

	// Special ID: "all" — operate on every entry in the registry
	if (id === "all") {
		for (const entry of getAllSeeds()) {
			executeSeedEntry(cli, entry.id, entry.path, entry.content, mode);
		}
		return;
	}

	// Single seed by ID
	const entry = getSeedById(id);
	if (!entry) {
		throw new Error(`Unknown seed id '${id}'. Available: ${getAllSeeds().map((e) => e.id).join(", ")}`);
	}
	executeSeedEntry(cli, entry.id, entry.path, entry.content, mode);
}

function executeSeedEntry(
	cli: ObsidianCli,
	_id: string,
	seedPath: string,
	content: string,
	mode: "create" | "verify" | "delete",
): void {
	switch (mode) {
		case "create": {
			if (cli.fileExists(seedPath)) return;
			cli.createFile(seedPath, content);
			break;
		}
		case "verify": {
			if (!cli.fileExists(seedPath)) {
				throw new Error(`Seed file missing in skip mode: ${seedPath}`);
			}
			break;
		}
		case "delete": {
			try {
				cli.deleteFile(seedPath);
			} catch {
				// File may not exist — silent no-op
			}
			break;
		}
	}
}

// ─── Run log ────────────────────────────────────────────────────────

function executeWriteRunLog(cli: ObsidianCli, action: WriteRunLogAction, variables: Record<string, string>): void {
	const message = resolve(action.message, variables);
	try {
		cli.appendFile("E2E Test Run.md", message + "\n");
	} catch {
		// File may not exist yet — create it first, then append
		cli.createFile("E2E Test Run.md", "# E2E Test Run\n");
		cli.appendFile("E2E Test Run.md", message + "\n");
	}
}

// ─── Set-input tool (React-safe) ────────────────────────────────────

function executeSetInput(cli: ObsidianCli, action: SetInputAction, variables: Record<string, string>): void {
	const selector = resolve(action.selector, variables);
	const value = resolve(action.value, variables);
	const dispatchEvent = action.dispatchEvent !== false; // default true
	const sel = escapeSelector(selector);
	const escapedValue = value.replace(/'/g, "\\'");
	highlightInput(cli, selector, INTERACTION_HIGHLIGHT_MS);
	const result = cli.eval([
		"(() => {",
		`  const el = document.querySelector('${sel}');`,
		"  if (!el) throw new Error('Input not found');",
		`  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set`,
		`    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;`,
		`  if (nativeSetter) nativeSetter.call(el, '${escapedValue}');`,
		`  else el.value = '${escapedValue}';`,
		...(dispatchEvent ? [
			"  el.dispatchEvent(new Event('input', { bubbles: true }));",
			"  el.dispatchEvent(new Event('change', { bubbles: true }));",
		] : []),
		"})()",
	].join(" "));
	if (!result.success) {
		throw new Error(`set-input failed on '${selector}': ${result.error}`);
	}
}

// ─── Frontmatter tool ───────────────────────────────────────────────

function executeFrontmatter(cli: ObsidianCli, action: FrontmatterAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	const property = action.property;

	switch (action.mode) {
		case "set": {
			const value = resolve(action.value!, variables);
			cli.setProperty(filePath, property, value);
			break;
		}
		case "read": {
			const result = cli.eval(
				`JSON.stringify(app.metadataCache.getCache('${escapeSelector(filePath)}')?.frontmatter?.['${property}'] ?? null)`,
			);
			if (!result.success) {
				throw new Error(`frontmatter read '${property}' on '${filePath}' failed: ${result.error}`);
			}
			if (action.store) {
				// Strip JSON quotes for simple values
				try {
					const parsed = JSON.parse(result.value);
					variables[action.store] = String(parsed);
				} catch {
					variables[action.store] = result.value;
				}
			}
			break;
		}
	}
}

// ─── Query-trace tool ───────────────────────────────────────────────

function executeQueryTrace(
	cli: ObsidianCli,
	action: QueryTraceAction,
	variables: Record<string, string>,
	traceBookmark: number,
): void {
	const event = resolve(action.event, variables);
	const limit = action.limit ?? 10;
	const events = getEventsSince(cli, traceBookmark, event);
	const limited = events.slice(0, limit);

	if (action.store) {
		variables[action.store] = JSON.stringify(limited);
	}
}

// ─── Scroll-to tool ─────────────────────────────────────────────────

function executeScrollTo(cli: ObsidianCli, action: ScrollToAction, variables: Record<string, string>): void {
	const selector = resolve(action.selector, variables);
	const behavior = action.behavior ?? "smooth";
	const block = action.block ?? "center";

	if (action.target === "webview") {
		const escaped = selector.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
		cli.eval([
			`(async () => {`,
			`  const wv = document.querySelector('webview');`,
			`  if (!wv) throw new Error('No webview element found');`,
			`  await wv.executeJavaScript(\``,
			`    (() => {`,
			`      const el = document.querySelector('${escaped}');`,
			`      if (el) el.scrollIntoView({ behavior: '${behavior}', block: '${block}' });`,
			`    })()`,
			`  \`);`,
			`})()`,
		].join(" "));
	} else {
		const escaped = escapeSelector(selector);
		const result = cli.eval(
			`(() => { const el = document.querySelector('${escaped}'); if (el) { el.scrollIntoView({ behavior: '${behavior}', block: '${block}' }); return 'ok'; } return 'not-found'; })()`,
		);
		if (result.success && result.value === "not-found") {
			throw new Error(`scroll-to: element '${selector}' not found`);
		}
	}
}

// ─── Manual verification ────────────────────────────────────────────

/** Default timeout for manual verification (5 minutes). */
const MANUAL_TIMEOUT_MS = 300_000;
/** Polling interval to check for operator response. */
const MANUAL_POLL_MS = 500;

/**
 * Shows a Manual QA prompt via the EventBus (NoticeService + ModalService).
 *
 * Flow (same pattern as visual inspection):
 *   1. `notice.prompt` → persistent Notice with instruction + Fail/Pass buttons
 *   2. On either response → `ui.openTextPrompt` → InputModal for notes
 *   3. Records result (pass/fail + notes) to collector
 *
 * When `interactive: false`, auto-approves without showing anything.
 * The step still appears on reports as a checklist item.
 *
 * Errors are treated as soft-fails by the executor (pushed to warnings).
 */
async function executeManualVerification(
	cli: ObsidianCli,
	action: ManualAction,
	variables: Record<string, string>,
	collector?: ManualVerificationCollector,
): Promise<void> {
	const prompt = resolve(action.instruction, variables);

	// Non-interactive mode: skip silently — renders as open checklist in reports
	if (action.interactive === false) {
		return;
	}

	const escapedPrompt = JSON.stringify(prompt);
	const timeoutMs = action.timeout ?? MANUAL_TIMEOUT_MS;

	// ── Verify handler registration ──────────────────────────
	const regCheck = cli.eval([
		"(() => {",
		`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		"  if (!p) return 'ERR:no-plugin';",
		"  if (!p.eventBus) return 'ERR:no-eventBus';",
		"  const hMap = p.eventBus.handlers;",
		"  if (!hMap) return 'ERR:no-handlers-map';",
		"  const h = hMap.get('ui.openManualQa');",
		"  return String(h ? h.size : 0);",
		"})()",
	].join(" "));

	if (!regCheck.success) {
		throw new Error(`Manual QA: handler check failed: ${regCheck.error}`);
	}
	if (regCheck.value.startsWith("ERR:")) {
		throw new Error(`Manual QA: ${regCheck.value}`);
	}
	if (regCheck.value === "0") {
		throw new Error(
			"Manual QA: no handlers registered for 'ui.openManualQa'. " +
			"ModalService may not have wired its subscription — check plugin bootstrap.",
		);
	}

	// ── Clear state, subscribe to response, emit event ───────
	const emitResult = cli.eval([
		"(() => {",
		`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		"  if (!p) return 'ERR:no-plugin';",
		"  delete window._e2eManualResult;",
		"  delete window._e2eManualNotes;",
		"  const unsub = p.eventBus.on('modal.manualQa.responded', (e) => {",
		"    window._e2eManualResult = e.payload.value;",
		"    window._e2eManualNotes = e.payload.notes || '';",
		"    unsub();",
		"  });",
		`  p.eventBus.emit('ui.openManualQa', { instruction: ${escapedPrompt} });`,
		"  return 'ok';",
		"})()",
	].join(" "));

	if (!emitResult.success || emitResult.value !== "ok") {
		throw new Error(`Manual QA: emit failed — ${emitResult.success ? emitResult.value : emitResult.error}`);
	}

	// ── Verify modal appeared ────────────────────────────────
	await sleep(1000);
	const traceCheck = cli.eval([
		"(() => {",
		`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		"  const trace = p?._e2eEventTrace ?? [];",
		"  const logErrors = trace.filter(e => e.type === 'log.error').slice(-3);",
		"  const modalOpened = trace.some(e => e.type === 'modal.opened' && e.payload?.modalType === 'manualQa');",
		"  const modalDomCount = document.querySelectorAll('.modal-container').length;",
		"  return JSON.stringify({ modalOpened, logErrors: logErrors.map(e => e.payload), modalDomCount });",
		"})()",
	].join(" "));

	if (traceCheck.success) {
		try {
			const diag = JSON.parse(traceCheck.value) as {
				modalOpened: boolean;
				logErrors: unknown[];
				modalDomCount: number;
			};
			if (diag.logErrors.length > 0) {
				throw new Error(
					`Manual QA: handler errors detected:\n${JSON.stringify(diag.logErrors, null, 2)}`,
				);
			}
			if (!diag.modalOpened && diag.modalDomCount === 0) {
				throw new Error(
					"Manual QA: event emitted but modal did not appear. " +
					"Handler may have failed silently or ManualQaModal.open() did not create DOM.",
				);
			}
		} catch (e) {
			if (e instanceof Error && e.message.startsWith("Manual QA:")) throw e;
			// JSON parse failure — fall through to poll
		}
	}

	// ── Poll for operator response ───────────────────────────
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await sleep(MANUAL_POLL_MS);
		const result = cli.eval("window._e2eManualResult ?? 'pending'");
		if (!result.success) continue;

		if (result.value === "pass" || result.value === "fail") {
			const notesResult = cli.eval("window._e2eManualNotes ?? ''");
			const notes = notesResult.success && notesResult.value ? notesResult.value : undefined;
			if (collector) {
				collector.results.push({
					instruction: prompt,
					status: result.value as "pass" | "fail",
					...(notes ? { notes } : {}),
				});
			}
			if (result.value === "fail") {
				throw new Error(`Manual QA failed: ${prompt}${notes ? `\nNotes: ${notes}` : ""}`);
			}
			return;
		}
	}

	throw new Error(
		`Manual QA timed out after ${(timeoutMs / 1000).toFixed(0)}s: ${prompt}`,
	);
}

// ─── Visual inspection ──────────────────────────────────────────────

/** Default timeout for visual inspection (5 minutes). */
const VISUAL_TIMEOUT_MS = 300_000;
/** Polling interval to check for operator response. */
const VISUAL_POLL_MS = 500;

/**
 * Shows a Pass/Fail prompt via the NoticeService (EventBus).
 * On Fail, opens a text prompt via the ModalService (EventBus) for a reason.
 * Uses the Flowti service layer instead of raw DOM for consistency.
 */
async function executeVisualInspection(
	cli: ObsidianCli,
	action: VisualInspectionAction,
	variables: Record<string, string>,
): Promise<void> {
	const prompt = resolve(action.prompt, variables);

	// Non-interactive mode: skip silently — renders as open checklist in reports
	if (action.interactive === false) return;

	const escapedPrompt = JSON.stringify(prompt);
	const timeoutMs = action.timeout ?? VISUAL_TIMEOUT_MS;

	// Clear previous result and trigger the Pass/Fail prompt via EventBus
	cli.eval([
		"(() => {",
		`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		"  if (!p) throw new Error('Plugin not loaded');",
		"  delete window._e2eVisualResult;",
		"  delete window._e2eVisualReason;",
		"  const unsub = p.eventBus.on('notice.prompt.responded', (e) => {",
		"    window._e2eVisualResult = e.payload.value;",
		"    unsub();",
		"  });",
		`  p.eventBus.emit('notice.prompt', {`,
		`    title: 'Visual Inspection',`,
		`    message: ${escapedPrompt},`,
		`    buttons: [`,
		`      { label: 'Pass', value: 'pass', cta: true },`,
		`      { label: 'Fail', value: 'fail', warning: true }`,
		`    ]`,
		`  });`,
		"})()",
	].join(" "));

	// Poll for operator response
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await sleep(VISUAL_POLL_MS);
		const result = cli.eval("window._e2eVisualResult ?? 'pending'");
		if (!result.success) continue;

		if (result.value === "pass") return;

		if (result.value === "fail") {
			// Operator clicked Fail — open text prompt for reason via ModalService
			cli.eval([
				"(() => {",
				`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
				"  if (!p) return;",
				"  delete window._e2eVisualReason;",
				"  window._e2eVisualResult = 'awaiting-reason';",
				"  const unsub = p.eventBus.on('modal.textPrompt.submitted', (e) => {",
				"    window._e2eVisualReason = e.payload.value;",
				"    window._e2eVisualResult = 'fail-with-reason';",
				"    unsub();",
				"  });",
				`  p.eventBus.emit('ui.openTextPrompt', {`,
				`    title: 'Visual Inspection Failed',`,
				`    message: ${escapedPrompt},`,
				`    placeholder: 'Describe what looks wrong...',`,
				`    submitLabel: 'Submit'`,
				`  });`,
				"})()",
			].join(" "));
			continue;
		}

		if (result.value === "fail-with-reason") {
			const reasonResult = cli.eval("window._e2eVisualReason ?? 'No reason provided'");
			const reason = reasonResult.success ? reasonResult.value : "No reason provided";
			throw new Error(`Visual inspection failed: ${prompt}\nReason: ${reason}`);
		}
	}

	throw new Error(
		`Visual inspection timed out after ${(timeoutMs / 1000).toFixed(0)}s: ${prompt}`,
	);
}

function executeEval(cli: ObsidianCli, action: EvalAction, variables: Record<string, string>): void {
	const code = resolve(action.code, variables);
	const result = cli.eval(code);

	if (!result.success) {
		throw new Error(`Eval failed: ${result.error}`);
	}

	// Store result in variable map
	if (action.store) {
		variables[action.store] = result.value;
	}

	// Check expectation
	if (action.expect) {
		switch (action.expect.type) {
			case "equals": {
				const expected = resolve(action.expect.value, variables);
				if (result.value !== expected) {
					throw new Error(`Expected '${expected}', got '${result.value}'`);
				}
				break;
			}
			case "truthy":
				if (!result.value || result.value === "false" || result.value === "undefined" || result.value === "null") {
					throw new Error(`Expected truthy value, got '${result.value}'`);
				}
				break;
			case "json": {
				let parsed: Record<string, unknown>;
				try {
					parsed = JSON.parse(result.value) as Record<string, unknown>;
				} catch {
					throw new Error(`Expected JSON result, got '${result.value}'`);
				}
				for (const [key, expectedVal] of Object.entries(action.expect.match)) {
					const resolvedExpected = typeof expectedVal === "string" ? resolve(expectedVal, variables) : expectedVal;
					if (parsed[key] !== resolvedExpected) {
						throw new Error(`Expected ${key}='${String(resolvedExpected)}', got '${String(parsed[key])}'`);
					}
				}
				break;
			}
		}
	}
}
