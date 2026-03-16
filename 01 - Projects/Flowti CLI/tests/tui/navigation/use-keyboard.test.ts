import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useKeyboard } from "../../../src/tui/navigation/use-keyboard.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";

function KeyboardHarness({ onSectionChange, enabled }: { onSectionChange: (id: string) => void; enabled: boolean }): React.JSX.Element {
	const sections = buildSections();
	useKeyboard({ sections, activeSection: "home", onSectionChange, enabled });
	return React.createElement(Text, null, "keyboard-harness");
}

function KeyboardOpenHarness({ onSectionChange, onSectionOpen, enabled }: { onSectionChange: (id: string) => void; onSectionOpen: (id: string) => void; enabled: boolean }): React.JSX.Element {
	const sections = buildSections();
	useKeyboard({ sections, activeSection: "home", onSectionChange, onSectionOpen, enabled });
	return React.createElement(Text, null, "keyboard-harness");
}

describe("useKeyboard", () => {
	it("calls onSectionChange on down arrow when enabled", () => {
		const onSectionChange = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardHarness, { onSectionChange, enabled: true }),
		);
		stdin.write("\u001B[B"); // down arrow
		expect(onSectionChange).toHaveBeenCalledWith("agents");
		unmount();
	});

	it("does not call onSectionChange when disabled", () => {
		const onSectionChange = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardHarness, { onSectionChange, enabled: false }),
		);
		stdin.write("\u001B[B"); // down arrow
		expect(onSectionChange).not.toHaveBeenCalled();
		unmount();
	});

	it("calls onSectionChange with current section on Enter when no onSectionOpen", () => {
		const onSectionChange = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardHarness, { onSectionChange, enabled: true }),
		);
		stdin.write("\r"); // Enter
		expect(onSectionChange).toHaveBeenCalledWith("home");
		unmount();
	});

	it("calls onSectionOpen instead of onSectionChange when provided", () => {
		const onSectionChange = vi.fn();
		const onSectionOpen = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardOpenHarness, { onSectionChange, onSectionOpen, enabled: true }),
		);
		stdin.write("\r"); // Enter
		expect(onSectionOpen).toHaveBeenCalledWith("home");
		expect(onSectionChange).not.toHaveBeenCalled();
		unmount();
	});
});
