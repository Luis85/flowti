/**
 * Tool executor — dispatches journey actions to ToolHost methods.
 *
 * Pure variable interpolation + 34-tool dispatch map.
 * Each tool translates a JourneyAction into direct DOM / API calls
 * via the ToolHost abstraction.
 */

import type { JourneyAction, JourneyToolName } from "../journeyBuilder/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { ToolHost, ExecutionOptions } from "./types";

// ── Variable interpolation ──────────────────────────────────

/** Replace {{var}} placeholders with values from the variables map. */
export function resolve(template: string, variables: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		if (key in variables) return variables[key];
		throw new Error(`Variable '{{${key}}}' not found. Available: ${Object.keys(variables).join(", ")}`);
	});
}

/** Deep-resolve string values in a payload object. */
export function resolvePayload(
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

// ── Destructive tools ───────────────────────────────────────

/** Tools that modify the vault and require confirmation on user vault. */
export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
	"create-file",
	"delete-file",
	"copy-file",
	"move-file",
	"seed",
]);

// ── Helpers ─────────────────────────────────────────────────

function str(value: unknown): string {
	return typeof value === "string" ? value : String(value ?? "");
}

function num(value: unknown, fallback: number): number {
	return typeof value === "number" ? value : fallback;
}

async function confirmDestructive(
	action: JourneyAction,
	options: ExecutionOptions,
): Promise<boolean> {
	if (options.dryRun) return false;
	if (!DESTRUCTIVE_TOOLS.has(action.tool)) return true;
	if (!options.onConfirmDestructive) return true;
	return options.onConfirmDestructive(`${action.tool}: ${str(action.path ?? action.id ?? "")}`);
}

// ── Main dispatch ───────────────────────────────────────────

