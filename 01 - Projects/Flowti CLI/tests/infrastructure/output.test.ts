import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { log } from "../../src/infrastructure/logger.js";
import { resolveFormat, printOutput } from "../../src/infrastructure/output.js";

const mockLog = vi.mocked(log);

describe("resolveFormat", () => {
	it("returns 'json' when --format=json", () => {
		expect(resolveFormat({ format: "json" })).toBe("json");
	});

	it("returns 'text' when no format flag", () => {
		expect(resolveFormat({})).toBe("text");
	});

	it("returns 'text' when format is boolean (--format without value)", () => {
		expect(resolveFormat({ format: true })).toBe("text");
	});

	it("returns 'text' for unrecognized format values", () => {
		expect(resolveFormat({ format: "xml" })).toBe("text");
	});
});

describe("printOutput", () => {
	it("prints JSON when format is json", () => {
		mockLog.mockClear();
		const data = { name: "test", version: "1.0.0" };
		const renderer = vi.fn();

		printOutput("json", data, renderer);

		expect(mockLog).toHaveBeenCalledWith(JSON.stringify(data));
		expect(renderer).not.toHaveBeenCalled();
	});

	it("calls renderer when format is text", () => {
		mockLog.mockClear();
		const data = { name: "test" };
		const renderer = vi.fn();

		printOutput("text", data, renderer);

		expect(renderer).toHaveBeenCalledWith(data);
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("serializes arrays as JSON", () => {
		mockLog.mockClear();
		const data = [{ name: "a" }, { name: "b" }];

		printOutput("json", data, vi.fn());

		expect(mockLog).toHaveBeenCalledWith(JSON.stringify(data));
	});
});
