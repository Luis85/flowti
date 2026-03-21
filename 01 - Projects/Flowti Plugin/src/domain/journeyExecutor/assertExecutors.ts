/**
 * Assert executors — handles journey assert actions (visible, text, count, etc.).
 *
 * Extracted from toolExecutors to reduce file size.
 */

import type { JourneyAction } from "../journeyBuilder/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { ToolHost } from "./types";
import { resolve } from "./toolExecutors";

function str(value: unknown): string {
	return typeof value === "string" ? value : String(value ?? "");
}

function num(value: unknown, fallback: number): number {
	return typeof value === "number" ? value : fallback;
}

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

function assertVisible(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const selector = resolve(str(action.selector), variables);
	const el = host.querySelector(selector);
	if (!el) throw new Error(`assert visible: element not found — ${selector}`);
}

function assertNotVisible(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const selector = resolve(str(action.selector), variables);
	const el = host.querySelector(selector);
	if (el) throw new Error(`assert not-visible: element found — ${selector}`);
}

function assertText(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const selector = resolve(str(action.selector), variables);
	const contains = resolve(str(action.contains), variables);
	const el = host.querySelector(selector);
	if (!el) throw new Error(`assert text: element not found — ${selector}`);
	const text = el.textContent ?? "";
	if (!text.includes(contains)) {
		throw new Error(`assert text: "${text}" does not contain "${contains}"`);
	}
}

function assertCount(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const selector = resolve(str(action.selector), variables);
	const expected = num(action.count, 0);
	const op = str(action.operator ?? "eq");
	const els = host.querySelectorAll(selector);
	if (!compareNumber(els.length, op, expected)) {
		throw new Error(`assert count: ${els.length} ${op} ${expected} (selector: ${selector})`);
	}
}

function assertLeaf(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const viewType = resolve(str(action.viewType), variables);
	const selector = `[data-type="${viewType}"]`;
	const el = host.querySelector(selector);
	if (!el) throw new Error(`assert leaf: no leaf of type "${viewType}"`);
}

function assertAttr(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const selector = resolve(str(action.selector), variables);
	const attr = resolve(str(action.attr), variables);
	const expected = resolve(str(action.value ?? action.contains ?? ""), variables);
	const el = host.querySelector(selector);
	if (!el) throw new Error(`assert attr: element not found — ${selector}`);
	const actual = el.getAttribute(attr) ?? "";
	if (expected && !actual.includes(expected)) {
		throw new Error(`assert attr: "${actual}" does not contain "${expected}" (attr: ${attr})`);
	}
}

function assertEval(action: JourneyAction, variables: Record<string, string>): void {
	const code = resolve(str(action.code), variables);
	const fn = new Function(code);
	const result = fn();
	if (!result) throw new Error(`assert eval: expression returned falsy`);
}

function assertEvent(action: JourneyAction, host: ToolHost, variables: Record<string, string>): void {
	const event = resolve(str(action.event), variables);
	const trace = host.getEventTrace(event);
	if (trace.length === 0) {
		throw new Error(`assert event: no "${event}" events found in trace`);
	}
}

const ASSERT_HANDLERS: Record<string, (action: JourneyAction, host: ToolHost, eventBus: IEventBus, variables: Record<string, string>) => void> = {
	"visible": (a, h, _e, v) => assertVisible(a, h, v),
	"not-visible": (a, h, _e, v) => assertNotVisible(a, h, v),
	"text": (a, h, _e, v) => assertText(a, h, v),
	"count": (a, h, _e, v) => assertCount(a, h, v),
	"leaf": (a, h, _e, v) => assertLeaf(a, h, v),
	"attr": (a, h, _e, v) => assertAttr(a, h, v),
	"eval": (a, _h, _e, v) => assertEval(a, v),
	"event": (a, h, _e, v) => assertEvent(a, h, v),
};

/** Execute an assert action by subtype. */
export function executeAssert(
	action: JourneyAction,
	host: ToolHost,
	eventBus: IEventBus,
	variables: Record<string, string>,
): void {
	const subtype = str(action.type ?? "visible");
	const handler = ASSERT_HANDLERS[subtype];
	if (!handler) throw new Error(`Unknown assert subtype: ${subtype}`);
	handler(action, host, eventBus, variables);
}

/** Compare two numbers using a named operator. */
export { compareNumber };
