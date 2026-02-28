/**
 * Hub navigation helpers for E2E tests.
 *
 * Shared by journey test files to open hubs, navigate tabs,
 * and verify leaf state via the Obsidian workspace API.
 */
import { expect } from "vitest";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import { PLUGIN_ID, getTraceLength, assertEventEmitted } from "./fixtures";

/**
 * Focuses a hub leaf and navigates to a specific tab.
 *
 * 1. Reveals the leaf (makes it the active tab in the center pane)
 * 2. Waits for the async reveal to complete (500ms)
 * 3. Emits `hub.navigate` via the EventBus (the official cross-hub nav API)
 * 4. Waits for async event chain to settle (500ms)
 * 5. Verifies via the event trace that `hub.tab.changed` was emitted
 *
 * Must be called from an async context — both revealLeaf and EventBus.emit
 * are async in Obsidian, and hub.tab.changed is fire-and-forget inside
 * the hub.navigate handler.
 */
export async function navigateToTab(
	cli: ObsidianCli,
	hubId: string,
	viewType: string,
	tabId: string,
): Promise<void> {
	// Reveal the leaf first — this is async in Obsidian
	cli.eval([
		`(() => {`,
		`  const leaf = app.workspace.getLeavesOfType('${viewType}')[0];`,
		`  if (leaf) { app.workspace.revealLeaf(leaf); app.workspace.setActiveLeaf(leaf, { focus: true }); }`,
		`})()`,
	].join(" "));

	// Wait for revealLeaf + setActiveLeaf to complete
	await new Promise((resolve) => setTimeout(resolve, 500));

	const before = getTraceLength(cli);

	// Emit hub.navigate — this triggers navigateTo() which fire-and-forgets hub.tab.changed
	cli.eval([
		`(() => {`,
		`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		`  if (p && p.eventBus) p.eventBus.emit('hub.navigate', { hubId: '${hubId}', tabId: '${tabId}' });`,
		`})()`,
	].join(" "));

	// Wait for the async event chain: hub.navigate → navigateTo → hub.tab.changed
	// Both EventBus.emit and the fire-and-forget hub.tab.changed need time to process
	await new Promise((resolve) => setTimeout(resolve, 500));

	assertEventEmitted(cli, before, "hub.tab.changed", { hubId, tabId });
}

/**
 * Asserts that at least one leaf of the given view type is open.
 */
export function assertLeafOpen(cli: ObsidianCli, viewType: string): void {
	const result = cli.eval(
		`app.workspace.getLeavesOfType('${viewType}').length`,
	);
	expect(result.success).toBe(true);
	expect(Number(result.value)).toBeGreaterThan(0);
}

/**
 * Closes all leaves of a given view type.
 */
export function closeHub(cli: ObsidianCli, viewType: string): void {
	cli.eval(
		`app.workspace.getLeavesOfType('${viewType}').forEach(l => l.detach())`,
	);
}
