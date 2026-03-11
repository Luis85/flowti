/**
 * storybook-service.ts — Storybook lifecycle management for projects.
 *
 * Handles installation, detection, background launching, and vault-aware
 * browser opening for the opt-in Storybook component library.
 *
 * Display concerns delegated to StorybookRenderer (injected).
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { VAULT_ROOT } from "../../../infrastructure/config.js";
import { isCliAvailable, isVaultInitialized } from "../../knowledgebase/vault-service.js";
import type { ComponentsConfig, BackgroundProcess } from "../../../infrastructure/types.js";
import type { StorybookRenderer } from "./storybook-renderer.js";
import { nullStorybookRenderer } from "./storybook-renderer.js";

export type StorybookDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "input">;

const DEFAULT_STORYBOOK_DIR = "component-library";
const DEFAULT_STORYBOOK_PORT = 6006;
const READY_PATTERN = /Storybook ready/;
const LOCAL_URL_PATTERN = /https?:\/\/localhost:\d+/;
const READY_TIMEOUT_MS = 120_000;

// ── Detection ────────────────────────────────────────────────────────

export function resolveStorybookDir(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "paths">): string {
	return deps.paths.resolve(projectPath, config.storybookDir ?? DEFAULT_STORYBOOK_DIR);
}

export function isStorybookInstalled(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "disk" | "paths">): boolean {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	return deps.disk.existsSync(deps.paths.join(sbDir, "package.json"));
}

// ── Installation ─────────────────────────────────────────────────────

function writePackageJson(sbDir: string, projectName: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
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
	deps.disk.writeFileSync(deps.paths.join(sbDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
}

function writeStorybookConfig(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const configDir = deps.paths.join(sbDir, ".storybook");
	deps.disk.mkdirSync(configDir, { recursive: true });

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

	deps.disk.writeFileSync(deps.paths.join(configDir, "main.ts"), mainTs, "utf-8");
	deps.disk.writeFileSync(deps.paths.join(configDir, "preview.ts"), previewTs, "utf-8");
}

export function installStorybook(projectPath: string, projectName: string, config: ComponentsConfig, deps: StorybookDeps, render: StorybookRenderer = nullStorybookRenderer): boolean {
	const sbDir = resolveStorybookDir(projectPath, config, deps);

	if (isStorybookInstalled(projectPath, config, deps)) {
		render.alreadyInstalled(sbDir);
		return true;
	}

	render.installing(sbDir);

	// Create directory structure
	deps.disk.mkdirSync(sbDir, { recursive: true });
	deps.disk.mkdirSync(deps.paths.join(sbDir, "src"), { recursive: true });

	// Write configuration files
	writePackageJson(sbDir, projectName, deps);
	writeStorybookConfig(sbDir, deps);

	// Install dependencies
	const code = deps.shell.run("npm install", { cwd: sbDir, label: "Installing Storybook dependencies" });
	if (code !== 0) {
		render.installFailed();
		return false;
	}

	render.installSuccess(sbDir);
	return true;
}

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

function openStorybookUrl(projectPath: string, url: string, render: StorybookRenderer, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">): void {
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

// ── Live output view ────────────────────────────────────────────────

async function enterStorybookView(_projectPath: string, url: string, render: StorybookRenderer, deps: Pick<StorybookDeps, "input">): Promise<void> {
	render.view(url);
	await deps.input.waitForEnter();
	stopStorybook(render);
}

// ── Script wrappers ──────────────────────────────────────────────────

export async function runStorybookDev(projectPath: string, config: ComponentsConfig, deps: StorybookDeps, render: StorybookRenderer = nullStorybookRenderer): Promise<void> {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		return;
	}

	if (isStorybookRunning()) {
		render.alreadyRunning();
		return;
	}

	render.starting();

	// CI=true makes Storybook auto-select the next free port without prompting
	activeProcess = deps.shell.spawnBackground(
		`npx storybook dev -p ${DEFAULT_STORYBOOK_PORT} --no-open`,
		{ cwd: sbDir, env: { CI: "true" } },
	);

	const readyLine = await activeProcess.waitForOutput(READY_PATTERN, READY_TIMEOUT_MS);

	if (!readyLine) {
		if (!activeProcess.running) {
			render.failedToStart();
			const lines = activeProcess.output;
			if (lines.length > 0) {
				render.failOutput(lines.slice(-20));
			}
			activeProcess = null;
		} else {
			render.timeout();
		}
		return;
	}

	const url = extractLocalUrl(activeProcess.output);
	render.ready(url);
	openStorybookUrl(projectPath, url, render, deps);
	await enterStorybookView(projectPath, url, render, deps);
}

export function runStorybookBuild(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">, render: StorybookRenderer = nullStorybookRenderer): void {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		return;
	}
	deps.shell.run("npm run build-storybook", { cwd: sbDir, label: "Storybook build" });
}
