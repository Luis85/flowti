import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ContentArea } from "../../../src/tui/shell/content-area.js";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
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

describe("ContentArea", () => {
	it("renders placeholder for unknown page", () => {
		const { unmount, ...instance } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(ContentArea, {
					pageId: "unknown-page",
					params: {},
					navigate: () => {},
					goBack: () => {},
					focused: true,
					onEscapeDefault: () => {},
				}),
			),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("unknown-page");
		expect(frame).toContain("migrated");
		unmount();
	});
});
