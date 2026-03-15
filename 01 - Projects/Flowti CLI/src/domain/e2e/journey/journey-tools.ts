/**
 * journey-tools.ts — Base tool implementations for journey execution.
 *
 * Base tools are available in every environment regardless of project target.
 * Environment providers can add target-specific tools on top of these.
 */

import type { JourneyAction, ActionResult, JourneyExecutorOptions } from "./journey-types.js";
import type { ToolDeps } from "./journey-executor.js";

export type ToolExecutor = (
	action: JourneyAction,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
) => ActionResult | Promise<ActionResult>;

function ms(start: number, deps: ToolDeps): number {
	return deps.clock.ms() - start;
}

export function interpolate(value: unknown, variables: Record<string, unknown>): unknown {
	if (typeof value !== "string") return value;
	return value.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
		const v = variables[key];
		return v != null ? String(v) : `{{${key}}}`;
	});
}

export function resolveString(action: JourneyAction, key: string, variables: Record<string, unknown>): string {
	return interpolate(action[key], variables) as string ?? "";
}

function result(tool: string, success: boolean, start: number, deps: ToolDeps, extra?: Partial<ActionResult>): ActionResult {
	return { tool, success, durationMs: ms(start, deps), ...extra };
}

// ── command ──────────────────────────────────────────────────────────

export const toolCommand: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const cmd = resolveString(action, "id", opts.variables ?? {});
	if (!cmd) return result("command", false, start, deps, { error: "No command specified" });

	try {
		const r = deps.exec(cmd, { cwd: opts.cwd, timeout: opts.commandTimeout ?? 30000, env: opts.env });
		return result("command", r.exitCode === 0, start, deps, {
			output: r.stdout,
			error: r.exitCode !== 0 ? `Exit code ${r.exitCode}: ${r.stderr}` : undefined,
		});
	} catch (e) {
		return result("command", false, start, deps, { error: String(e) });
	}
};

// ── assert (each type is a separate function) ────────────────────────

function assertExitCode(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, start: number): ActionResult {
	const expected = action.expected as number ?? 0;
	const cmd = resolveString(action, "command", opts.variables ?? {});
	if (!cmd) return result("assert", false, start, deps, { error: "No command for exit-code assert" });
	const r = deps.exec(cmd, { cwd: opts.cwd, timeout: opts.commandTimeout, env: opts.env });
	const ok = r.exitCode === expected;
	return result("assert", ok, start, deps, { output: `exit=${r.exitCode}, expected=${expected}`, error: ok ? undefined : `Expected exit code ${expected}, got ${r.exitCode}` });
}

function assertStdoutContains(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, start: number): ActionResult {
	const variables = opts.variables ?? {};
	const cmd = resolveString(action, "command", variables);
	const contains = resolveString(action, "contains", variables);
	const r = deps.exec(cmd, { cwd: opts.cwd, timeout: opts.commandTimeout, env: opts.env });
	const ok = r.stdout.includes(contains);
	return result("assert", ok, start, deps, { output: r.stdout.slice(0, 200), error: ok ? undefined : `stdout does not contain "${contains}"` });
}

function assertFileExists(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, start: number): ActionResult {
	const path = resolveString(action, "path", opts.variables ?? {});
	const ok = deps.exists(path);
	return result("assert", ok, start, deps, { error: ok ? undefined : `File not found: ${path}` });
}

function assertFileContains(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, start: number): ActionResult {
	const variables = opts.variables ?? {};
	const path = resolveString(action, "path", variables);
	const contains = resolveString(action, "contains", variables);
	try {
		const content = deps.readFile(path);
		const ok = content.includes(contains);
		return result("assert", ok, start, deps, { error: ok ? undefined : `File "${path}" does not contain "${contains}"` });
	} catch (e) {
		return result("assert", false, start, deps, { error: `Cannot read file: ${e}` });
	}
}

function assertFrontmatterEquals(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, start: number): ActionResult {
	const variables = opts.variables ?? {};
	const path = resolveString(action, "path", variables);
	const field = resolveString(action, "field", variables);
	const expected = resolveString(action, "expected", variables);
	try {
		const content = deps.readFile(path);
		const fm = parseFrontmatterFromContent(content);
		if (!fm) return result("assert", false, start, deps, { error: `No frontmatter found in: ${path}` });
		const actual = String(fm[field] ?? "");
		const ok = actual === expected;
		return result("assert", ok, start, deps, { output: `${field}=${actual}`, error: ok ? undefined : `Expected ${field}="${expected}", got "${actual}"` });
	} catch (e) {
		return result("assert", false, start, deps, { error: `Cannot read file: ${e}` });
	}
}

