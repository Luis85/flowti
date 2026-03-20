import { describe, it, expect } from "vitest";
import { parseTodos, addTodoLine, toggleTodoLine, deleteTodoLine } from "../../../src/domain/projects/todo-service.js";

describe("parseTodos", () => {
	it("parses checkbox lines", () => {
		const md = "# TODO\n\n- [ ] First task\n- [x] Done task\n- [ ] Third task";
		expect(parseTodos(md)).toEqual([
			{ text: "First task", done: false },
			{ text: "Done task", done: true },
			{ text: "Third task", done: false },
		]);
	});

	it("returns empty array for no checkboxes", () => {
		expect(parseTodos("# Notes\n\nSome text")).toEqual([]);
	});

	it("ignores non-checkbox lines", () => {
		const md = "- [ ] Task\n- Regular bullet\n- [x] Done";
		expect(parseTodos(md)).toEqual([
			{ text: "Task", done: false },
			{ text: "Done", done: true },
		]);
	});
});

describe("addTodoLine", () => {
	it("appends a new unchecked item", () => {
		const md = "- [ ] Existing";
		expect(addTodoLine(md, "New task")).toBe("- [ ] Existing\n- [ ] New task");
	});

	it("creates content when empty", () => {
		expect(addTodoLine("", "First")).toBe("- [ ] First");
	});
});

describe("toggleTodoLine", () => {
	it("toggles unchecked to checked", () => {
		const md = "- [ ] A\n- [ ] B";
		expect(toggleTodoLine(md, 1)).toBe("- [ ] A\n- [x] B");
	});

	it("toggles checked to unchecked", () => {
		const md = "- [x] A\n- [ ] B";
		expect(toggleTodoLine(md, 0)).toBe("- [ ] A\n- [ ] B");
	});

	it("returns unchanged if index out of range", () => {
		const md = "- [ ] A";
		expect(toggleTodoLine(md, 5)).toBe("- [ ] A");
	});
});

describe("deleteTodoLine", () => {
	it("removes the item at index", () => {
		const md = "- [ ] A\n- [ ] B\n- [ ] C";
		expect(deleteTodoLine(md, 1)).toBe("- [ ] A\n- [ ] C");
	});

	it("returns unchanged if index out of range", () => {
		const md = "- [ ] A";
		expect(deleteTodoLine(md, 3)).toBe("- [ ] A");
	});
});
