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
		alreadyInstalled: (sbDir) => renderStorybookAlreadyInstalled(log, sbDir),
		installing: (sbDir) => renderStorybookInstalling(log, sbDir),
		installFailed: () => renderStorybookInstallFailed(log),
		installSuccess: (sbDir) => renderStorybookInstallSuccess(log, sbDir),
		notInstalled: () => renderStorybookNotInstalled(log),
		alreadyRunning: () => renderStorybookAlreadyRunning(log),
		starting: () => renderStorybookStarting(log),
		failedToStart: () => renderStorybookFailedToStart(log),
		failOutput: (lines) => renderStorybookFailOutput(log, lines),
		timeout: () => renderStorybookTimeout(log),
		ready: (url) => renderStorybookReady(log, url),
		stopped: () => renderStorybookStopped(log),
		notRunning: () => renderStorybookNotRunning(log),
		view: (url) => renderStorybookView(log, url),
		browserContext: (message) => renderStorybookBrowserContext(log, message),
		openedIn: (target) => renderStorybookOpenedIn(log, target),
		progress: (line) => renderStorybookProgress(log, line),
	};
}
