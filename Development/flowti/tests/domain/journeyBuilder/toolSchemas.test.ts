import { describe, expect, it } from "vitest";
import { TOOL_SCHEMAS, TOOL_CATEGORIES, getToolsByCategory } from "../../../src/domain/journeyBuilder/toolSchemas";
import type { JourneyToolName, ToolCategory } from "../../../src/domain/journeyBuilder/types";

const ALL_TOOL_NAMES: JourneyToolName[] = [
	"command", "click", "input", "set-input", "highlight",
	"wait", "screenshot", "navigate", "assert", "assert-text",
	"assert-number", "emit", "eval", "manual", "notice",
	"theme", "ribbon", "create-file", "delete-file", "open-file",
	"open-url", "close-leaves", "close-modals", "seed",
	"frontmatter", "query-trace", "write-run-log", "scroll-to",
	"visual-inspection", "spinner",
];

const VALID_FIELD_TYPES = new Set(["text", "number", "select", "textarea"]);
const VALID_CATEGORIES: ToolCategory[] = ["interaction", "assertion", "lifecycle", "feedback", "data"];

describe("TOOL_SCHEMAS", () => {
	it("has exactly 30 tool entries", () => {
		expect(Object.keys(TOOL_SCHEMAS)).toHaveLength(30);
	});

	it("has an entry for every JourneyToolName", () => {
		for (const name of ALL_TOOL_NAMES) {
			expect(TOOL_SCHEMAS[name], `missing schema for ${name}`).toBeDefined();
		}
	});

	it("each entry has a matching name field", () => {
		for (const [key, schema] of Object.entries(TOOL_SCHEMAS)) {
			expect(schema.name).toBe(key);
		}
	});

	it("each entry has a non-empty label", () => {
		for (const schema of Object.values(TOOL_SCHEMAS)) {
			expect(schema.label.length, `${schema.name} has empty label`).toBeGreaterThan(0);
		}
	});

	it("each entry has a valid category", () => {
		for (const schema of Object.values(TOOL_SCHEMAS)) {
			expect(VALID_CATEGORIES, `${schema.name} has invalid category: ${schema.category}`)
				.toContain(schema.category);
		}
	});

	it("each field has a valid type", () => {
		for (const schema of Object.values(TOOL_SCHEMAS)) {
			for (const field of schema.fields) {
				expect(VALID_FIELD_TYPES.has(field.type), `${schema.name}.${field.key} has invalid type: ${field.type}`)
					.toBe(true);
			}
		}
	});

	it("select fields have non-empty options", () => {
		for (const schema of Object.values(TOOL_SCHEMAS)) {
			for (const field of schema.fields) {
				if (field.type === "select") {
					expect(field.options?.length, `${schema.name}.${field.key} select has no options`)
						.toBeGreaterThan(0);
				}
			}
		}
	});

	it("has no duplicate field keys within a tool", () => {
		for (const schema of Object.values(TOOL_SCHEMAS)) {
			const keys = schema.fields.map((f) => f.key);
			expect(new Set(keys).size, `${schema.name} has duplicate field keys`).toBe(keys.length);
		}
	});

	it("command schema has exactly 1 required field 'id'", () => {
		const fields = TOOL_SCHEMAS.command.fields;
		expect(fields).toHaveLength(1);
		expect(fields[0].key).toBe("id");
		expect(fields[0].required).toBe(true);
	});

	it("assert schema has 'type' as required select with 8 options", () => {
		const typeField = TOOL_SCHEMAS.assert.fields.find((f) => f.key === "type");
		expect(typeField).toBeDefined();
		expect(typeField!.required).toBe(true);
		expect(typeField!.type).toBe("select");
		expect(typeField!.options).toHaveLength(8);
	});

	it("close-modals schema has 0 fields", () => {
		expect(TOOL_SCHEMAS["close-modals"].fields).toHaveLength(0);
	});

	it("covers all 5 categories", () => {
		const usedCategories = new Set(Object.values(TOOL_SCHEMAS).map((s) => s.category));
		for (const cat of VALID_CATEGORIES) {
			expect(usedCategories.has(cat), `category '${cat}' not used`).toBe(true);
		}
	});

	it("required fields on tools with required params", () => {
		// Spot-check a few tools that must have required fields
		expect(TOOL_SCHEMAS.click.fields.find((f) => f.key === "selector")?.required).toBe(true);
		expect(TOOL_SCHEMAS.wait.fields.find((f) => f.key === "ms")?.required).toBe(true);
		expect(TOOL_SCHEMAS["assert-text"].fields.find((f) => f.key === "contains")?.required).toBe(true);
	});
});

describe("TOOL_CATEGORIES", () => {
	it("has 5 category entries", () => {
		expect(TOOL_CATEGORIES).toHaveLength(5);
	});

	it("each category has an id and label", () => {
		for (const cat of TOOL_CATEGORIES) {
			expect(cat.id).toBeTruthy();
			expect(cat.label).toBeTruthy();
		}
	});
});

describe("getToolsByCategory", () => {
	it("returns interaction tools sorted by label", () => {
		const tools = getToolsByCategory("interaction");
		expect(tools.length).toBe(8);
		const labels = tools.map((t) => t.label);
		expect(labels).toEqual([...labels].sort());
	});

	it("returns assertion tools", () => {
		const tools = getToolsByCategory("assertion");
		expect(tools.length).toBe(3);
	});

	it("returns lifecycle tools", () => {
		const tools = getToolsByCategory("lifecycle");
		expect(tools.length).toBe(7);
	});

	it("returns feedback tools", () => {
		const tools = getToolsByCategory("feedback");
		expect(tools.length).toBe(8);
	});

	it("returns data tools", () => {
		const tools = getToolsByCategory("data");
		expect(tools.length).toBe(4);
	});
});