/** Execute a single journey action. */
export async function executeAction(
	action: JourneyAction,
	host: ToolHost,
	eventBus: IEventBus,
	variables: Record<string, string>,
	options: ExecutionOptions,
): Promise<void> {
	const tool = action.tool as JourneyToolName;

	switch (tool) {
		// ── Interaction ──────────────────────────────────────
		case "command": {
			const id = resolve(str(action.id), variables);
			if (options.dryRun) return;
			host.executeCommand(id);
			return;
		}
		case "click": {
			const selector = resolve(str(action.selector), variables);
			if (options.dryRun) return;
			const el = host.querySelector(selector) as HTMLElement | null;
			if (!el) throw new Error(`Element not found: ${selector}`);
			el.click();
			return;
		}
		case "input": {
			const selector = resolve(str(action.selector), variables);
			const value = resolve(str(action.value), variables);
			if (options.dryRun) return;
			const el = host.querySelector(selector) as HTMLInputElement | null;
			if (!el) throw new Error(`Input not found: ${selector}`);
			const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
			if (nativeSetter) nativeSetter.call(el, value);
			else el.value = value;
			el.dispatchEvent(new Event("input", { bubbles: true }));
			el.dispatchEvent(new Event("change", { bubbles: true }));
			return;
		}
		case "set-input": {
			const selector = resolve(str(action.selector), variables);
			const value = resolve(str(action.value), variables);
			if (options.dryRun) return;
			const el = host.querySelector(selector) as HTMLInputElement | null;
			if (!el) throw new Error(`Input not found: ${selector}`);
			el.value = value;
			el.dispatchEvent(new Event("input", { bubbles: true }));
			el.dispatchEvent(new Event("change", { bubbles: true }));
			return;
		}
		case "highlight": {
			const selector = resolve(str(action.selector), variables);
			if (options.dryRun) return;
			const el = host.querySelector(selector) as HTMLElement | null;
			if (el) {
				el.classList.add("ft-highlight");
				if (action.duration !== false) {
					setTimeout(() => el.classList.remove("ft-highlight"), num(action.duration, 2000));
				}
			}
			return;
		}
		case "navigate": {
			const path = resolve(str(action.path ?? action.file ?? ""), variables);
			if (options.dryRun) return;
			if (path) await host.openFile(path);
			return;
		}
		case "ribbon": {
			const label = resolve(str(action.label), variables);
			if (options.dryRun) return;
			const found = host.clickRibbon(label);
			if (!found) throw new Error(`Ribbon button not found: ${label}`);
			return;
		}
		case "scroll-to": {
			const selector = resolve(str(action.selector), variables);
			if (options.dryRun) return;
			host.scrollTo(selector, str(action.behavior ?? "smooth"), str(action.block ?? "center"));
			return;
		}
		case "select": {
			const selector = resolve(str(action.selector), variables);
			const value = resolve(str(action.value), variables);
			if (options.dryRun) return;
			const el = host.querySelector(selector) as HTMLSelectElement | null;
			if (!el) throw new Error(`Select not found: ${selector}`);
			el.value = value;
			el.dispatchEvent(new Event("change", { bubbles: true }));
			return;
		}

		// ── Assertion ────────────────────────────────────────
		case "assert": {
			executeAssert(action, host, eventBus, variables);
			return;
		}
		case "assert-text": {
			const selector = resolve(str(action.selector), variables);
			const contains = resolve(str(action.contains), variables);
			const el = host.querySelector(selector);
			if (!el) throw new Error(`Element not found: ${selector}`);
			const text = el.textContent ?? "";
			if (!text.includes(contains)) {
				throw new Error(`assert-text failed: "${text}" does not contain "${contains}"`);
			}
			return;
		}
		case "assert-number": {
			const selector = resolve(str(action.selector), variables);
			const op = str(action.operator ?? "eq");
			const expected = num(action.value, 0);
			const el = host.querySelector(selector);
			if (!el) throw new Error(`Element not found: ${selector}`);
			const actual = parseFloat(el.textContent ?? "");
			if (isNaN(actual)) throw new Error(`assert-number: "${el.textContent}" is not a number`);
			if (!compareNumber(actual, op, expected)) {
				throw new Error(`assert-number failed: ${actual} ${op} ${expected}`);
			}
			return;
		}
		case "assert-value": {
			const selector = resolve(str(action.selector), variables);
			const el = host.querySelector(selector) as HTMLInputElement | null;
			if (!el) throw new Error(`Element not found: ${selector}`);
			const actual = el.value ?? el.textContent ?? "";
			if (action.equals !== undefined) {
				const expected = resolve(str(action.equals), variables);
				if (actual !== expected) throw new Error(`assert-value: "${actual}" !== "${expected}"`);
			} else if (action.contains !== undefined) {
				const expected = resolve(str(action.contains), variables);
				if (!actual.includes(expected)) throw new Error(`assert-value: "${actual}" does not contain "${expected}"`);
			}
			return;
		}

		// ── Lifecycle ────────────────────────────────────────
		case "create-file": {
			const path = resolve(str(action.path), variables);
			const content = resolve(str(action.content ?? ""), variables);
			if (!(await confirmDestructive(action, options))) return;
			await host.createFile(path, content);
			if (action.store) variables[str(action.store)] = path;
			return;
		}
		case "delete-file": {
			const path = resolve(str(action.path), variables);
			if (!(await confirmDestructive(action, options))) return;
			await host.deleteFile(path);
			return;
		}
		case "copy-file": {
			const from = resolve(str(action.from), variables);
			const to = resolve(str(action.to), variables);
			if (!(await confirmDestructive(action, options))) return;
			await host.copyFile(from, to);
			return;
		}
		case "move-file": {
			const from = resolve(str(action.from), variables);
			const to = resolve(str(action.to), variables);
			if (!(await confirmDestructive(action, options))) return;
			await host.moveFile(from, to);
			return;
		}
		case "open-file": {
			const path = resolve(str(action.path), variables);
			if (options.dryRun) return;
			await host.openFile(path);
			return;
		}
		case "open-url": {
			const url = resolve(str(action.url), variables);
			if (options.dryRun) return;
			host.openUrl(url);
			return;
		}
		case "close-leaves": {
			if (options.dryRun) return;
			const viewType = action.viewType ? resolve(str(action.viewType), variables) : undefined;
			host.closeLeaves(viewType);
			return;
		}
		case "close-modals": {
			if (options.dryRun) return;
			host.closeModals();
			return;
		}
		case "seed": {
			const id = resolve(str(action.id), variables);
			const mode = str(action.mode ?? "reset");
			if (!(await confirmDestructive(action, options))) return;
			await host.seed(id, mode);
			return;
		}

		// ── Feedback ─────────────────────────────────────────
		case "wait": {
			const ms = num(action.ms, 500);
			if (options.dryRun) return;
			await new Promise<void>((r) => setTimeout(r, ms));
			return;
		}
		case "screenshot": {
			// Screenshots are CLI-only — no-op in-app
			if (action.label) {
				host.showNotice(`Screenshot: ${resolve(str(action.label), variables)}`);
			}
			return;
		}
		case "notice": {
			const message = resolve(str(action.message), variables);
			if (options.dryRun) return;
			host.showNotice(message, num(action.duration, 4000));
			return;
		}
		case "theme": {
			const theme = resolve(str(action.theme), variables);
			if (options.dryRun) return;
			host.setTheme(theme);
			return;
		}
		case "manual": {
			const instruction = resolve(str(action.instruction ?? action.description ?? ""), variables);
			if (options.dryRun) return;
			if (options.onManualInput) {
				const result = await options.onManualInput(instruction);
				if (result === "fail") throw new Error(`Manual verification failed: ${instruction}`);
			}
			return;
		}
		case "visual-inspection": {
			const prompt = resolve(str(action.prompt ?? action.description ?? ""), variables);
			if (options.dryRun) return;
			if (options.onManualInput) {
				const result = await options.onManualInput(prompt);
				if (result === "fail") throw new Error(`Visual inspection failed: ${prompt}`);
			}
			return;
		}
		case "spinner": {
			const id = str(action.id ?? "default");
			if (options.dryRun) return;
			if (action.action === "hide") {
				host.hideSpinner(id);
			} else {
				host.showSpinner(id, resolve(str(action.message ?? ""), variables));
			}
			return;
		}
		case "write-run-log": {
			const path = resolve(str(action.path), variables);
			const content = resolve(str(action.content ?? action.message ?? ""), variables);
			if (options.dryRun) return;
			await host.writeRunLog(path, content);
			return;
		}

		// ── Data ─────────────────────────────────────────────
		case "emit": {
			const event = resolve(str(action.event), variables);
			const payload = resolvePayload(action.payload as Record<string, unknown> | undefined, variables);
			if (options.dryRun) return;
			void eventBus.emit(event as never, payload as never);
			return;
		}
		case "eval": {
			const code = resolve(str(action.code), variables);
			if (options.dryRun) return;
			const fn = new Function(code);
			const result = fn();
			const value = result !== undefined ? String(result) : "";
			if (action.store) variables[str(action.store)] = value;
			if (action.expect !== undefined) {
				const expected = resolve(str(action.expect), variables);
				if (value !== expected) {
					throw new Error(`eval assert failed: "${value}" !== "${expected}"`);
				}
			}
			return;
		}
		case "frontmatter": {
			const path = resolve(str(action.path), variables);
			const mode = str(action.mode ?? "read");
			if (mode === "read") {
				const fm = host.getFrontmatter(path);
				const property = resolve(str(action.property), variables);
				const value = fm ? String(fm[property] ?? "") : "";
				if (action.store) variables[str(action.store)] = value;
			} else {
				if (options.dryRun) return;
				const property = resolve(str(action.property), variables);
				const value = resolve(str(action.value), variables);
				await host.updateFrontmatter(path, { [property]: value });
			}
			return;
		}
		case "query-trace": {
			const event = resolve(str(action.event), variables);
			const since = num(action.since, 0);
			const trace = host.getEventTrace(event, since);
			if (action.store) variables[str(action.store)] = JSON.stringify(trace);
			if (action.minCount !== undefined) {
				const expected = num(action.minCount, 1);
				if (trace.length < expected) {
					throw new Error(`query-trace: expected ≥${expected} events for "${event}", got ${trace.length}`);
				}
			}
			return;
		}

		default: {
			throw new Error(`Unknown tool: ${tool}`);
		}
	}
}

