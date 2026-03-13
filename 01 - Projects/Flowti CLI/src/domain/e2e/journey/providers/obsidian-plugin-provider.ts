/**
 * obsidian-plugin-provider.ts — Environment provider for Obsidian plugin projects.
 *
 * Extends the vault provider with plugin lifecycle tools: build, deploy,
 * Obsidian CLI interaction, and plugin state management.
 *
 * Provides 30+ tools via obsidian-cli subprocess wrappers:
 * - DOM Interaction: click, eval, set-input, select, scroll-to, navigate, close-leaves, close-modals, ribbon
 * - Visual: highlight, screenshot, spinner, theme, visual-inspection
 * - Vault Operations: create-file, delete-file, open-file, copy-file, move-file, seed
 * - Plugin State: emit, assert-event, query-trace, plugin-state, plugin-deploy
 * - UI Feedback: notice, styled-notice, manual
 * - Batch: parallel-group
 */

import type { EnvironmentProvider } from "../journey-environment.js";
import type { JourneyExecutorOptions } from "../journey-types.js";
import type { ToolDeps } from "../journey-executor.js";
import type { ToolExecutor } from "../journey-tools.js";
import { resolveString } from "../journey-tools.js";
import {
	obsResult, obsidianExec,
	toolCreateFile, toolDeleteFile, toolOpenFile, toolCopyFile, toolMoveFile, toolSeed,
	toolEmit, toolAssertEvent, toolQueryTrace,
	toolNotice, toolStyledNotice, toolManual,
	toolParallelGroup,
} from "./obsidian-plugin-tools.js";

// ── Core tools ───────────────────────────────────────────────────────

const toolObsidianCli: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const command = resolveString(action, "command", opts.variables ?? {});
	if (!command) return obsResult("obsidian-cli", false, start, deps, { error: "No command specified" });
	return obsidianExec("obsidian-cli", command, deps, opts, start, action.storeAs as string);
};

function runBuild(cmd: string, deps: ToolDeps, opts: JourneyExecutorOptions): { success: boolean; error?: string } {
	try {
		const r = deps.exec(cmd, { cwd: opts.cwd, timeout: 120000, env: opts.env });
		if (r.exitCode !== 0) return { success: false, error: `Build failed (exit ${r.exitCode}): ${r.stderr}` };
		return { success: true };
	} catch (e) {
		return { success: false, error: `Build error: ${e}` };
	}
}

function deployArtifacts(artifacts: string[], projectRoot: string, pluginDir: string, deps: ToolDeps): number {
	deps.mkdir(pluginDir);
	let copied = 0;
	for (const artifact of artifacts) {
		const src = `${projectRoot}/${artifact}`;
		if (deps.exists(src)) {
			try { deps.writeFile(`${pluginDir}/${artifact}`, deps.readFile(src)); copied++; } catch { /* skip */ }
		}
	}
	return copied;
}

const toolPluginDeploy: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const variables = opts.variables ?? {};
	const buildCmd = resolveString(action, "buildCommand", variables) || "npm run build";
	const pluginDir = resolveString(action, "pluginDir", variables);
	const artifacts = action.artifacts as string[] ?? ["main.js", "manifest.json", "styles.css"];
	if (!pluginDir) return obsResult("plugin-deploy", false, start, deps, { error: "No pluginDir specified" });
	const buildResult = runBuild(buildCmd, deps, opts);
	if (!buildResult.success) return obsResult("plugin-deploy", false, start, deps, { error: buildResult.error! });
	const copied = deployArtifacts(artifacts, opts.cwd ?? ".", pluginDir, deps);
	return obsResult("plugin-deploy", true, start, deps, {
		output: `Built and deployed ${copied}/${artifacts.length} artifacts to ${pluginDir}`,
	});
};

const toolPluginState: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const op = action.op as string;
	const variables = opts.variables ?? {};
	const dataPath = resolveString(action, "dataJsonPath", variables);
	if (!dataPath) return obsResult("plugin-state", false, start, deps, { error: "No dataJsonPath specified" });
	try {
		switch (op) {
			case "read": {
				const content = deps.readFile(dataPath);
				const storeAs = action.storeAs as string;
				if (storeAs && opts.variables) opts.variables[storeAs] = content;
				return obsResult("plugin-state", true, start, deps, { output: content.slice(0, 300) });
			}
			case "set": {
				const field = resolveString(action, "field", variables);
				const value = resolveString(action, "value", variables);
				let data: Record<string, unknown> = {};
				try { data = JSON.parse(deps.readFile(dataPath)); } catch { /* empty */ }
				data[field] = value;
				deps.writeFile(dataPath, JSON.stringify(data, null, "\t"));
				return obsResult("plugin-state", true, start, deps, { output: `${field}=${value}` });
			}
			default:
				return obsResult("plugin-state", false, start, deps, { error: `Unknown plugin-state op: ${op}` });
		}
	} catch (e) {
		return obsResult("plugin-state", false, start, deps, { error: String(e) });
	}
};

// ── DOM Interaction tools ────────────────────────────────────────────

const toolClick: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const selector = resolveString(action, "selector", opts.variables ?? {});
	if (!selector) return obsResult("click", false, start, deps, { error: "No selector specified" });
	return obsidianExec("click", `eval "document.querySelector('${selector}')?.click()"`, deps, opts, start);
};

const toolEval: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const expression = resolveString(action, "expression", opts.variables ?? {});
	if (!expression) return obsResult("eval", false, start, deps, { error: "No expression specified" });
	return obsidianExec("eval", `eval "${expression.replace(/"/g, '\\"')}"`, deps, opts, start, action.storeAs as string);
};

