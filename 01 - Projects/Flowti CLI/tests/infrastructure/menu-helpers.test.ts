import { describe, it, expect, vi } from "vitest";
import { collectFields, selectFromList, selectStatus } from "../../src/infrastructure/menu-helpers.js";
import type { FieldDef, SelectOptions } from "../../src/infrastructure/menu-helpers.js";
import type { IInput } from "../../src/infrastructure/types.js";

function mockInput(answers: string[]): IInput {
	let i = 0;
	return {
		ask: vi.fn(async () => answers[i++] ?? ""),
		askAbortable: vi.fn((q: string) => ({ promise: Promise.resolve(q), abort: () => {} })),
		askYesNo: vi.fn(async () => false),
		waitForEnter: vi.fn(async () => {}),
	};
}

function mockLog(): (msg: string) => void {
	return vi.fn();
}

// ── collectFields ───────────────────────────────────────────────────

describe("collectFields", () => {
	it("collects all fields into a record", async () => {
		const fields: FieldDef[] = [
			{ key: "name", label: "Name", required: true },
			{ key: "desc", label: "Description" },
		];
		const input = mockInput(["My Item", "A description"]);

		const result = await collectFields(fields, input);

		expect(result).toEqual({ name: "My Item", desc: "A description" });
		expect(input.ask).toHaveBeenCalledTimes(2);
	});

	it("returns null when a required field is left empty", async () => {
		const fields: FieldDef[] = [
			{ key: "name", label: "Name", required: true },
		];
		const input = mockInput([""]);

		const result = await collectFields(fields, input);

		expect(result).toBeNull();
	});

	it("keeps empty strings for optional fields", async () => {
		const fields: FieldDef[] = [
			{ key: "name", label: "Name", required: true },
			{ key: "note", label: "Note" },
		];
		const input = mockInput(["Test", ""]);

		const result = await collectFields(fields, input);

		expect(result).toEqual({ name: "Test", note: "" });
	});

	it("uses string defaults", async () => {
		const fields: FieldDef[] = [
			{ key: "priority", label: "Priority", default: "medium" },
		];
		const input = mockInput(["medium"]);

		await collectFields(fields, input);

		expect(input.ask).toHaveBeenCalledWith("Priority", "medium");
	});

	it("calls function defaults at prompt time", async () => {
		let callCount = 0;
		const fields: FieldDef[] = [
			{ key: "date", label: "Date", default: () => { callCount++; return "2026-01-01"; } },
		];
		const input = mockInput(["2026-01-01"]);

		await collectFields(fields, input);

		expect(callCount).toBe(1);
		expect(input.ask).toHaveBeenCalledWith("Date", "2026-01-01");
	});

	it("handles empty field list", async () => {
		const input = mockInput([]);

		const result = await collectFields([], input);

		expect(result).toEqual({});
		expect(input.ask).not.toHaveBeenCalled();
	});

	it("stops at first empty required field", async () => {
		const fields: FieldDef[] = [
			{ key: "a", label: "A", required: true },
			{ key: "b", label: "B", required: true },
		];
		const input = mockInput(["value", ""]);

		const result = await collectFields(fields, input);

		expect(result).toBeNull();
		expect(input.ask).toHaveBeenCalledTimes(2);
	});
});

// ── selectFromList ──────────────────────────────────────────────────

describe("selectFromList", () => {
	const options: SelectOptions<{ name: string; status: string }> = {
		format: (item) => `${item.name} [${item.status}]`,
	};

	it("returns selected item by number", async () => {
		const items = [
			{ name: "Alpha", status: "open" },
			{ name: "Beta", status: "closed" },
		];
		const input = mockInput(["2"]);
		const log = mockLog();

		const result = await selectFromList(items, { input, log }, options);

		expect(result).toEqual({ name: "Beta", status: "closed" });
		expect(log).toHaveBeenCalledWith("  1. Alpha [open]");
		expect(log).toHaveBeenCalledWith("  2. Beta [closed]");
	});

	it("returns null for empty list", async () => {
		const input = mockInput([]);
		const log = mockLog();

		const result = await selectFromList([], { input, log }, options);

		expect(result).toBeNull();
		expect(log).toHaveBeenCalledWith("\n  No items found.\n");
	});

	it("uses custom empty message", async () => {
		const input = mockInput([]);
		const log = mockLog();

		await selectFromList([], { input, log }, { ...options, emptyMessage: "Nothing here." });

		expect(log).toHaveBeenCalledWith("\n  Nothing here.\n");
	});

	it("returns null for invalid input", async () => {
		const items = [{ name: "A", status: "open" }];
		const input = mockInput(["abc"]);
		const log = mockLog();

		const result = await selectFromList(items, { input, log }, options);

		expect(result).toBeNull();
	});

	it("returns null for out-of-range number", async () => {
		const items = [{ name: "A", status: "open" }];
		const input = mockInput(["5"]);
		const log = mockLog();

		const result = await selectFromList(items, { input, log }, options);

		expect(result).toBeNull();
	});

	it("returns null for zero", async () => {
		const items = [{ name: "A", status: "open" }];
		const input = mockInput(["0"]);
		const log = mockLog();

		const result = await selectFromList(items, { input, log }, options);

		expect(result).toBeNull();
	});

	it("returns null for negative number", async () => {
		const items = [{ name: "A", status: "open" }];
		const input = mockInput(["-1"]);
		const log = mockLog();

		const result = await selectFromList(items, { input, log }, options);

		expect(result).toBeNull();
	});

	it("uses custom prompt text", async () => {
		const items = [{ name: "A", status: "open" }];
		const input = mockInput(["1"]);
		const log = mockLog();

		await selectFromList(items, { input, log }, { ...options, prompt: "Pick one" });

		expect(input.ask).toHaveBeenCalledWith("Pick one");
	});

	it("passes index to format function", async () => {
		const items = ["a", "b", "c"];
		const input = mockInput(["1"]);
		const log = mockLog();
		const format = vi.fn((item: string, idx: number) => `${idx}: ${item}`);

		await selectFromList(items, { input, log }, { format });

		expect(format).toHaveBeenCalledWith("a", 0);
		expect(format).toHaveBeenCalledWith("b", 1);
		expect(format).toHaveBeenCalledWith("c", 2);
	});
});

// ── selectStatus ────────────────────────────────────────────────────

describe("selectStatus", () => {
	const statuses = ["open", "mitigated", "closed"] as const;

	it("returns selected valid status", async () => {
		const input = mockInput(["closed"]);
		const log = mockLog();

		const result = await selectStatus(statuses, "open", { input, log });

		expect(result).toBe("closed");
		expect(input.ask).toHaveBeenCalledWith("New status", "open");
	});

	it("shows available statuses", async () => {
		const input = mockInput(["open"]);
		const log = mockLog();

		await selectStatus(statuses, "open", { input, log });

		expect(log).toHaveBeenCalledWith("\n  Statuses: open, mitigated, closed");
	});

	it("returns null for invalid status", async () => {
		const input = mockInput(["invalid"]);
		const log = mockLog();

		const result = await selectStatus(statuses, "open", { input, log });

		expect(result).toBeNull();
		expect(log).toHaveBeenCalledWith('\n  Invalid status: "invalid"\n');
	});

	it("uses current status as default", async () => {
		const input = mockInput(["mitigated"]);
		const log = mockLog();

		await selectStatus(statuses, "mitigated", { input, log });

		expect(input.ask).toHaveBeenCalledWith("New status", "mitigated");
	});
});
