/**
 * Action runner — dispatches declarative actions to CLI tools.
 *
 * Each action in a journey step is dispatched by its `tool` field.
 * String fields support {{variable}} interpolation for cross-step
 * data passing (e.g. session IDs from eval → emit payloads).
 */
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { ActionDefinition, AssertAction, EmitAction, EvalAction } from "./journeyTypes";
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

// ─── Action dispatcher ──────────────────────────────────────────────

/**
 * Executes a single action from a journey step definition.
 *
 * @param cli         — ObsidianCli instance
 * @param action      — Action definition from the journey config
 * @param variables   — Mutable variable map (shared across steps)
 * @param traceBookmark — Event trace index recorded at step start
 * @param screenshotPath — Absolute path for manual screenshots (rare)
 */
export async function executeAction(
	cli: ObsidianCli,
	action: ActionDefinition,
	variables: Record<string, string>,
	traceBookmark: number,
	screenshotPath?: string,
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
		case "screenshot":
			if (screenshotPath) cli.screenshot(screenshotPath);
			break;
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
	}
}

// ─── Tool implementations ───────────────────────────────────────────

function executeCommand(cli: ObsidianCli, commandId: string): void {
	// Prefix with plugin ID if not already prefixed
	const fullId = commandId.includes(":")
		? `${PLUGIN_ID}:${commandId}`
		: commandId;
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
			case "equals":
				if (result.value !== action.expect.value) {
					throw new Error(`Expected '${action.expect.value}', got '${result.value}'`);
				}
				break;
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
				for (const [key, expected] of Object.entries(action.expect.match)) {
					if (parsed[key] !== expected) {
						throw new Error(`Expected ${key}='${String(expected)}', got '${String(parsed[key])}'`);
					}
				}
				break;
			}
		}
	}
}
