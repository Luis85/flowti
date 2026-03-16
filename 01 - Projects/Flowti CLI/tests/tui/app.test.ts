import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/app.js";
import { TuiProvider } from "../../src/tui/context.js";
import type { TuiContextValue } from "../../src/tui/context.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	projectsDir: "/vault/01 - Projects",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
	processRunner: { spawn: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }) } as never,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

function renderApp() {
	return render(
		React.createElement(TuiProvider, { value: mockTuiContext },
			React.createElement(App, {}),
		),
	);
}

describe("App", () => {
	it("renders activity bar with all section labels", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		expect(frame).toContain("Agents");
		expect(frame).toContain("Project");
		unmount();
	});

	it("renders header bar with breadcrumbs", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		unmount();
	});

	it("renders status bar with zone-aware hints", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		// Content zone is default focus — should show content hints
		expect(frame).toContain("Navigate");
		expect(frame).toContain("Sidebar");
		unmount();
	});

	it("renders content area with start page", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		expect(frame).toContain("start");
		unmount();
	});
});
