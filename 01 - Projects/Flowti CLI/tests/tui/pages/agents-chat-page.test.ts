import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";

// Import triggers self-registration
import "../../../src/tui/pages/agents-chat-page.js";
import { getPage } from "../../../src/tui/pages/page-registry.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("AgentsChatPage", () => {
	it("is registered in the page registry", () => {
		const Page = getPage("agents-chat");
		expect(Page).toBeDefined();
	});

	it("renders chat interface with agent name", () => {
		const Page = getPage("agents-chat");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, {
					pageId: "agents-chat",
					params: { agentName: "Atlas" },
					navigate: () => {},
					goBack: () => {},
				}),
			),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Atlas");
		unmount();
	});

	it("shows status indicator", () => {
		const Page = getPage("agents-chat");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, {
					pageId: "agents-chat",
					params: { agentName: "Atlas" },
					navigate: () => {},
					goBack: () => {},
				}),
			),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("\u25CF");
		unmount();
	});
});
