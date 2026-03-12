/**
 * storybook-service.ts — Storybook lifecycle orchestration for projects.
 *
 * Thin orchestrator that wires together installation (storybook-installer)
 * and browser/process management (storybook-browser) into high-level
 * dev/build commands.  Re-exports all public API for backward compatibility.
 */

import type { ComponentsConfig } from "../../../infrastructure/types.js";
import type { StorybookRenderer } from "./storybook-renderer.js";
import { nullStorybookRenderer } from "./storybook-renderer.js";

// ── Re-exports (backward compatibility) ─────────────────────────────

export type { StorybookDeps, FrameworkPackages } from "./storybook-installer.js";
export {
	resolveStorybookDir,
	isStorybookInstalled,
	getFrameworkPackages,
	installStorybook,
} from "./storybook-installer.js";

export {
	isInsideVault,
	extractLocalUrl,
	isStorybookRunning,
	stopStorybook,
} from "./storybook-browser.js";

// ── Internal imports for orchestration ──────────────────────────────

import type { StorybookDeps } from "./storybook-installer.js";
import { resolveStorybookDir, isStorybookInstalled } from "./storybook-installer.js";
import {
	extractLocalUrl,
	openStorybookUrl,
	isStorybookRunning,
	stopStorybook,
	setActiveProcess,
} from "./storybook-browser.js";

const READY_PATTERN = /Storybook ready/;
const READY_TIMEOUT_MS = 120_000;

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
		await deps.input.waitForEnter();
		return;
	}

	if (isStorybookRunning()) {
		render.alreadyRunning();
		await deps.input.waitForEnter();
		return;
	}

	render.starting();

	// Use npm run storybook which resolves to the correct command per framework
	// CI=true suppresses Storybook interactive prompts; NG_CLI_ANALYTICS=false suppresses Angular analytics prompt
	const activeProcess = deps.shell.spawnBackground(
		"npm run storybook",
		{ cwd: sbDir, env: { CI: "true", NG_CLI_ANALYTICS: "false" } },
	);
	setActiveProcess(activeProcess);

	// Stream live progress to the renderer while waiting for ready
	const unsubscribe = activeProcess.onOutput((line) => render.progress(line));

	const readyLine = await activeProcess.waitForOutput(READY_PATTERN, READY_TIMEOUT_MS);
	unsubscribe();

	if (!readyLine) {
		if (!activeProcess.running) {
			render.failedToStart();
			const lines = activeProcess.output;
			if (lines.length > 0) {
				render.failOutput(lines.slice(-20));
			}
			setActiveProcess(null);
		} else {
			render.timeout();
		}
		await deps.input.waitForEnter();
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
