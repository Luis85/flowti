/**
 * Tool executor — dispatches journey actions to ToolHost methods.
 *
 * Pure variable interpolation + 34-tool dispatch map.
 * Each tool translates a JourneyAction into direct DOM / API calls
 * via the ToolHost abstraction.
 */

import type { JourneyAction } from "../journeyBuilder/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { ToolHost, ExecutionOptions } from "./types";
import { executeAssert, compareNumber } from "./assertExecutors";

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

// ── Tool handler type ────────────────────────────────────────

type ToolHandler = (
	action: JourneyAction,
	host: ToolHost,
	eventBus: IEventBus,
	variables: Record<string, string>,
	options: ExecutionOptions,
) => Promise<void>;

// ── Interaction tools ───────────────────────────────────────

async function handleCommand(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const id = resolve(str(action.id), variables);
	if (options.dryRun) return;
	host.executeCommand(id);
}

async function handleClick(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const selector = resolve(str(action.selector), variables);
	if (options.dryRun) return;
	const el = host.querySelector(selector) as HTMLElement | null;
	if (!el) throw new Error(`Element not found: ${selector}`);
	el.click();
}

async function handleInput(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
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
}

async function handleSetInput(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const selector = resolve(str(action.selector), variables);
	const value = resolve(str(action.value), variables);
	if (options.dryRun) return;
	const el = host.querySelector(selector) as HTMLInputElement | null;
	if (!el) throw new Error(`Input not found: ${selector}`);
	el.value = value;
	el.dispatchEvent(new Event("input", { bubbles: true }));
	el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function handleHighlight(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const selector = resolve(str(action.selector), variables);
	if (options.dryRun) return;
	const el = host.querySelector(selector) as HTMLElement | null;
	if (el) {
		el.classList.add("ft-highlight");
		if (action.duration !== false) {
			setTimeout(() => el.classList.remove("ft-highlight"), num(action.duration, 2000));
		}
	}
}

async function handleNavigate(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const path = resolve(str(action.path ?? action.file ?? ""), variables);
	if (options.dryRun) return;
	if (path) await host.openFile(path);
}

async function handleRibbon(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const label = resolve(str(action.label), variables);
	if (options.dryRun) return;
	const found = host.clickRibbon(label);
	if (!found) throw new Error(`Ribbon button not found: ${label}`);
}

async function handleScrollTo(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const selector = resolve(str(action.selector), variables);
	if (options.dryRun) return;
	host.scrollTo(selector, str(action.behavior ?? "smooth"), str(action.block ?? "center"));
}

async function handleSelect(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const selector = resolve(str(action.selector), variables);
	const value = resolve(str(action.value), variables);
	if (options.dryRun) return;
	const el = host.querySelector(selector) as HTMLSelectElement | null;
	if (!el) throw new Error(`Select not found: ${selector}`);
	el.value = value;
	el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── Assertion tools ─────────────────────────────────────────

async function handleAssert(action: JourneyAction, host: ToolHost, eventBus: IEventBus, variables: Record<string, string>): Promise<void> {
	executeAssert(action, host, eventBus, variables);
}

async function handleAssertText(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>): Promise<void> {
	const selector = resolve(str(action.selector), variables);
	const contains = resolve(str(action.contains), variables);
	const el = host.querySelector(selector);
	if (!el) throw new Error(`Element not found: ${selector}`);
	const text = el.textContent ?? "";
	if (!text.includes(contains)) {
		throw new Error(`assert-text failed: "${text}" does not contain "${contains}"`);
	}
}

async function handleAssertNumber(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>): Promise<void> {
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
}

async function handleAssertValue(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>): Promise<void> {
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
}

// ── Lifecycle tools ─────────────────────────────────────────

async function handleCreateFile(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const path = resolve(str(action.path), variables);
	const content = resolve(str(action.content ?? ""), variables);
	if (!(await confirmDestructive(action, options))) return;
	await host.createFile(path, content);
	if (action.store) variables[str(action.store)] = path;
}

async function handleDeleteFile(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const path = resolve(str(action.path), variables);
	if (!(await confirmDestructive(action, options))) return;
	await host.deleteFile(path);
}

async function handleCopyFile(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const from = resolve(str(action.from), variables);
	const to = resolve(str(action.to), variables);
	if (!(await confirmDestructive(action, options))) return;
	await host.copyFile(from, to);
}

async function handleMoveFile(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const from = resolve(str(action.from), variables);
	const to = resolve(str(action.to), variables);
	if (!(await confirmDestructive(action, options))) return;
	await host.moveFile(from, to);
}

async function handleOpenFile(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const path = resolve(str(action.path), variables);
	if (options.dryRun) return;
	await host.openFile(path);
}

async function handleOpenUrl(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const url = resolve(str(action.url), variables);
	if (options.dryRun) return;
	host.openUrl(url);
}

async function handleCloseLeaves(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	if (options.dryRun) return;
	const viewType = action.viewType ? resolve(str(action.viewType), variables) : undefined;
	host.closeLeaves(viewType);
}

async function handleCloseModals(_action: JourneyAction, host: ToolHost, _eb: IEventBus, _variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	if (options.dryRun) return;
	host.closeModals();
}

async function handleSeed(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const id = resolve(str(action.id), variables);
	const mode = str(action.mode ?? "reset");
	if (!(await confirmDestructive(action, options))) return;
	await host.seed(id, mode);
}

// ── Feedback tools ──────────────────────────────────────────

async function handleWait(action: JourneyAction, _host: ToolHost, _eb: IEventBus, _variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const ms = num(action.ms, 500);
	if (options.dryRun) return;
	await new Promise<void>((r) => setTimeout(r, ms));
}

async function handleScreenshot(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>): Promise<void> {
	if (action.label) {
		host.showNotice(`Screenshot: ${resolve(str(action.label), variables)}`);
	}
}

async function handleNotice(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const message = resolve(str(action.message), variables);
	if (options.dryRun) return;
	host.showNotice(message, num(action.duration, 4000));
}

async function handleTheme(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const theme = resolve(str(action.theme), variables);
	if (options.dryRun) return;
	host.setTheme(theme);
}

async function handleManual(action: JourneyAction, _host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const instruction = resolve(str(action.instruction ?? action.description ?? ""), variables);
	if (options.dryRun) return;
	if (options.onManualInput) {
		const result = await options.onManualInput(instruction);
		if (result === "fail") throw new Error(`Manual verification failed: ${instruction}`);
	}
}

async function handleVisualInspection(action: JourneyAction, _host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const prompt = resolve(str(action.prompt ?? action.description ?? ""), variables);
	if (options.dryRun) return;
	if (options.onManualInput) {
		const result = await options.onManualInput(prompt);
		if (result === "fail") throw new Error(`Visual inspection failed: ${prompt}`);
	}
}

async function handleSpinner(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const id = str(action.id ?? "default");
	if (options.dryRun) return;
	if (action.action === "hide") {
		host.hideSpinner(id);
	} else {
		host.showSpinner(id, resolve(str(action.message ?? ""), variables));
	}
}

async function handleWriteRunLog(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const path = resolve(str(action.path), variables);
	const content = resolve(str(action.content ?? action.message ?? ""), variables);
	if (options.dryRun) return;
	await host.writeRunLog(path, content);
}

// ── Data tools ──────────────────────────────────────────────

async function handleEmit(action: JourneyAction, _host: ToolHost, eventBus: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
	const event = resolve(str(action.event), variables);
	const payload = resolvePayload(action.payload as Record<string, unknown> | undefined, variables);
	if (options.dryRun) return;
	void eventBus.emit(event as never, payload as never);
}

async function handleEval(action: JourneyAction, _host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
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
}

async function handleFrontmatter(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>, options: ExecutionOptions): Promise<void> {
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
}

async function handleQueryTrace(action: JourneyAction, host: ToolHost, _eb: IEventBus, variables: Record<string, string>): Promise<void> {
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
}

// ── Tool dispatch map ───────────────────────────────────────

const TOOL_HANDLERS: Record<string, ToolHandler> = {
	"command": handleCommand,
	"click": handleClick,
	"input": handleInput,
	"set-input": handleSetInput,
	"highlight": handleHighlight,
	"navigate": handleNavigate,
	"ribbon": handleRibbon,
	"scroll-to": handleScrollTo,
	"select": handleSelect,
	"assert": handleAssert,
	"assert-text": handleAssertText,
	"assert-number": handleAssertNumber,
	"assert-value": handleAssertValue,
	"create-file": handleCreateFile,
	"delete-file": handleDeleteFile,
	"copy-file": handleCopyFile,
	"move-file": handleMoveFile,
	"open-file": handleOpenFile,
	"open-url": handleOpenUrl,
	"close-leaves": handleCloseLeaves,
	"close-modals": handleCloseModals,
	"seed": handleSeed,
	"wait": handleWait,
	"screenshot": handleScreenshot,
	"notice": handleNotice,
	"theme": handleTheme,
	"manual": handleManual,
	"visual-inspection": handleVisualInspection,
	"spinner": handleSpinner,
	"write-run-log": handleWriteRunLog,
	"emit": handleEmit,
	"eval": handleEval,
	"frontmatter": handleFrontmatter,
	"query-trace": handleQueryTrace,
};

// ── Main dispatch ───────────────────────────────────────────

/** Execute a single journey action. */
export async function executeAction(
	action: JourneyAction,
	host: ToolHost,
	eventBus: IEventBus,
	variables: Record<string, string>,
	options: ExecutionOptions,
): Promise<void> {
	const handler = TOOL_HANDLERS[action.tool];
	if (!handler) throw new Error(`Unknown tool: ${action.tool}`);
	await handler(action, host, eventBus, variables, options);
}

// compareNumber and executeAssert are imported from ./assertExecutors