const ASSERT_HANDLERS: Record<string, (action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, start: number) => ActionResult> = {
	"exit-code": assertExitCode,
	"stdout-contains": assertStdoutContains,
	"file-exists": assertFileExists,
	"file-contains": assertFileContains,
	"frontmatter-equals": assertFrontmatterEquals,
};

export const toolAssert: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const handler = ASSERT_HANDLERS[action.type as string];
	if (!handler) return result("assert", false, start, deps, { error: `Unknown assert type: ${action.type}` });
	return handler(action, deps, opts, start);
};

// ── wait ─────────────────────────────────────────────────────────────

export const toolWait: ToolExecutor = async (action, deps) => {
	const start = deps.clock.ms();
	const waitMs = (action.ms as number) ?? 100;
	await deps.sleep(waitMs);
	return result("wait", true, start, deps);
};

// ── log ──────────────────────────────────────────────────────────────

export const toolLog: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const message = resolveString(action, "message", opts.variables ?? {});
	deps.log(message);
	return result("log", true, start, deps, { output: message });
};

// ── file-write ───────────────────────────────────────────────────────

export const toolFileWrite: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	const content = resolveString(action, "content", opts.variables ?? {});
	try {
		deps.writeFile(path, content);
		return result("file-write", true, start, deps);
	} catch (e) {
		return result("file-write", false, start, deps, { error: String(e) });
	}
};

// ── file-read ────────────────────────────────────────────────────────

export const toolFileRead: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	try {
		const content = deps.readFile(path);
		const storeAs = action.storeAs as string;
		if (storeAs && opts.variables) {
			opts.variables[storeAs] = content;
		}
		return result("file-read", true, start, deps, { output: content.slice(0, 500) });
	} catch (e) {
		return result("file-read", false, start, deps, { error: String(e) });
	}
};

// ── file-exists ──────────────────────────────────────────────────────

export const toolFileExists: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	const ok = deps.exists(path);
	return result("file-exists", ok, start, deps, { error: ok ? undefined : `Path not found: ${path}` });
};

// ── screenshot ───────────────────────────────────────────────────────

export const toolScreenshot: ToolExecutor = (_action, deps) => {
	const start = deps.clock.ms();
	deps.log("[journey] screenshot (no-op in CLI mode)");
	return result("screenshot", true, start, deps, { output: "skipped (CLI mode)" });
};

// ── frontmatter ──────────────────────────────────────────────────────

/**
 * Inline frontmatter parser (no external dependency).
 * Parses YAML frontmatter between --- delimiters into a key-value record.
 */
function parseFrontmatterFromContent(content: string): Record<string, unknown> | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const fm: Record<string, unknown> = {};
	const lines = match[1].split(/\r?\n/);
	let currentKey: string | null = null;
	let inArray = false;

	for (const line of lines) {
		const parsed = parseFrontmatterLine(line, inArray, currentKey, fm);
		inArray = parsed.inArray;
		currentKey = parsed.currentKey;
	}

	return fm;
}

