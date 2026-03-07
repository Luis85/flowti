import { describe, it, expect } from "vitest";
import { toKebab, toPascal, toCamel } from "../../../src/domain/make/naming.js";

describe("toKebab", () => {
	it("converts camelCase", () => {
		expect(toKebab("myComponent")).toBe("my-component");
	});

	it("converts PascalCase", () => {
		expect(toKebab("MyComponent")).toBe("my-component");
	});

	it("converts spaces", () => {
		expect(toKebab("my component")).toBe("my-component");
	});

	it("converts underscores", () => {
		expect(toKebab("my_component")).toBe("my-component");
	});

	it("handles already-kebab", () => {
		expect(toKebab("already-kebab")).toBe("already-kebab");
	});

	it("handles single word", () => {
		expect(toKebab("word")).toBe("word");
	});

	it("handles multiple capitals", () => {
		expect(toKebab("XMLParser")).toBe("xmlparser");
	});
});

describe("toPascal", () => {
	it("converts kebab-case", () => {
		expect(toPascal("my-component")).toBe("MyComponent");
	});

	it("converts spaces", () => {
		expect(toPascal("my component")).toBe("MyComponent");
	});

	it("converts underscores", () => {
		expect(toPascal("my_component")).toBe("MyComponent");
	});

	it("handles single word", () => {
		expect(toPascal("word")).toBe("Word");
	});

	it("handles already PascalCase", () => {
		expect(toPascal("MyComponent")).toBe("MyComponent");
	});
});

describe("toCamel", () => {
	it("converts kebab-case", () => {
		expect(toCamel("my-component")).toBe("myComponent");
	});

	it("converts spaces", () => {
		expect(toCamel("my component")).toBe("myComponent");
	});

	it("converts underscores", () => {
		expect(toCamel("my_component")).toBe("myComponent");
	});

	it("handles single word", () => {
		expect(toCamel("word")).toBe("word");
	});

	it("lowercases first letter of PascalCase", () => {
		expect(toCamel("MyComponent")).toBe("myComponent");
	});
});
