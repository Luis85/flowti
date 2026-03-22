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
import { getProcess, registerProcess } from "../../processes/process-registry.js";
import type { ProcessDeps } from "../../../infrastructure/deps.js";

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
	openStorybookUrl,
} from "./storybook-browser.js";

// ── Non-interactive result type ──────────────────────────────────────

export interface StorybookStartResult {
	started: boolean;
	url: string;
	pid?: number;
	error?: string;
}

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

export async function runStorybookDev(projectPath: string, config: ComponentsConfig, vaultRoot: string, deps: StorybookDeps, render: StorybookRenderer = nullStorybookRenderer): Promise<void> {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		await deps.input.waitForEnter();
		return;
	}

	if (!deps.disk.existsSync(deps.paths.join(sbDir, "node_modules"))) {
		render.failedToStart();
		render.failOutput([
			'Dependencies not installed. Run "npm install" in the components directory,',
			'or use "Install Storybook" to set up Storybook from scratch.',
		]);
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
	openStorybookUrl(projectPath, url, vaultRoot, render, deps);
	await enterStorybookView(projectPath, url, render, deps);
}

export async function startStorybookDev(
	projectPath: string,
	config: ComponentsConfig,
	vaultRoot: string,
	deps: Omit<StorybookDeps, "input">,
	render: StorybookRenderer = nullStorybookRenderer,
	processDeps?: ProcessDeps,
): Promise<StorybookStartResult> {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		return { started: false, url: "", error: "not-installed" };
	}

	if (!deps.disk.existsSync(deps.paths.join(sbDir, "node_modules"))) {
		render.failedToStart();
		render.failOutput([
			'Dependencies not installed. Run "npm install" in the components directory,',
			'or use "flowti storybook:install" to set up Storybook from scratch.',
		]);
		return { started: false, url: "", error: "deps-not-installed" };
	}

	if (processDeps) {
		const projectName = deps.paths.basename(projectPath);
		const existing = getProcess(processDeps, "storybook", projectName);
		if (existing) {
			render.alreadyRunning();
			return { started: false, url: existing.url ?? "", error: "already-running" };
		}
		if (await processDeps.pidOps.isPortListening(6006)) {
			render.alreadyRunning();
			return { started: false, url: "http://localhost:6006", error: "port-in-use" };
		}
	} else if (isStorybookRunning()) {
		render.alreadyRunning();
		return { started: false, url: "", error: "already-running" };
	}

	render.starting();

	const activeProcess = deps.shell.spawnBackground(
		"npm run storybook",
		{ cwd: sbDir, env: { CI: "true", NG_CLI_ANALYTICS: "false" }, detached: Boolean(processDeps) },
	);
	setActiveProcess(activeProcess);

	const unsubscribe = activeProcess.onOutput((line) => render.progress(line));
	const readyLine = await activeProcess.waitForOutput(READY_PATTERN, READY_TIMEOUT_MS);
	unsubscribe();

	if (!readyLine) {
		if (!activeProcess.running) {
			render.failedToStart();
			const lines = activeProcess.output;
			if (lines.length > 0) render.failOutput(lines.slice(-20));
			setActiveProcess(null);
			return { started: false, url: "", error: "failed-to-start" };
		}
		render.timeout();
		return { started: false, url: "", error: "timeout" };
	}

	const url = extractLocalUrl(activeProcess.output);
	render.ready(url);
	openStorybookUrl(projectPath, url, vaultRoot, render, deps);

	if (processDeps) {
		const projectName = deps.paths.basename(projectPath);
		registerProcess(processDeps, {
			type: "storybook",
			name: projectName,
			pid: activeProcess.pid,
			port: 6006,
			url,
			startedAt: processDeps.clock.iso(),
		});
		activeProcess.unref();
	}

	return { started: true, url, pid: activeProcess.pid };
}

export function runStorybookBuild(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">, render: StorybookRenderer = nullStorybookRenderer): void {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		return;
	}
	if (!deps.disk.existsSync(deps.paths.join(sbDir, "node_modules"))) {
		render.failedToStart();
		render.failOutput([
			'Dependencies not installed. Run "npm install" in the components directory,',
			'or use "flowti storybook:install" to set up Storybook from scratch.',
		]);
		return;
	}
	deps.shell.run("npm run build-storybook", { cwd: sbDir, label: "Storybook build" });
}
