/**
 * storybook-service.ts — Storybook lifecycle management for projects.
 *
 * Handles installation, detection, background launching, and vault-aware
 * browser opening for the opt-in Storybook component library.
 *
 * Display concerns delegated to src/ui/storybook-renderers.ts.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { shell } from "../../../infrastructure/shell.js";
import { input } from "../../../infrastructure/input.js";
import { VAULT_ROOT } from "../../../infrastructure/config.js";
import { isCliAvailable, isVaultInitialized } from "../../knowledgebase/vault-service.js";
import type { ComponentsConfig, BackgroundProcess } from "../../../infrastructure/types.js";
import {
	renderStorybookAlreadyInstalled,
	renderStorybookInstalling,
	renderStorybookInstallFailed,
	renderStorybookInstallSuccess,
	renderStorybookNotInstalled,
	renderStorybookAlreadyRunning,
	renderStorybookStarting,
	renderStorybookFailedToStart,
	renderStorybookFailOutput,
	renderStorybookTimeout,
	renderStorybookReady,
	renderStorybookStopped,
	renderStorybookNotRunning,
	renderStorybookView,
	renderStorybookBrowserContext,
	renderStorybookOpenedIn,
} from "../../../ui/storybook-renderers.js";

const DEFAULT_STORYBOOK_DIR = "component-library";
const DEFAULT_STORYBOOK_PORT = 6006;
const READY_PATTERN = /Storybook ready/;
const LOCAL_URL_PATTERN = /https?:\/\/localhost:\d+/;
const READY_TIMEOUT_MS = 120_000;

// ── Detection ────────────────────────────────────────────────────────

export function resolveStorybookDir(projectPath: string, config: ComponentsConfig): string {
	return paths.resolve(projectPath, config.storybookDir ?? DEFAULT_STORYBOOK_DIR);
}

export function isStorybookInstalled(projectPath: string, config: ComponentsConfig): boolean {
	const sbDir = resolveStorybookDir(projectPath, config);
	return disk.existsSync(paths.join(sbDir, "package.json"));
}

// ── Installation ─────────────────────────────────────────────────────

function writePackageJson(sbDir: string, projectName: string): void {
	const pkg = {
		name: `${projectName}-component-library`,
		version: "1.0.0",
		private: true,
		type: "module",
		scripts: {
			"storybook": "storybook dev -p 6006 --no-open",
			"build-storybook": "storybook build",
		},
		devDependencies: {
			"@storybook/html": "^10.0.0",
			"@storybook/html-vite": "^10.0.0",
			"storybook": "^10.0.0",
		},
	};
	disk.writeFileSync(paths.join(sbDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
}

function writeStorybookConfig(sbDir: string): void {
	const configDir = paths.join(sbDir, ".storybook");
	disk.mkdirSync(configDir, { recursive: true });

	const mainTs = `import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
	stories: ["../../src/components/**/*.stories.@(ts|tsx)"],
	framework: "@storybook/html-vite",
	core: {
		disableTelemetry: true,
	},
};

export default config;
`;

	const previewTs = `import type { Preview } from "@storybook/html";

const preview: Preview = {
	tags: ["autodocs"],
	parameters: {
		controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
	},
};

