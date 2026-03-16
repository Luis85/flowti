import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";

// Import triggers self-registration
import "../../../src/tui/pages/projects-list-page.js";
import { getPage } from "../../../src/tui/pages/page-registry.js";

const mockDisk = {
	existsSync: () => true,
	readdirSync: () => [
		{ name: "Flowti CLI", isDirectory: () => true },
		{ name: "Flowti Plugin", isDirectory: () => true },
	],
} as never;

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
	basename: (p: string) => p.split("/").pop() ?? p,
} as never;

const mockTuiContext: TuiContextValue = {
	deps: { disk: mockDisk, paths: mockPaths, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	projectsDir: "/vault/01 - Projects",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ProjectsListPage", () => {
	it("is registered in the page registry", () => {
		const Page = getPage("projects-list");
		expect(Page).toBeDefined();
	});

	it("renders project names", () => {
		const Page = getPage("projects-list");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, {
					pageId: "projects-list",
					params: {},
					navigate: () => {},
					goBack: () => {},
				}),
			),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Flowti CLI");
		expect(frame).toContain("Flowti Plugin");
		unmount();
	});
});