const toolSetInput: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const selector = resolveString(action, "selector", vars);
	const value = resolveString(action, "value", vars);
	if (!selector) return obsResult("set-input", false, start, deps, { error: "No selector specified" });
	const expr = `(() => { const el = document.querySelector('${selector}'); if (el) { el.value = '${value}'; el.dispatchEvent(new Event('input')); return 'ok'; } return 'not found'; })()`;
	return obsidianExec("set-input", `eval "${expr.replace(/"/g, '\\"')}"`, deps, opts, start);
};

const toolSelect: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const selector = resolveString(action, "selector", vars);
	const value = resolveString(action, "value", vars);
	if (!selector) return obsResult("select", false, start, deps, { error: "No selector specified" });
	const expr = `(() => { const el = document.querySelector('${selector}'); if (el) { el.value = '${value}'; el.dispatchEvent(new Event('change')); return 'ok'; } return 'not found'; })()`;
	return obsidianExec("select", `eval "${expr.replace(/"/g, '\\"')}"`, deps, opts, start);
};

const toolScrollTo: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const selector = resolveString(action, "selector", opts.variables ?? {});
	if (!selector) return obsResult("scroll-to", false, start, deps, { error: "No selector specified" });
	return obsidianExec("scroll-to", `eval "document.querySelector('${selector}')?.scrollIntoView({ behavior: 'smooth' })"`, deps, opts, start);
};

const toolNavigate: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	if (!path) return obsResult("navigate", false, start, deps, { error: "No path specified" });
	return obsidianExec("navigate", `open path="${path}"`, deps, opts, start);
};

const toolCloseLeaves: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	return obsidianExec("close-leaves", 'eval "app.workspace.iterateAllLeaves(l => l.detach())"', deps, opts, start);
};

const toolCloseModals: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	return obsidianExec("close-modals", 'eval "document.querySelectorAll(\'.modal-close-button\').forEach(b => b.click())"', deps, opts, start);
};

const toolRibbon: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const id = resolveString(action, "id", opts.variables ?? {});
	if (!id) return obsResult("ribbon", false, start, deps, { error: "No ribbon action id specified" });
	return obsidianExec("ribbon", `eval "app.workspace.leftRibbon.items.find(i => i.id === '${id}')?.callback()"`, deps, opts, start);
};

// ── Visual tools ─────────────────────────────────────────────────────

const toolHighlight: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const selector = resolveString(action, "selector", opts.variables ?? {});
	const color = resolveString(action, "color", opts.variables ?? {}) || "red";
	if (!selector) return obsResult("highlight", false, start, deps, { error: "No selector specified" });
	return obsidianExec("highlight", `eval "document.querySelector('${selector}').style.outline = '3px solid ${color}'"`, deps, opts, start);
};

const toolScreenshot: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vars = opts.variables ?? {};
	const output = resolveString(action, "output", vars) || "screenshot.png";
	const selector = resolveString(action, "selector", vars);
	const cmd = selector ? `screenshot --output "${output}" --selector "${selector}"` : `screenshot --output "${output}"`;
	return obsidianExec("screenshot", cmd, deps, opts, start);
};

const toolSpinner: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const show = action.show !== false;
	const expr = show ? 'eval "document.body.classList.add(\'is-loading\')"' : 'eval "document.body.classList.remove(\'is-loading\')"';
	return obsidianExec("spinner", expr, deps, opts, start);
};

const toolTheme: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const theme = resolveString(action, "theme", opts.variables ?? {}) || "dark";
	return obsidianExec("theme", `eval "app.setTheme('${theme}')"`, deps, opts, start);
};

const toolVisualInspection: ToolExecutor = async (action, deps, opts) => {
	const start = deps.clock.ms();
	const message = resolveString(action, "message", opts.variables ?? {}) || "Visual inspection required";
	deps.log(`[visual-inspection] ${message}`);
	const waitMs = (action.waitMs as number) ?? 2000;
	await deps.sleep(waitMs);
	return obsResult("visual-inspection", true, start, deps, { output: message });
};

// ── Provider factory ─────────────────────────────────────────────────

export function createObsidianPluginProvider(): EnvironmentProvider {
	return {
		target: "obsidian-plugin",
		label: "Obsidian Plugin",
		capabilities: [
			"command", "filesystem", "frontmatter",
			"vault-note", "vault-structure",
			"obsidian-cli", "plugin-deploy", "plugin-state",
			"dom-interaction", "visual", "events", "batch",
		],
		tools: {
			"obsidian-cli": toolObsidianCli, "plugin-deploy": toolPluginDeploy, "plugin-state": toolPluginState,
			"click": toolClick, "eval": toolEval, "set-input": toolSetInput, "select": toolSelect,
			"scroll-to": toolScrollTo, "navigate": toolNavigate, "close-leaves": toolCloseLeaves,
			"close-modals": toolCloseModals, "ribbon": toolRibbon,
			"highlight": toolHighlight, "screenshot": toolScreenshot, "spinner": toolSpinner,
			"theme": toolTheme, "visual-inspection": toolVisualInspection,
			"create-file": toolCreateFile, "delete-file": toolDeleteFile, "open-file": toolOpenFile,
			"copy-file": toolCopyFile, "move-file": toolMoveFile, "seed": toolSeed,
			"emit": toolEmit, "assert-event": toolAssertEvent, "query-trace": toolQueryTrace,
			"notice": toolNotice, "styled-notice": toolStyledNotice, "manual": toolManual,
			"parallel-group": toolParallelGroup,
		},
		setup(deps, opts) {
			const vaultRoot = opts.cwd ?? ".";
			const obsidianDir = `${vaultRoot}/.obsidian`;
			if (!deps.exists(obsidianDir)) {
				deps.mkdir(obsidianDir);
				deps.log(`[plugin] Created .obsidian directory at ${obsidianDir}`);
			}
		},
	};
}