function parseScalarValue(raw: string): unknown {
	if (raw === "true") return true;
	if (raw === "false") return false;
	if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
	if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
	return raw.replace(/^["']|["']$/g, "");
}

function parseFrontmatterLine(
	line: string,
	inArray: boolean,
	currentKey: string | null,
	fm: Record<string, unknown>,
): { inArray: boolean; currentKey: string | null } {
	if (inArray && /^\s+-\s+/.test(line)) {
		const value = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
		(fm[currentKey!] as string[]).push(value);
		return { inArray: true, currentKey };
	}

	const kvMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
	if (!kvMatch) return { inArray: false, currentKey: null };

	const key = kvMatch[1];
	const rawValue = kvMatch[2].trim();

	if (rawValue === "" || rawValue === "[]") {
		fm[key] = [];
		return { inArray: rawValue === "", currentKey: key };
	}

	fm[key] = parseScalarValue(rawValue);
	return { inArray: false, currentKey: null };
}

/**
 * Serialize a frontmatter record back to a YAML block.
 */
function serializeFrontmatter(fm: Record<string, unknown>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${item}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	lines.push("---");
	return lines.join("\n");
}

// ── frontmatter op handlers ──────────────────────────────────────────

function fmRead(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, path: string, start: number): ActionResult {
	const content = deps.readFile(path);
	const fm = parseFrontmatterFromContent(content);
	if (!fm) return result("frontmatter", false, start, deps, { error: `No frontmatter in: ${path}` });
	const json = JSON.stringify(fm);
	const storeAs = action.storeAs as string;
	if (storeAs && opts.variables) opts.variables[storeAs] = json;
	return result("frontmatter", true, start, deps, { output: json.slice(0, 500) });
}

function fmGet(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, path: string, start: number): ActionResult {
	const field = resolveString(action, "field", opts.variables ?? {});
	if (!field) return result("frontmatter", false, start, deps, { error: "No field specified for get" });
	const content = deps.readFile(path);
	const fm = parseFrontmatterFromContent(content);
	if (!fm) return result("frontmatter", false, start, deps, { error: `No frontmatter in: ${path}` });
	const value = String(fm[field] ?? "");
	const storeAs = action.storeAs as string;
	if (storeAs && opts.variables) opts.variables[storeAs] = value;
	return result("frontmatter", true, start, deps, { output: `${field}=${value}` });
}

function fmSet(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, path: string, start: number): ActionResult {
	const variables = opts.variables ?? {};
	const field = resolveString(action, "field", variables);
	const value = resolveString(action, "value", variables);
	if (!field) return result("frontmatter", false, start, deps, { error: "No field specified for set" });
	const content = deps.readFile(path);
	const fm = parseFrontmatterFromContent(content) ?? {};
	fm[field] = value;
	const fmBlock = serializeFrontmatter(fm);
	const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
	deps.writeFile(path, fmBlock + body);
	return result("frontmatter", true, start, deps, { output: `${field}=${value}` });
}

function fmAssert(action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, path: string, start: number): ActionResult {
	const variables = opts.variables ?? {};
	const field = resolveString(action, "field", variables);
	const expected = resolveString(action, "expected", variables);
	if (!field) return result("frontmatter", false, start, deps, { error: "No field specified for assert" });
	const content = deps.readFile(path);
	const fm = parseFrontmatterFromContent(content);
	if (!fm) return result("frontmatter", false, start, deps, { error: `No frontmatter in: ${path}` });
	const actual = String(fm[field] ?? "");
	const ok = actual === expected;
	return result("frontmatter", ok, start, deps, { output: `${field}=${actual}`, error: ok ? undefined : `Expected ${field}="${expected}", got "${actual}"` });
}

const FM_HANDLERS: Record<string, (action: JourneyAction, deps: ToolDeps, opts: JourneyExecutorOptions, path: string, start: number) => ActionResult> = {
	read: fmRead,
	get: fmGet,
	set: fmSet,
	assert: fmAssert,
};

/**
 * frontmatter tool — read, write, set, or assert frontmatter in markdown files.
 */
export const toolFrontmatter: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const variables = opts.variables ?? {};
	const path = resolveString(action, "path", variables);
	const op = action.op as string;

	if (!path) return result("frontmatter", false, start, deps, { error: "No path specified" });
	if (!op) return result("frontmatter", false, start, deps, { error: "No op specified (read, get, set, assert)" });

	const handler = FM_HANDLERS[op];
	if (!handler) return result("frontmatter", false, start, deps, { error: `Unknown frontmatter op: ${op}` });

	try {
		return handler(action, deps, opts, path, start);
	} catch (e) {
		return result("frontmatter", false, start, deps, { error: String(e) });
	}
};

// ── Base tool registry ───────────────────────────────────────────────

/** Base tools available in every environment. */
export const BASE_TOOLS: Record<string, ToolExecutor> = {
	command: toolCommand,
	assert: toolAssert,
	wait: toolWait,
	log: toolLog,
	"file-write": toolFileWrite,
	"file-read": toolFileRead,
	"file-exists": toolFileExists,
	frontmatter: toolFrontmatter,
	screenshot: toolScreenshot,
};
