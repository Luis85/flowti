import { describe, it, expect, vi, beforeEach } from "vitest";

let askResponses: string[] = [];

vi.mock("../../src/infrastructure/readline.js", () => ({
	createRL: () => ({ close: vi.fn() }),
	ask: vi.fn(() => Promise.resolve(askResponses.shift() ?? "q")),
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

import { runMenu } from "../../src/infrastructure/menu.js";
import type { MenuEntry } from "../../src/infrastructure/types.js";

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
});
