import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import {
	readProgress,
	writeProgress,
	resetProgress,
	createInitialProgress,
} from "../../../src/domain/onboarding/onboarding-store.js";

import type { TourProgress } from "../../../src/domain/onboarding/onboarding-types.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
	mkdirSync: vi.fn(),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const mockClock = {
	iso: () => "2026-03-15T10:00:00.000Z",
};

const deps = { disk: mockDisk as unknown as Parameters<typeof readProgress>[1]["disk"], paths: mockPaths as unknown as Parameters<typeof readProgress>[1]["paths"], clock: mockClock as unknown as Parameters<typeof createInitialProgress>[1]["clock"] };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createInitialProgress", () => {
	it("creates progress at step 0 with empty context", () => {
		const progress = createInitialProgress("project-manager", deps);
		expect(progress).toEqual({
			tourId: "project-manager",
			currentStepIndex: 0,
			completedSteps: [],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		});
	});
});

describe("readProgress", () => {
	it("returns null when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(readProgress("/vault", deps)).toBeNull();
	});

	it("returns parsed progress when file exists", () => {
		const stored: TourProgress = {
			tourId: "project-manager",
			currentStepIndex: 3,
			completedSteps: ["welcome", "tour-select", "pm-intro"],
			context: { projectName: "My Project" },
			startedAt: "2026-03-15T10:00:00.000Z",
		};
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify(stored));
		const result = readProgress("/vault", deps);
		expect(result).toEqual(stored);
	});
});

describe("writeProgress", () => {
	it("writes progress to the correct path", () => {
		const progress: TourProgress = {
			tourId: "project-manager",
			currentStepIndex: 2,
			completedSteps: ["welcome", "tour-select"],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		};
		writeProgress("/vault", progress, deps);
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith(
			"/vault/.flowti/var",
			{ recursive: true },
		);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/vault/.flowti/var/onboarding-progress.json",
			JSON.stringify(progress, null, "\t"),
			"utf-8",
		);
	});
});

describe("resetProgress", () => {
	it("removes progress file if it exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		resetProgress("/vault", deps);
		expect(mockDisk.unlinkSync).toHaveBeenCalledWith(
			"/vault/.flowti/var/onboarding-progress.json",
		);
	});

	it("does nothing if progress file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		resetProgress("/vault", deps);
		expect(mockDisk.unlinkSync).not.toHaveBeenCalled();
	});
});
