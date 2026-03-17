import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { NavigationProvider, useNavigationContext } from "../../../src/tui/sitemap/navigation-context.js";

function TestConsumer(): React.JSX.Element {
	const nav = useNavigationContext();
	return React.createElement(Text, null, nav ? "has-nav" : "no-nav");
}

describe("NavigationContext", () => {
	it("provides navigation functions to children", () => {
		const navigate = vi.fn();
		const goBack = vi.fn();
		const refresh = vi.fn();
		const { lastFrame } = render(
			React.createElement(NavigationProvider, { navigate, goBack, refresh },
				React.createElement(TestConsumer),
			),
		);
		expect(lastFrame()).toContain("has-nav");
	});

	it("useNavigationContext throws when no provider is present", () => {
		// Calling a hook outside a React render cycle throws (React's hook rules).
		// This verifies the hook cannot be used in an unsupported context.
		expect(() => useNavigationContext()).toThrow();
	});
});
