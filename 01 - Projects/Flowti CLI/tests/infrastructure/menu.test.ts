import { describe, it, expect, vi, beforeEach } from "vitest";

let askResponses: string[] = [];

vi.mock("../../src/infrastructure/input.js", () => ({
	input: {
		ask: vi.fn(() => Promise.resolve(askResponses.shift() ?? "q")),
	},
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	printHeader: vi.fn(),
	printMenu: vi.fn(),
	RESET: "",
	BOLD: "",
	DIM: "",
	GREEN: "",
	RED: "",
	CYAN: "",
	YELLOW: "",
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	info: vi.fn(),
	blank: vi.fn(),
}));

import { runMenu, insertGroupSeparators } from "../../src/infrastructure/menu.js";
import type { MenuEntry, MenuItem, MenuResult } from "../../src/infrastructure/types.js";

beforeEach(() => {
	vi.clearAllMocks();
	askResponses = [];
});

describe("runMenu", () => {
	it("dispatches action for matching key", async () => {
		const action = vi.fn(() => "quit" as const);
		const items: MenuEntry[] = [
			{ key: "1", label: "Quit", action },
		];
		askResponses = ["1"];

		const result = await runMenu("Test", items);
		expect(action).toHaveBeenCalledOnce();
		expect(result).toBe("quit");
	});

	it("returns 'main' when action returns 'main'", async () => {
		const items: MenuEntry[] = [
			{ key: "b", label: "Back", action: () => "main" as const },
		];
		askResponses = ["b"];

		const result = await runMenu("Test", items);
		expect(result).toBe("main");
	});

	it("returns 'start' when action returns 'start'", async () => {
		const items: MenuEntry[] = [
			{ key: "s", label: "Start", action: () => "start" as const },
		];
		askResponses = ["s"];

		const result = await runMenu(null, items);
		expect(result).toBe("start");
	});

	it("loops on invalid input then accepts valid", async () => {
		const action = vi.fn(() => "quit" as const);
		const items: MenuEntry[] = [
			{ key: "1", label: "Go", action },
		];
		askResponses = ["x", "z", "1"];

		const result = await runMenu("Test", items);
		expect(action).toHaveBeenCalledOnce();
		expect(result).toBe("quit");
	});

	it("stays in loop when action returns void", async () => {
		let calls = 0;
		const items: MenuEntry[] = [
			{ key: "1", label: "Do", action: () => { calls++; } },
			{ key: "q", label: "Quit", action: () => "quit" as const },
		];
		askResponses = ["1", "1", "q"];

		await runMenu("Test", items);
		expect(calls).toBe(2);
	});

	it("skips disabled items", async () => {
		const action = vi.fn();
		const items: MenuEntry[] = [
			{ key: "1", label: "Locked", action, disabled: true, disabledMessage: "  Nope" },
			{ key: "q", label: "Quit", action: () => "quit" as const },
		];
		askResponses = ["1", "q"];

		await runMenu("Test", items);
		expect(action).not.toHaveBeenCalled();
	});

	it("evaluates disabled as function each iteration", async () => {
		let locked = true;
		const action = vi.fn(() => "quit" as const);
		const items: MenuEntry[] = [
			{ key: "1", label: "Toggle", action, disabled: () => locked },
			{ key: "2", label: "Unlock", action: () => { locked = false; } },
		];
		askResponses = ["1", "2", "1"];

		const result = await runMenu("Test", items);
		// First "1" is blocked, "2" unlocks, second "1" goes through
		expect(action).toHaveBeenCalledOnce();
		expect(result).toBe("quit");
	});

	it("matches keys case-insensitively", async () => {
		const action = vi.fn(() => "quit" as const);
		const items: MenuEntry[] = [
			{ key: "q", label: "Quit", action },
		];
		askResponses = ["Q"];

		await runMenu("Test", items);
		expect(action).toHaveBeenCalledOnce();
	});

	it("calls onAgentQuestion when ! is pressed and returns its result", async () => {
		const onAgentQuestion = vi.fn(async () => "refresh" as MenuResult);
		const items: MenuEntry[] = [
			{ key: "q", label: "Quit", action: () => "quit" as const },
		];
		askResponses = ["!"];

		const result = await runMenu("Test", items, { onAgentQuestion });
		expect(onAgentQuestion).toHaveBeenCalledOnce();
		expect(result).toBe("refresh");
	});

	it("continues menu loop when onAgentQuestion returns undefined", async () => {
		const onAgentQuestion = vi.fn(async () => undefined);
		const items: MenuEntry[] = [
			{ key: "q", label: "Quit", action: () => "quit" as const },
		];
		askResponses = ["!", "q"];

		const result = await runMenu("Test", items, { onAgentQuestion });
		expect(onAgentQuestion).toHaveBeenCalledOnce();
		expect(result).toBe("quit");
	});

	it("treats ! as invalid input when onAgentQuestion is not provided", async () => {
		const items: MenuEntry[] = [
			{ key: "q", label: "Quit", action: () => "quit" as const },
		];
		askResponses = ["!", "q"];

		const result = await runMenu("Test", items);
		expect(result).toBe("quit");
	});

	it("calls renderStatusBar on each menu render", async () => {
		const renderStatusBar = vi.fn();
		const items: MenuEntry[] = [
			{ key: "q", label: "Quit", action: () => "quit" as const },
		];
		askResponses = ["q"];

		await runMenu("Test", items, { renderStatusBar });
		expect(renderStatusBar).toHaveBeenCalledOnce();
	});
});

