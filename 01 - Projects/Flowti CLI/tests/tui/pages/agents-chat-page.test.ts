import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";

// Import triggers self-registration
import "../../../src/tui/pages/agents-chat-page.js";
import { getPage } from "../../../src/tui/pages/page-registry.js";

const mockShell = { check: () => false } as never;

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: { join: (...args: string[]) => args.join("/") } as never, clock: {} as never, shell: mockShell, log: () => {} },
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

function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 50));
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

	it("shows connecting then error when Claude CLI missing", async () => {
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
		await flush();
		const frame = lastFrame(inst);
		expect(frame).toContain("Claude CLI not found");
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
