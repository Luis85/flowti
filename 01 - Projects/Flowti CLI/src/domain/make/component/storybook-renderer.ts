/**
 * storybook-renderer.ts — Renderer interface for Storybook service output.
 *
 * Domain code calls these methods instead of importing UI directly.
 * The UI layer provides the default ANSI implementation; tests can
 * inject a no-op or capturing renderer.
 */

export interface StorybookRenderer {
	alreadyInstalled(sbDir: string): void;
	installing(sbDir: string): void;
	installFailed(): void;
	installSuccess(sbDir: string): void;
	notInstalled(): void;
	alreadyRunning(): void;
	starting(): void;
	failedToStart(): void;
	failOutput(lines: string[]): void;
	timeout(): void;
	ready(url: string): void;
	stopped(): void;
	notRunning(): void;
	view(url: string): void;
	browserContext(message: string): void;
	openedIn(target: string): void;
}

/** No-op renderer — used as default when no renderer is injected. */
export const nullStorybookRenderer: StorybookRenderer = {
	alreadyInstalled() {},
	installing() {},
	installFailed() {},
	installSuccess() {},
	notInstalled() {},
	alreadyRunning() {},
	starting() {},
	failedToStart() {},
	failOutput() {},
	timeout() {},
	ready() {},
	stopped() {},
	notRunning() {},
	view() {},
	browserContext() {},
	openedIn() {},
};