// ── Assert subtypes ─────────────────────────────────────────

function executeAssert(
	action: JourneyAction,
	host: ToolHost,
	eventBus: IEventBus,
	variables: Record<string, string>,
): void {
	const subtype = str(action.type ?? "visible");

	switch (subtype) {
		case "visible": {
			const selector = resolve(str(action.selector), variables);
			const el = host.querySelector(selector);
			if (!el) throw new Error(`assert visible: element not found — ${selector}`);
			return;
		}
		case "not-visible": {
			const selector = resolve(str(action.selector), variables);
			const el = host.querySelector(selector);
			if (el) throw new Error(`assert not-visible: element found — ${selector}`);
			return;
		}
		case "text": {
			const selector = resolve(str(action.selector), variables);
			const contains = resolve(str(action.contains), variables);
			const el = host.querySelector(selector);
			if (!el) throw new Error(`assert text: element not found — ${selector}`);
			const text = el.textContent ?? "";
			if (!text.includes(contains)) {
				throw new Error(`assert text: "${text}" does not contain "${contains}"`);
			}
			return;
		}
		case "count": {
			const selector = resolve(str(action.selector), variables);
			const expected = num(action.count, 0);
			const op = str(action.operator ?? "eq");
			const els = host.querySelectorAll(selector);
			if (!compareNumber(els.length, op, expected)) {
				throw new Error(`assert count: ${els.length} ${op} ${expected} (selector: ${selector})`);
			}
			return;
		}
		case "leaf": {
			const viewType = resolve(str(action.viewType), variables);
			// Check DOM for view-type containers
			const selector = `[data-type="${viewType}"]`;
			const el = host.querySelector(selector);
			if (!el) throw new Error(`assert leaf: no leaf of type "${viewType}"`);
			return;
		}
		case "attr": {
			const selector = resolve(str(action.selector), variables);
			const attr = resolve(str(action.attr), variables);
			const expected = resolve(str(action.value ?? action.contains ?? ""), variables);
			const el = host.querySelector(selector);
			if (!el) throw new Error(`assert attr: element not found — ${selector}`);
			const actual = el.getAttribute(attr) ?? "";
			if (expected && !actual.includes(expected)) {
				throw new Error(`assert attr: "${actual}" does not contain "${expected}" (attr: ${attr})`);
			}
			return;
		}
		case "eval": {
			const code = resolve(str(action.code), variables);
			const fn = new Function(code);
			const result = fn();
			if (!result) throw new Error(`assert eval: expression returned falsy`);
			return;
		}
		case "event": {
			const event = resolve(str(action.event), variables);
			const trace = host.getEventTrace(event);
			if (trace.length === 0) {
				throw new Error(`assert event: no "${event}" events found in trace`);
			}
			return;
		}
		default:
			throw new Error(`Unknown assert subtype: ${subtype}`);
	}
}

// ── Number comparison ───────────────────────────────────────

function compareNumber(actual: number, op: string, expected: number): boolean {
	switch (op) {
		case "eq": return actual === expected;
		case "gt": return actual > expected;
		case "gte": return actual >= expected;
		case "lt": return actual < expected;
		case "lte": return actual <= expected;
		case "neq": return actual !== expected;
		default: return actual === expected;
	}
}
