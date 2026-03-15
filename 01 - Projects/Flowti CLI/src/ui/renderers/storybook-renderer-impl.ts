/**
 * storybook-renderer-impl.ts — Default ANSI renderer for Storybook service output.
 *
 * Delegates to the existing storybook-renderers functions.
 * This lives in the UI layer — it's the only place that imports renderers.
 */

import type { StorybookRenderer } from "../../domain/make/component/storybook-renderer.js";
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
	renderStorybookProgress,
} from "./storybook-renderers.js";
import type { Log } from "../../infrastructure/deps.js";

export function createStorybookRenderer(log: Log): StorybookRenderer {
	return {
		alreadyInstalled: (sbDir) => renderStorybookAlreadyInstalled(sbDir, log),
		installing: (sbDir) => renderStorybookInstalling(sbDir, log),
		installFailed: () => renderStorybookInstallFailed(log),
		installSuccess: (sbDir) => renderStorybookInstallSuccess(sbDir, log),
		notInstalled: () => renderStorybookNotInstalled(log),
		alreadyRunning: () => renderStorybookAlreadyRunning(log),
		starting: () => renderStorybookStarting(log),
		failedToStart: () => renderStorybookFailedToStart(log),
		failOutput: (lines) => renderStorybookFailOutput(lines, log),
		timeout: () => renderStorybookTimeout(log),
		ready: (url) => renderStorybookReady(url, log),
		stopped: () => renderStorybookStopped(log),
		notRunning: () => renderStorybookNotRunning(log),
		view: (url) => renderStorybookView(url, log),
		browserContext: (message) => renderStorybookBrowserContext(message, log),
		openedIn: (target) => renderStorybookOpenedIn(target, log),
		progress: (line) => renderStorybookProgress(line, log),
	};
}
