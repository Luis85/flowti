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

export function createStorybookRenderer(): StorybookRenderer {
	return {
		alreadyInstalled: renderStorybookAlreadyInstalled,
		installing: renderStorybookInstalling,
		installFailed: renderStorybookInstallFailed,
		installSuccess: renderStorybookInstallSuccess,
		notInstalled: renderStorybookNotInstalled,
		alreadyRunning: renderStorybookAlreadyRunning,
		starting: renderStorybookStarting,
		failedToStart: renderStorybookFailedToStart,
		failOutput: renderStorybookFailOutput,
		timeout: renderStorybookTimeout,
		ready: renderStorybookReady,
		stopped: renderStorybookStopped,
		notRunning: renderStorybookNotRunning,
		view: renderStorybookView,
		browserContext: renderStorybookBrowserContext,
		openedIn: renderStorybookOpenedIn,
		progress: renderStorybookProgress,
	};
}
