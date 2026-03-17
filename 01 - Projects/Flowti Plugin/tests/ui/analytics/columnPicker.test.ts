// @vitest-environment happy-dom
/**
 * Unit tests for the column picker utility and groupColumnsByType helper.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { renderColumnPicker, groupColumnsByType } from "../../../src/ui/analytics/queries/columnPicker";
import type { ColumnTypeHint } from "../../../src/domain/analytics/types";

describe("columnPicker", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	describe("renderColumnPicker", () => {
		it("should render a flat list when all columns have same type", () => {
			const select = renderColumnPicker(container, {
				headers: ["name", "city", "country"],
				typeHints: [
					{ column: "name", type: "string" },
					{ column: "city", type: "string" },
					{ column: "country", type: "string" },
				],
			});

			expect(select.tagName).toBe("SELECT");
			expect(select.options.length).toBe(3);
			expect(select.querySelectorAll("optgroup").length).toBe(0);
		});

		it("should render optgroups when multiple types present", () => {
			const select = renderColumnPicker(container, {
				headers: ["cost", "name", "date"],
				typeHints: [
					{ column: "cost", type: "number" },
					{ column: "name", type: "string" },
					{ column: "date", type: "date" },
				],
			});

			const optgroups = select.querySelectorAll("optgroup");
			expect(optgroups.length).toBe(3);
			expect(optgroups[0].label).toBe("Numeric");
			expect(optgroups[1].label).toBe("Date");
			expect(optgroups[2].label).toBe("Text");
		});

		it("should select the correct option", () => {
			const select = renderColumnPicker(container, {
				headers: ["a", "b", "c"],
				typeHints: [
					{ column: "a", type: "string" },
					{ column: "b", type: "number" },
					{ column: "c", type: "string" },
				],
				selected: "b",
			});

			expect(select.value).toBe("b");
		});

		it("should apply cssText to the select element", () => {
			const select = renderColumnPicker(container, {
				headers: ["x"],
				typeHints: [],
				cssText: "color:red",
			});

			expect(select.style.color).toBe("red");
		});

		it("should call onChange when selection changes", () => {
			let changed = "";
			const select = renderColumnPicker(container, {
				headers: ["a", "b"],
				typeHints: [],
				onChange: (col) => { changed = col; },
			});

			select.value = "b";
			select.dispatchEvent(new Event("change"));
			expect(changed).toBe("b");
		});

		it("should render placeholder option when provided", () => {
			const select = renderColumnPicker(container, {
				headers: ["a", "b"],
				typeHints: [],
				placeholder: "Select column...",
			});

			const firstOpt = select.options[0];
			expect(firstOpt.textContent).toBe("Select column...");
			expect(firstOpt.disabled).toBe(true);
			expect(select.options.length).toBe(3); // placeholder + 2 columns
		});

		it("should default untyped columns to string group", () => {
			const select = renderColumnPicker(container, {
				headers: ["cost", "name"],
				typeHints: [{ column: "cost", type: "number" }],
			});

			const optgroups = select.querySelectorAll("optgroup");
			expect(optgroups.length).toBe(2);
			// "name" should be in Text group
			expect(optgroups[1].label).toBe("Text");
			expect(optgroups[1].querySelectorAll("option").length).toBe(1);
		});

		it("should order groups: Numeric, Date, Text", () => {
			const select = renderColumnPicker(container, {
				headers: ["text_col", "date_col", "num_col"],
				typeHints: [
					{ column: "text_col", type: "string" },
					{ column: "date_col", type: "date" },
					{ column: "num_col", type: "number" },
				],
			});

			const optgroups = select.querySelectorAll("optgroup");
			expect(optgroups[0].label).toBe("Numeric");
			expect(optgroups[1].label).toBe("Date");
			expect(optgroups[2].label).toBe("Text");
		});

		it("should handle empty headers", () => {
			const select = renderColumnPicker(container, {
				headers: [],
				typeHints: [],
			});

			expect(select.options.length).toBe(0);
		});
	});

	describe("groupColumnsByType", () => {
		it("should group columns by detected type", () => {
			const groups = groupColumnsByType(
				["cost", "name", "date", "qty"],
				[
					{ column: "cost", type: "number" },
					{ column: "name", type: "string" },
					{ column: "date", type: "date" },
					{ column: "qty", type: "number" },
				],
			);

			expect(groups).toHaveLength(3);
			expect(groups[0]).toEqual({ type: "number", label: "Numeric", columns: ["cost", "qty"] });
			expect(groups[1]).toEqual({ type: "date", label: "Date", columns: ["date"] });
			expect(groups[2]).toEqual({ type: "string", label: "Text", columns: ["name"] });
		});

		it("should default untyped columns to string", () => {
			const groups = groupColumnsByType(
				["unknown", "cost"],
				[{ column: "cost", type: "number" }],
			);

			expect(groups).toHaveLength(2);
			expect(groups[0]).toEqual({ type: "number", label: "Numeric", columns: ["cost"] });
			expect(groups[1]).toEqual({ type: "string", label: "Text", columns: ["unknown"] });
		});

		it("should return empty array for empty headers", () => {
			const groups = groupColumnsByType([], []);
			expect(groups).toEqual([]);
		});

		it("should omit groups with no columns", () => {
			const groups = groupColumnsByType(
				["x", "y"],
				[
					{ column: "x", type: "number" },
					{ column: "y", type: "number" },
				],
			);

			expect(groups).toHaveLength(1);
			expect(groups[0].type).toBe("number");
		});
	});
});
