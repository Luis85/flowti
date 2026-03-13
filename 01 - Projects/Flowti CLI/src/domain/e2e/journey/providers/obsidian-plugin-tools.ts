/**
 * obsidian-plugin-tools.ts — Vault, event, and batch tool executors.
 *
 * Extracted from obsidian-plugin-provider.ts to keep file size under lint limits.
 * All tools follow the same pattern: resolve args → obsidian-cli exec → ActionResult.
 */

import type { ActionResult, JourneyExecutorOptions } from "../journey-types.js";
import type { ToolDeps } from "../journey-executor.js";
import type { ToolExecutor } from "../journey-tools.js";
import { resolveString } from "../journey-tools.js";

// ── Shared helpers (re-exported from provider) ──────────────────────

function ms(start: number, deps: ToolDeps): number {
	return deps.clock.ms() - start;
}

export function obsResult(tool: string, success: boolean, start: number, deps: ToolDeps, extra?: Partial<ActionResult>): ActionResult {
	return { tool, success, durationMs: ms(start, deps), ...extra };
}

export function obsidianExec(
	tool: string, command: string, deps: ToolDeps, opts: JourneyExecutorOptions, start: number, storeAs?: string,
): ActionResult {
	try {
		const r = deps.exec(`obsidian-cli ${command}`, {
			cwd: opts.cwd, timeout: opts.commandTimeout ?? 15000, env: opts.env,
		});
		if (storeAs && opts.variables) opts.variables[storeAs] = r.stdout.trim();
		return obsResult(tool, r.exitCode === 0, start, deps, {
			output: r.stdout.slice(0, 500),
			error: r.exitCode !== 0 ? `${tool} failed: ${r.stderr}` : undefined,
		});
	} catch (e) {
		return obsResult(tool, false, start, deps, { error: String(e) });
	}
}

// ── Vault Operation tools ────────────────────────────────────────────

export const toolCreateFile: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const path = resolveString(action, "path", vars);
	const content = resolveString(action, "content", vars) || "";
	if (!path) return obsResult("create-file", false, start, deps, { error: "No path specified" });
	try {
		deps.writeFile(path, content);
		return obsResult("create-file", true, start, deps, { output: `Created: ${path}` });
	} catch (e) {
		return obsResult("create-file", false, start, deps, { error: String(e) });
	}
};

export const toolDeleteFile: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	if (!path) return obsResult("delete-file", false, start, deps, { error: "No path specified" });
	return obsidianExec("delete-file", `eval "app.vault.adapter.remove('${path}')"`, deps, opts, start);
};

export const toolOpenFile: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	if (!path) return obsResult("open-file", false, start, deps, { error: "No path specified" });
	return obsidianExec("open-file", `open path="${path}"`, deps, opts, start);
};

export const toolCopyFile: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const src = resolveString(action, "src", vars);
	const dest = resolveString(action, "dest", vars);
	if (!src || !dest) return obsResult("copy-file", false, start, deps, { error: "src and dest required" });
	try {
		deps.writeFile(dest, deps.readFile(src));
		return obsResult("copy-file", true, start, deps, { output: `Copied ${src} → ${dest}` });
	} catch (e) {
		return obsResult("copy-file", false, start, deps, { error: String(e) });
	}
};

export const toolMoveFile: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const src = resolveString(action, "src", vars);
	const dest = resolveString(action, "dest", vars);
	if (!src || !dest) return obsResult("move-file", false, start, deps, { error: "src and dest required" });
	return obsidianExec("move-file", `eval "app.vault.adapter.rename('${src}', '${dest}')"`, deps, opts, start);
};

export const toolSeed: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const files = action.files as { path: string; content: string }[] ?? [];
	if (files.length === 0) return obsResult("seed", false, start, deps, { error: "No files to seed" });
	let created = 0;
	for (const f of files) {
		const path = resolveString({ ...action, path: f.path }, "path", vars);
		try { deps.writeFile(path, f.content); created++; } catch { /* skip */ }
	}
	return obsResult("seed", true, start, deps, { output: `Seeded ${created}/${files.length} files` });
};

// ── Event tools ──────────────────────────────────────────────────────

export const toolEmit: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const event = resolveString(action, "event", opts.variables ?? {});
	const payload = action.payload ? JSON.stringify(action.payload) : "{}";
	if (!event) return obsResult("emit", false, start, deps, { error: "No event specified" });
	return obsidianExec("emit", `eval "app.plugins.plugins['flowti-ibde']?.eventBus?.emit('${event}', ${payload})"`, deps, opts, start);
};

export const toolAssertEvent: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const event = resolveString(action, "event", opts.variables ?? {});
	if (!event) return obsResult("assert-event", false, start, deps, { error: "No event specified" });
	return obsidianExec("assert-event", `eval "app.plugins.plugins['flowti-ibde']?.eventBus?.history?.some(e => e.type === '${event}')"`, deps, opts, start, action.storeAs as string);
};

export const toolQueryTrace: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const filter = resolveString(action, "filter", opts.variables ?? {}) || "*";
	return obsidianExec("query-trace", `eval "JSON.stringify(app.plugins.plugins['flowti-ibde']?.eventBus?.history?.filter(e => '${filter}' === '*' || e.type.includes('${filter}')).slice(-20))"`, deps, opts, start, action.storeAs as string);
};

// ── UI Feedback tools ────────────────────────────────────────────────

export const toolNotice: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const message = resolveString(action, "message", opts.variables ?? {});
	if (!message) return obsResult("notice", false, start, deps, { error: "No message specified" });
	return obsidianExec("notice", `eval "new Notice('${message.replace(/'/g, "\\'")}')"`, deps, opts, start);
};

export const toolStyledNotice: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const html = resolveString(action, "html", opts.variables ?? {});
	if (!html) return obsResult("styled-notice", false, start, deps, { error: "No html specified" });
	return obsidianExec("styled-notice", `eval "(() => { const n = new Notice(''); n.noticeEl.innerHTML = '${html.replace(/'/g, "\\'")}'; return 'ok'; })()"`, deps, opts, start);
};

export const toolManual: ToolExecutor = async (action, deps, opts) => {
	const start = deps.clock.ms();
	const message = resolveString(action, "message", opts.variables ?? {}) || "Manual verification required";
	deps.log(`[manual] ${message}`);
	const waitMs = (action.waitMs as number) ?? 3000;
	await deps.sleep(waitMs);
	return obsResult("manual", true, start, deps, { output: `Manual step: ${message}` });
};

// ── Batch tools ──────────────────────────────────────────────────────

export const toolParallelGroup: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const assertions = action.assertions as string[] ?? [];
	if (assertions.length === 0) return obsResult("parallel-group", false, start, deps, { error: "No assertions specified" });
	const combined = assertions.join("; ");
	return obsidianExec("parallel-group", `eval "${combined.replace(/"/g, '\\"')}"`, deps, opts, start, action.storeAs as string);
};
