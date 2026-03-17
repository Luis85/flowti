/**
 * Error context collection for E2E test failures.
 *
 * When a step fails, captures DOM state, recent EventBus events,
 * and plugin state for inclusion in journey reports.
 *
 * All data is collected via cli.eval() and returned as structured
 * data. Collection errors are swallowed — must never mask the
 * original step failure.
 */
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import { PLUGIN_ID } from "./fixtures";

export interface DomSnapshot {
	/** Active view type in center pane. */
	activeViewType: string;
	/** Number of open leaves. */
	leafCount: number;
	/** Whether a modal is open. */
	hasModal: boolean;
	/** Visible notice texts. */
	notices: string[];
	/** Key CSS selectors that matched visible elements. */
	visibleElements: string[];
}

export interface RecentEvent {
	type: string;
	/** Milliseconds ago relative to collection time. */
	relativeMs: number;
	payload: string;
}

export interface PluginErrorState {
	loaded: boolean;
	serviceCount: number;
}

export interface ErrorContext {
	domSnapshot: DomSnapshot;
	recentEvents: RecentEvent[];
	pluginState: PluginErrorState;
	/** Recent JavaScript console errors from Obsidian. */
	consoleErrors: string[];
	/** Variable names available at time of failure. */
	availableVariables: string[];
}

const DEFAULT_DOM_SNAPSHOT: DomSnapshot = {
	activeViewType: "unknown",
	leafCount: 0,
	hasModal: false,
	notices: [],
	visibleElements: [],
};

const DEFAULT_PLUGIN_STATE: PluginErrorState = {
	loaded: false,
	serviceCount: 0,
};

/**
 * Collects error context from the live Obsidian instance.
 * Call immediately after a step failure, before any cleanup.
 *
 * @param lastN Number of recent events to include (default: 10)
 * @param variables Current variable map (names only — values may be sensitive)
 */
export function collectErrorContext(
	cli: ObsidianCli,
	lastN = 10,
	variables?: Record<string, string>,
): ErrorContext {
	return {
		domSnapshot: collectDomSnapshot(cli),
		recentEvents: collectRecentEvents(cli, lastN),
		pluginState: collectPluginState(cli),
		consoleErrors: collectConsoleErrors(cli),
		availableVariables: variables ? Object.keys(variables) : [],
	};
}

function collectDomSnapshot(cli: ObsidianCli): DomSnapshot {
	try {
		const result = cli.eval([
			"JSON.stringify((() => {",
			"  const active = app.workspace.activeLeaf?.view?.getViewType() ?? 'none';",
			"  let leafCount = 0;",
			"  app.workspace.iterateAllLeaves(() => leafCount++);",
			"  const hasModal = !!document.querySelector('.modal-container');",
			"  const notices = Array.from(document.querySelectorAll('.notice')).map(n => (n.textContent || '').substring(0, 100));",
			"  const checks = ['.flowti-container', '.flowti-installer-modal', '.ft-dashboard', '.ft-tab-bar', '.ft-error', '.ft-layout-split', '.ft-catalog-tab-bar'];",
			"  const visible = checks.filter(s => !!document.querySelector(s));",
			"  return { activeViewType: active, leafCount, hasModal, notices, visibleElements: visible };",
			"})())",
		].join(" "));

		if (result.success && result.value) {
			return JSON.parse(result.value) as DomSnapshot;
		}
	} catch {
		// Fall through to default
	}
	return DEFAULT_DOM_SNAPSHOT;
}

function collectRecentEvents(cli: ObsidianCli, lastN: number): RecentEvent[] {
	try {
		const result = cli.eval([
			`JSON.stringify((app.plugins.plugins['${PLUGIN_ID}']?._e2eEventTrace ?? [])`,
			`  .slice(-${lastN})`,
			"  .map(e => ({ type: e.type, relativeMs: Date.now() - e.ts, payload: e.payload.substring(0, 100) })))",
		].join(" "));

		if (result.success && result.value) {
			return JSON.parse(result.value) as RecentEvent[];
		}
	} catch {
		// Fall through to empty
	}
	return [];
}

function collectPluginState(cli: ObsidianCli): PluginErrorState {
	try {
		const result = cli.eval([
			"JSON.stringify((() => {",
			`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
			"  if (!p) return { loaded: false, serviceCount: 0 };",
			"  const svcKeys = Object.keys(p).filter(k => k.endsWith('Service') || k === 'eventBus');",
			"  return { loaded: true, serviceCount: svcKeys.length };",
			"})())",
		].join(" "));

		if (result.success && result.value) {
			return JSON.parse(result.value) as PluginErrorState;
		}
	} catch {
		// Fall through to default
	}
	return DEFAULT_PLUGIN_STATE;
}

function collectConsoleErrors(cli: ObsidianCli): string[] {
	try {
		const output = cli.getErrors();
		if (!output) return [];
		return output
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(-5);
	} catch {
		// Fall through to empty
	}
	return [];
}
