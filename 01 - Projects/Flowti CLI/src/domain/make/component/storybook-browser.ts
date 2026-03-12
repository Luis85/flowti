/**
 * storybook-browser.ts — Vault-aware browser opening and process management.
 *
 * Handles detecting the Obsidian vault context, opening Storybook in the
 * appropriate browser, URL extraction, and background process lifecycle.
 */

import { VAULT_ROOT } from "../../../infrastructure/config.js";
import { isCliAvailable, isVaultInitialized } from "../../knowledgebase/vault-service.js";
import type { BackgroundProcess } from "../../../infrastructure/types.js";
import type { StorybookRenderer } from "./storybook-renderer.js";
import { nullStorybookRenderer } from "./storybook-renderer.js";
import type { StorybookDeps } from "./storybook-installer.js";

const DEFAULT_STORYBOOK_PORT = 6006;
const LOCAL_URL_PATTERN = /https?:\/\/localhost:\d+/;

// ── Vault detection ──────────────────────────────────────────────────

/** Check whether a project path lives inside the Obsidian vault. */
export function isInsideVault(projectPath: string, deps: Pick<StorybookDeps, "paths">): boolean {
	try {
		let resolved = deps.paths.resolve(projectPath);
		let vault = deps.paths.resolve(VAULT_ROOT);
		// Windows paths are case-insensitive
		if (process.platform === "win32") {
			resolved = resolved.toLowerCase();
			vault = vault.toLowerCase();
		}
		return resolved.startsWith(vault + deps.paths.sep) || resolved === vault;
	} catch {
		return false;
	}
}

// ── Browser opening ──────────────────────────────────────────────────

function openInObsidianWebViewer(url: string, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">): boolean {
	if (!isCliAvailable({ shell: deps.shell }) || !isVaultInitialized({ disk: deps.disk, paths: deps.paths })) return false;
	deps.shell.runSilent(`obsidian web url=${url} newtab`);
	return true;
}

function openInDefaultBrowser(url: string, deps: Pick<StorybookDeps, "shell">): void {
	const cmd = process.platform === "win32" ? `start "" "${url}"`
		: process.platform === "darwin" ? `open "${url}"`
		: `xdg-open "${url}"`;
	deps.shell.runSilent(cmd);
}

export function openStorybookUrl(projectPath: string, url: string, render: StorybookRenderer, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">): void {
	const inVault = isInsideVault(projectPath, deps);
	if (!inVault) {
		render.browserContext("Not inside vault — using default browser");
	} else if (!isCliAvailable({ shell: deps.shell })) {
		render.browserContext("Obsidian CLI not available — using default browser");
	} else if (!isVaultInitialized({ disk: deps.disk, paths: deps.paths })) {
		render.browserContext("Vault not initialized — using default browser");
	}

	if (inVault && openInObsidianWebViewer(url, deps)) {
		render.openedIn("Obsidian Web Viewer");
	} else {
		openInDefaultBrowser(url, deps);
		render.openedIn("default browser");
	}
}

// ── URL extraction ──────────────────────────────────────────────────

/** Extract the localhost URL from Storybook's output (it reports the actual port). */
export function extractLocalUrl(outputLines: string[]): string {
	for (const line of outputLines) {
		const match = LOCAL_URL_PATTERN.exec(line);
		if (match) return match[0];
	}
	return `http://localhost:${DEFAULT_STORYBOOK_PORT}`;
}

// ── Background process management ───────────────────────────────────

let activeProcess: BackgroundProcess | null = null;

export function isStorybookRunning(): boolean {
	return activeProcess?.running === true;
}

export function stopStorybook(render: StorybookRenderer = nullStorybookRenderer): void {
	if (activeProcess?.running) {
		activeProcess.kill();
		activeProcess = null;
		render.stopped();
	} else {
		render.notRunning();
	}
}

export function getActiveProcess(): BackgroundProcess | null {
	return activeProcess;
}

export function setActiveProcess(process: BackgroundProcess | null): void {
	activeProcess = process;
}