// ── Group separator tests ──────────────────────────────────────────

/** Helper to create a simple menu item with an optional group. */
function groupItem(key: string, group?: string): MenuItem {
	return { key, label: `Label ${key}`, action: () => {}, ...(group !== undefined ? { group } : {}) };
}

describe("insertGroupSeparators", () => {
	it("inserts a separator between items with different group values", () => {
		const items: MenuEntry[] = [
			groupItem("1", "alpha"),
			groupItem("2", "beta"),
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual([
			items[0],
			{ separator: true },
			items[1],
		]);
	});

	it("does NOT insert separators between items with the same group", () => {
		const items: MenuEntry[] = [
			groupItem("1", "alpha"),
			groupItem("2", "alpha"),
			groupItem("3", "alpha"),
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual(items);
	});

	it("does NOT insert separators for items without a group", () => {
		const items: MenuEntry[] = [
			groupItem("1"),
			groupItem("2"),
			groupItem("3"),
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual(items);
	});

	it("handles mixed items — some with group, some without", () => {
		const items: MenuEntry[] = [
			groupItem("1", "alpha"),
			groupItem("2"),            // no group — does not trigger separator
			groupItem("3", "beta"),    // different from last seen group ("alpha") — separator
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual([
			items[0],
			items[1],
			{ separator: true },
			items[2],
		]);
	});

	it("preserves existing explicit separators", () => {
		const items: MenuEntry[] = [
			groupItem("1", "alpha"),
			{ separator: true as const },
			groupItem("2", "alpha"),
		];
		const result = insertGroupSeparators(items);

		// Explicit separator preserved; no extra separator added (same group)
		expect(result).toEqual([
			items[0],
			items[1],  // the explicit separator
			items[2],  // same group as item "1" — no auto-separator
		]);
	});

	it("does not insert a separator before the first grouped item", () => {
		const items: MenuEntry[] = [
			groupItem("1", "alpha"),
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual([items[0]]);
	});

	it("handles empty input", () => {
		const result = insertGroupSeparators([]);
		expect(result).toEqual([]);
	});

	it("inserts multiple separators across three groups", () => {
		const items: MenuEntry[] = [
			groupItem("1", "a"),
			groupItem("2", "a"),
			groupItem("3", "b"),
			groupItem("4", "b"),
			groupItem("5", "c"),
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual([
			items[0],
			items[1],
			{ separator: true },
			items[2],
			items[3],
			{ separator: true },
			items[4],
		]);
	});

	it("ungrouped items between two same-group items do not reset the last-seen group", () => {
		const items: MenuEntry[] = [
			groupItem("1", "alpha"),
			groupItem("2"),            // no group — lastGroup stays "alpha"
			groupItem("3", "alpha"),   // same as lastGroup — no separator
		];
		const result = insertGroupSeparators(items);

		expect(result).toEqual(items);
	});
});
