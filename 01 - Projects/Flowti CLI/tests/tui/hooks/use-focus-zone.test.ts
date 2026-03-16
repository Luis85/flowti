import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useFocusZone } from "../../../src/tui/hooks/use-focus-zone.js";
import type { FocusZone } from "../../../src/tui/types.js";

interface FocusResult {
	active: FocusZone;
	next: () => void;
	prev: () => void;
	setActive: (zone: FocusZone) => void;
}

function FocusHarness({ resultRef }: { resultRef: React.MutableRefObject<FocusResult | null> }): React.JSX.Element {
	const result = useFocusZone(["activity-bar", "content"]);
	resultRef.current = result;
	return React.createElement(Text, null, result.active);
}

function renderFocus() {
	const resultRef: React.MutableRefObject<FocusResult | null> = { current: null };
	const instance = render(React.createElement(FocusHarness, { resultRef }));
	return { ...instance, focus: () => resultRef.current! };
}

function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

describe("useFocusZone", () => {
	it("starts at content zone (zones[1])", () => {
		const { unmount, focus } = renderFocus();
		expect(focus().active).toBe("content");
		unmount();
	});

	it("next cycles from content to activity-bar", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("next wraps from activity-bar back to content", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		focus().next();
		await flush();
		expect(focus().active).toBe("content");
		unmount();
	});

	it("prev cycles from content to activity-bar", async () => {
		const { unmount, focus } = renderFocus();
		focus().prev();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("setActive jumps to a zone", async () => {
		const { unmount, focus } = renderFocus();
		focus().setActive("activity-bar");
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});
});
