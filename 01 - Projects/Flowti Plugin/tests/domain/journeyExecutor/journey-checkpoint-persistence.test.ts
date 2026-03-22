import { describe, it, expect, vi } from "vitest";
import {
	readCheckpoint,
	writeCheckpoint,
	type JourneyCheckpointData,
} from "../../../src/domain/journeyExecutor/journey-checkpoint-persistence.js";

function makeCheckpoint(overrides: Partial<JourneyCheckpointData> = {}): JourneyCheckpointData {
	return {
		journeyId: "j-001",
		taskId: "t-001",
		currentStep: 2,
		totalSteps: 5,
		status: "running",
		...overrides,
	};
}

describe("journey-checkpoint-persistence", () => {
	describe("readCheckpoint", () => {
		it("returns null when file does not exist", () => {
			const disk = {
				existsSync: vi.fn(() => false),
				readFileSync: vi.fn(),
			};
			const result = readCheckpoint(disk, "/some/path/checkpoint.json");
			expect(result).toBeNull();
			expect(disk.readFileSync).not.toHaveBeenCalled();
		});

		it("returns parsed data when file exists", () => {
			const data = makeCheckpoint();
			const disk = {
				existsSync: vi.fn(() => true),
				readFileSync: vi.fn(() => JSON.stringify(data)),
			};
			const result = readCheckpoint(disk, "/some/path/checkpoint.json");
			expect(result).toEqual(data);
		});

		it("returns null when file contains invalid JSON", () => {
			const disk = {
				existsSync: vi.fn(() => true),
				readFileSync: vi.fn(() => "not-json{{{"),
			};
			const result = readCheckpoint(disk, "/some/path/checkpoint.json");
			expect(result).toBeNull();
		});

		it("passes the correct path to existsSync and readFileSync", () => {
			const path = "/vault/.flowti/var/staging/t-001/journey-checkpoint.json";
			const disk = {
				existsSync: vi.fn(() => true),
				readFileSync: vi.fn(() => JSON.stringify(makeCheckpoint())),
			};
			readCheckpoint(disk, path);
			expect(disk.existsSync).toHaveBeenCalledWith(path);
			expect(disk.readFileSync).toHaveBeenCalledWith(path, "utf-8");
		});
	});

	describe("writeCheckpoint", () => {
		it("writes checkpoint data as indented JSON with tabs", () => {
			const data = makeCheckpoint();
			const disk = { writeFileSync: vi.fn() };
			const path = "/vault/.flowti/var/staging/t-001/journey-checkpoint.json";
			writeCheckpoint(disk, path, data);
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				path,
				JSON.stringify(data, null, "\t"),
			);
		});

		it("preserves all checkpoint fields", () => {
			const data = makeCheckpoint({ status: "paused-for-review", currentStep: 3, totalSteps: 8 });
			const disk = { writeFileSync: vi.fn() };
			writeCheckpoint(disk, "/path", data);
			const written = JSON.parse(disk.writeFileSync.mock.calls[0][1] as string);
			expect(written.journeyId).toBe("j-001");
			expect(written.taskId).toBe("t-001");
			expect(written.currentStep).toBe(3);
			expect(written.totalSteps).toBe(8);
			expect(written.status).toBe("paused-for-review");
		});
	});
});
