import { describe, it, expect } from "vitest";
import { getCanvasPath } from "../../../src/domain/train/helpers";

describe("getCanvasPath", () => {
	it("returns folder/title.canvas when folder is set", () => {
		expect(getCanvasPath("My Train", "Trains")).toBe("Trains/My Train.canvas");
	});

	it("returns title.canvas when folder is empty", () => {
		expect(getCanvasPath("My Train", "")).toBe("My Train.canvas");
	});

	it("handles nested folders", () => {
		expect(getCanvasPath("Ideas", "00 - Connectivity/trains")).toBe(
			"00 - Connectivity/trains/Ideas.canvas",
		);
	});

	it("handles titles with special characters", () => {
		expect(getCanvasPath("API & Design", "Trains")).toBe("Trains/API & Design.canvas");
	});
});
