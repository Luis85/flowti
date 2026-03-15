import { describe, it, expect } from "vitest";
import { greet, add } from "../src/main.js";

describe("greet", () => {
	it("returns greeting with name", () => {
		expect(greet("World")).toBe("Hello, World!");
	});
});

describe("add", () => {
	it("adds two numbers", () => {
		expect(add(2, 3)).toBe(5);
	});
});
