import { describe, expect, it } from "vitest";
import { textFromWorkerResponsePayload } from "../src/lib/worker-response-text.js";

describe("textFromWorkerResponsePayload", () => {
	it("returns empty for non-objects", () => {
		expect(textFromWorkerResponsePayload(null)).toBe("");
		expect(textFromWorkerResponsePayload(undefined)).toBe("");
		expect(textFromWorkerResponsePayload("x")).toBe("");
	});

	it("prefers message then text then response then content", () => {
		expect(textFromWorkerResponsePayload({ message: "m", text: "t" })).toBe("m");
		expect(textFromWorkerResponsePayload({ text: "t", response: "r" })).toBe("t");
		expect(textFromWorkerResponsePayload({ response: "r", content: "c" })).toBe("r");
		expect(textFromWorkerResponsePayload({ content: "only" })).toBe("only");
	});

	it("stringifies non-string primitives", () => {
		expect(textFromWorkerResponsePayload({ text: 42 as unknown as string })).toBe("42");
	});
});
