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
 * 1. Sets the leaf as active without stealing OS window focus
 * 2. Waits for the activation to complete (500ms)
 * 3. Emits `hub.navigate` via the EventBus (the official cross-hub nav API)
 * 4. Waits for async event chain to settle (500ms)
 * 5. Verifies via the event trace that `hub.tab.changed` was emitted
 *
 * Uses `setActiveLeaf(leaf, { focus: false })` to avoid bringing the
 * Obsidian window to the foreground during headless E2E test execution.
 */
export async function navigateToTab(
	cli: ObsidianCli,
	hubId: string,
	viewType: string,
	tabId: string,
): Promise<void> {
	// Activate the leaf without stealing OS window focus — { focus: false }
	// sets it as the active leaf internally without triggering Electron focus.
	cli.eval([
		`(() => {`,
		`  const leaf = app.workspace.getLeavesOfType('${viewType}')[0];`,
		`  if (leaf) { app.workspace.setActiveLeaf(leaf, { focus: false }); }`,
		`})()`,
	].join(" "));

	// Wait for setActiveLeaf to complete
	await new Promise((resolve) => setTimeout(resolve, 250));

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
	await new Promise((resolve) => setTimeout(resolve, 250));

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

/**
 * File extensions Obsidian can natively open without plugins.
 * Before Flowti loads, only these types can be opened in the editor.
 * Other files are revealed in the explorer but not opened.
 */
const NATIVE_EXTENSIONS = new Set(["md", "canvas", "json"]);

/**
 * Returns true if the vault path has an extension Obsidian can open natively.
 */
function isNativelyOpenable(vaultPath: string): boolean {
	const ext = vaultPath.split(".").pop()?.toLowerCase() ?? "";
	return NATIVE_EXTENSIONS.has(ext);
}

/**
 * Opens a vault file in an editor tab.
 *
 * Only opens files with natively supported extensions (md, canvas, json).
 * Other file types (ts, csv, etc.) cannot be opened before the plugin loads
 * and are silently skipped. No-op if the path doesn't exist in the vault.
 */
export function openFile(cli: ObsidianCli, vaultPath: string): void {
	if (!isNativelyOpenable(vaultPath)) return;
	const escaped = vaultPath.replace(/'/g, "\\'");
	cli.eval([
		`(async () => {`,
		`  const f = app.vault.getAbstractFileByPath('${escaped}');`,
		`  if (f && f.extension !== undefined) {`,
		`    const leaf = app.workspace.getLeaf('tab');`,
		`    await leaf.openFile(f);`,
		`  }`,
		`})()`,
	].join(" "));
}

/**
 * Reveals a file or folder in the file explorer sidebar, and opens it
 * in an editor tab if the extension is natively supported.
 *
 * Scrolls the file explorer tree to the given vault path and highlights it.
 * Files with native extensions (md, canvas, json) are also opened in a tab.
 * Other file types (ts, csv, etc.) are only revealed — Obsidian cannot open
 * them before plugin registration. No-op if the path doesn't exist.
 */
export function revealInExplorer(cli: ObsidianCli, vaultPath: string): void {
	const escaped = vaultPath.replace(/'/g, "\\'");
	const shouldOpen = isNativelyOpenable(vaultPath);
	cli.eval([
		`(async () => {`,
		`  const f = app.vault.getAbstractFileByPath('${escaped}');`,
		`  if (!f) return;`,
		`  const explorers = app.workspace.getLeavesOfType('file-explorer');`,
		`  if (explorers.length > 0) {`,
		`    explorers[0].view.revealInFolder(f);`,
		`  }`,
		...(shouldOpen ? [
			`  if (f.extension !== undefined) {`,
			`    const leaf = app.workspace.getLeaf('tab');`,
			`    await leaf.openFile(f);`,
			`  }`,
		] : []),
		`})()`,
	].join(" "));
}
