import { describe, it, expect } from "vitest";
import { MAX_TRAINS, MAX_THOUGHTS_PER_TRAIN } from "../../../src/domain/train/types";

describe("Train domain types", () => {
	it("MAX_TRAINS is 100", () => {
		expect(MAX_TRAINS).toBe(100);
	});

	it("MAX_THOUGHTS_PER_TRAIN is 500", () => {
		expect(MAX_THOUGHTS_PER_TRAIN).toBe(500);
	});
});
