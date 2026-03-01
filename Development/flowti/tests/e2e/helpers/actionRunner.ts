/**
 * Action runner — dispatches declarative actions to CLI tools.
 *
 * Each action in a journey step is dispatched by its `tool` field.
 * String fields support {{variable}} interpolation for cross-step
 * data passing (e.g. session IDs from eval → emit payloads).
 */
import * as path from "node:path";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { ActionDefinition, AssertAction, CloseLeavesAction, CreateFileAction, DeleteFileAction, EmitAction, EvalAction, NoticeAction, OpenFileAction, ScreenshotAction, ThemeAction } from "./journeyTypes";
import { highlightElement, highlightButton, highlightInput } from "./highlight";
import { navigateToTab } from "./navigation";
import { assertEventEmitted, PLUGIN_ID } from "./fixtures";

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

// ─── Action dispatcher ──────────────────────────────────────────────

/**
 * Executes a single action from a journey step definition.
 *
 * @param cli           — ObsidianCli instance
 * @param action        — Action definition from the journey config
 * @param variables     — Mutable variable map (shared across steps)
 * @param traceBookmark — Event trace index recorded at step start
 * @param collector     — Screenshot collector for accumulating filenames
 */
export async function executeAction(
	cli: ObsidianCli,
	action: ActionDefinition,
	variables: Record<string, string>,
	traceBookmark: number,
	collector?: ScreenshotCollector,
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
			executeHighlight(cli, resolve(action.selector, variables), action.style);
			break;
		case "wait":
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
		case "close-leaves":
			executeCloseLeaves(cli, action, variables);
			break;
		case "manual":
			// Manual actions are skipped during automated execution.
			// They serve as documentation for steps requiring human intervention.
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

function executeClick(cli: ObsidianCli, selector: string): void {
	const sel = escapeSelector(selector);
	const result = cli.eval(`document.querySelector('${sel}')?.click()`);
	if (!result.success) {
		throw new Error(`Click failed on '${selector}': ${result.error}`);
	}
}

function executeInput(cli: ObsidianCli, selector: string, value: string): void {
	const sel = escapeSelector(selector);
	const escapedValue = value.replace(/'/g, "\\'");
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

function executeHighlight(cli: ObsidianCli, selector: string, style?: "element" | "button" | "input"): void {
	switch (style) {
		case "button":
			highlightButton(cli, selector);
			break;
		case "input":
			highlightInput(cli, selector);
			break;
		default:
			highlightElement(cli, selector);
			break;
	}
}

function executeAssert(
	cli: ObsidianCli,
	action: AssertAction,
	variables: Record<string, string>,
	traceBookmark: number,
): void {
	switch (action.type) {
		case "visible": {
			const sel = escapeSelector(resolve(action.selector!, variables));
			const check = cli.eval(`!!document.querySelector('${sel}')`);
			if (!check.success || check.value !== "true") {
				throw new Error(`Expected element '${action.selector}' to be visible`);
			}
			break;
		}
		case "not-visible": {
			const sel = escapeSelector(resolve(action.selector!, variables));
			const check = cli.eval(`!!document.querySelector('${sel}')`);
			if (check.success && check.value === "true") {
				throw new Error(`Expected element '${action.selector}' to NOT be visible`);
			}
			break;
		}
		case "text": {
			const sel = escapeSelector(resolve(action.selector!, variables));
			const check = cli.eval(`document.querySelector('${sel}')?.textContent ?? ''`);
			if (!check.success || !check.value.includes(resolve(action.contains!, variables))) {
				throw new Error(`Expected element '${action.selector}' to contain '${action.contains}', got '${check.value}'`);
			}
			break;
		}
		case "event": {
			const event = resolve(action.event!, variables);
			const payload = action.payload ? resolvePayload(action.payload, variables) : undefined;
			assertEventEmitted(cli, traceBookmark, event, payload);
			// Mark as asserted for Activity Log highlighting
			cli.eval(
				`(() => { const p = app.plugins.plugins['${PLUGIN_ID}']; if (p) { if (!p._e2eAssertedEvents) p._e2eAssertedEvents = []; p._e2eAssertedEvents.push('${event}'); } })()`,
			);
			break;
		}
		case "leaf": {
			const viewType = resolve(action.viewType!, variables);
			const check = cli.eval(`app.workspace.getLeavesOfType('${viewType}').length`);
			if (!check.success || Number(check.value) === 0) {
				throw new Error(`No leaf found with view type '${viewType}'`);
			}
			break;
		}
		case "eval": {
			const code = resolve(action.code!, variables);
			const check = cli.eval(code);
			if (!check.success) {
				throw new Error(`Eval assertion failed: ${check.error}`);
			}
			const expected = resolve(action.expected!, variables);
			if (check.value !== expected) {
				throw new Error(`Expected '${expected}', got '${check.value}'`);
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
	const escapedMessage = message.replace(/'/g, "\\'");
	const result = cli.eval(`new Notice('${escapedMessage}', ${duration})`);
	if (!result.success) {
		throw new Error(`Notice failed: ${result.error}`);
	}
}

function executeTheme(cli: ObsidianCli, action: ThemeAction, variables: Record<string, string>): void {
	const theme = resolve(action.theme, variables);
	const escapedTheme = theme.replace(/'/g, "\\'");
	// Use the three-step Obsidian internal API: setTheme + persist + trigger CSS refresh
	// (ref: obsidian-system-dark-mode plugin by kepano)
	const result = cli.eval([
		`(() => {`,
		`  app.setTheme('${escapedTheme}');`,
		`  app.vault.setConfig('theme', '${escapedTheme}');`,
		`  app.workspace.trigger('css-change');`,
		`})()`,
	].join(" "));
	if (!result.success) {
		throw new Error(`Theme switch to '${theme}' failed: ${result.error}`);
	}
}

// ─── Lifecycle tool implementations ─────────────────────────────────

function executeCreateFile(cli: ObsidianCli, action: CreateFileAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	const content = resolve(action.content, variables);
	const escapedPath = filePath.replace(/'/g, "\\'");
	const escapedContent = content.replace(/'/g, "\\'").replace(/\n/g, "\\n");
	const result = cli.eval([
		`(async () => {`,
		`  await app.vault.create('${escapedPath}', '${escapedContent}');`,
		`  return '${escapedPath}';`,
		`})()`,
	].join(" "));
	if (!result.success) {
		throw new Error(`create-file '${filePath}' failed: ${result.error}`);
	}
	if (action.store) {
		variables[action.store] = filePath;
	}
}

function executeDeleteFile(cli: ObsidianCli, action: DeleteFileAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	const escapedPath = filePath.replace(/'/g, "\\'");
	const result = cli.eval([
		`(async () => {`,
		`  const f = app.vault.getAbstractFileByPath('${escapedPath}');`,
		`  if (f) await app.vault.delete(f, true);`,
		`  return f ? 'deleted' : 'not-found';`,
		`})()`,
	].join(" "));
	if (!result.success) {
		throw new Error(`delete-file '${filePath}' failed: ${result.error}`);
	}
}

function executeOpenFile(cli: ObsidianCli, action: OpenFileAction, variables: Record<string, string>): void {
	const filePath = resolve(action.path, variables);
	const escapedPath = filePath.replace(/'/g, "\\'");
	const result = cli.eval([
		`(async () => {`,
		`  const f = app.vault.getAbstractFileByPath('${escapedPath}');`,
		`  if (f && f.extension !== undefined) {`,
		`    const leaf = app.workspace.getLeaf('tab');`,
		`    await leaf.openFile(f);`,
		`    return 'opened';`,
		`  }`,
		`  return 'not-found';`,
		`})()`,
	].join(" "));
	if (!result.success) {
		throw new Error(`open-file '${filePath}' failed: ${result.error}`);
	}
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
