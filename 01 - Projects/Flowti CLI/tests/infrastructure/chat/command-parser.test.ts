import { describe, it, expect } from "vitest";
import { parseCommand } from "../../../src/infrastructure/chat/command-parser.js";

describe("parseCommand", () => {
	it("parses /new", () => {
		expect(parseCommand("/new")).toEqual({ type: "new" });
	});

	it("parses /done", () => {
		expect(parseCommand("/done")).toEqual({ type: "done" });
	});

	it("parses /back", () => {
		expect(parseCommand("/back")).toEqual({ type: "back" });
	});

	it("parses /let go", () => {
		expect(parseCommand("/let go")).toEqual({ type: "let-go" });
	});

	it("parses /history", () => {
		expect(parseCommand("/history")).toEqual({ type: "history" });
	});

	it("parses /topics", () => {
		expect(parseCommand("/topics")).toEqual({ type: "topics" });
	});

	it("parses /pick with name", () => {
		expect(parseCommand("/pick feature-auth")).toEqual({ type: "pick", name: "feature-auth" });
	});

	it("parses /pick with multi-word name", () => {
		expect(parseCommand("/pick my cool topic")).toEqual({ type: "pick", name: "my cool topic" });
	});

	it("parses /clear", () => {
		expect(parseCommand("/clear")).toEqual({ type: "clear" });
	});

	it("parses /focus", () => {
		expect(parseCommand("/focus")).toEqual({ type: "focus" });
	});

	it("parses /talk", () => {
		expect(parseCommand("/talk")).toEqual({ type: "talk" });
	});

	it("returns null for unknown command", () => {
		expect(parseCommand("/unknown")).toBeNull();
	});

	it("returns null for non-command input", () => {
		expect(parseCommand("hello")).toBeNull();
	});

	it("returns null for empty input", () => {
		expect(parseCommand("")).toBeNull();
	});

	it("is case-insensitive", () => {
		expect(parseCommand("/DONE")).toEqual({ type: "done" });
		expect(parseCommand("/New")).toEqual({ type: "new" });
	});

	it("trims whitespace", () => {
		expect(parseCommand("  /done  ")).toEqual({ type: "done" });
	});

	it("returns null for /pick without a name", () => {
		expect(parseCommand("/pick")).toBeNull();
		expect(parseCommand("/pick  ")).toBeNull();
	});
});