export default preview;
`;

	disk.writeFileSync(paths.join(configDir, "main.ts"), mainTs, "utf-8");
	disk.writeFileSync(paths.join(configDir, "preview.ts"), previewTs, "utf-8");
}

export function installStorybook(projectPath: string, projectName: string, config: ComponentsConfig): boolean {
	const sbDir = resolveStorybookDir(projectPath, config);

	if (isStorybookInstalled(projectPath, config)) {
		renderStorybookAlreadyInstalled(sbDir);
		return true;
	}

	renderStorybookInstalling(sbDir);

	// Create directory structure
	disk.mkdirSync(sbDir, { recursive: true });
	disk.mkdirSync(paths.join(sbDir, "src"), { recursive: true });

	// Write configuration files
	writePackageJson(sbDir, projectName);
	writeStorybookConfig(sbDir);

	// Install dependencies
	const code = shell.run("npm install", { cwd: sbDir, label: "Installing Storybook dependencies" });
	if (code !== 0) {
		renderStorybookInstallFailed();
		return false;
	}

	renderStorybookInstallSuccess(sbDir);
	return true;
}

// ── Vault detection ──────────────────────────────────────────────────

/** Check whether a project path lives inside the Obsidian vault. */
export function isInsideVault(projectPath: string): boolean {
	try {
		let resolved = paths.resolve(projectPath);
		let vault = paths.resolve(VAULT_ROOT);
		// Windows paths are case-insensitive
		if (process.platform === "win32") {
			resolved = resolved.toLowerCase();
			vault = vault.toLowerCase();
		}
		return resolved.startsWith(vault + paths.sep) || resolved === vault;
	} catch {
		return false;
	}
}

// ── Browser opening ──────────────────────────────────────────────────

function openInObsidianWebViewer(url: string): boolean {
	if (!isCliAvailable() || !isVaultInitialized()) return false;
	shell.runSilent(`obsidian web url=${url} newtab`);
	return true;
}

function openInDefaultBrowser(url: string): void {
	const cmd = process.platform === "win32" ? `start "" "${url}"`
		: process.platform === "darwin" ? `open "${url}"`
		: `xdg-open "${url}"`;
	shell.runSilent(cmd);
}

function openStorybookUrl(projectPath: string, url: string): void {
	const inVault = isInsideVault(projectPath);
	if (!inVault) {
		renderStorybookBrowserContext("Not inside vault — using default browser");
	} else if (!isCliAvailable()) {
		renderStorybookBrowserContext("Obsidian CLI not available — using default browser");
	} else if (!isVaultInitialized()) {
		renderStorybookBrowserContext("Vault not initialized — using default browser");
	}

	if (inVault && openInObsidianWebViewer(url)) {
		renderStorybookOpenedIn("Obsidian Web Viewer");
	} else {
		openInDefaultBrowser(url);
		renderStorybookOpenedIn("default browser");
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

export function stopStorybook(): void {
	if (activeProcess?.running) {
		activeProcess.kill();
		activeProcess = null;
		renderStorybookStopped();
	} else {
		renderStorybookNotRunning();
	}
}

// ── Live output view ────────────────────────────────────────────────

async function enterStorybookView(_projectPath: string, url: string): Promise<void> {
	renderStorybookView(url);
	await input.waitForEnter();
	stopStorybook();
}

// ── Script wrappers ──────────────────────────────────────────────────

export async function runStorybookDev(projectPath: string, config: ComponentsConfig): Promise<void> {
	const sbDir = resolveStorybookDir(projectPath, config);
	if (!isStorybookInstalled(projectPath, config)) {
		renderStorybookNotInstalled();
		return;
	}

	if (isStorybookRunning()) {
		renderStorybookAlreadyRunning();
		return;
	}

	renderStorybookStarting();

	// CI=true makes Storybook auto-select the next free port without prompting
	activeProcess = shell.spawnBackground(
		`npx storybook dev -p ${DEFAULT_STORYBOOK_PORT} --no-open`,
		{ cwd: sbDir, env: { CI: "true" } },
	);

	const readyLine = await activeProcess.waitForOutput(READY_PATTERN, READY_TIMEOUT_MS);

	if (!readyLine) {
		if (!activeProcess.running) {
			renderStorybookFailedToStart();
			const lines = activeProcess.output;
			if (lines.length > 0) {
				renderStorybookFailOutput(lines.slice(-20));
			}
			activeProcess = null;
		} else {
			renderStorybookTimeout();
		}
		return;
	}

	const url = extractLocalUrl(activeProcess.output);
	renderStorybookReady(url);
	openStorybookUrl(projectPath, url);
	await enterStorybookView(projectPath, url);
}

export function runStorybookBuild(projectPath: string, config: ComponentsConfig): void {
	const sbDir = resolveStorybookDir(projectPath, config);
	if (!isStorybookInstalled(projectPath, config)) {
		renderStorybookNotInstalled();
		return;
	}
	shell.run("npm run build-storybook", { cwd: sbDir, label: "Storybook build" });
}
