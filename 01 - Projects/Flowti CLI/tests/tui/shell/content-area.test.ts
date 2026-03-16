import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ContentArea } from "../../../src/tui/shell/content-area.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ContentArea", () => {
	it("renders placeholder for unknown page", () => {
		const { unmount, ...instance } = render(
			React.createElement(ContentArea, {
				pageId: "unknown-page",
				params: {},
				navigate: () => {},
				goBack: () => {},
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("unknown-page");
		expect(frame).toContain("migrated");
		unmount();
	});
});
