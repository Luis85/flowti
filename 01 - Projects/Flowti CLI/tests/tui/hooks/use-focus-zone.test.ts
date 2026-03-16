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
	const result = useFocusZone(["activity-bar", "content", "actions"]);
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
	it("starts at content zone", () => {
		const { unmount, focus } = renderFocus();
		expect(focus().active).toBe("content");
		unmount();
	});

	it("next cycles to next zone", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		expect(focus().active).toBe("actions");
		unmount();
	});

	it("next wraps around", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		focus().next();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("prev cycles backward", async () => {
		const { unmount, focus } = renderFocus();
		focus().prev();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("setActive jumps to a zone", async () => {
		const { unmount, focus } = renderFocus();
		focus().setActive("actions");
		await flush();
		expect(focus().active).toBe("actions");
		unmount();
	});
});
