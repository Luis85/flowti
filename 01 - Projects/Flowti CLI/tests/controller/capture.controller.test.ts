/**
 * capture.controller.test.ts — Tests for the capture controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/domain/capture/capture.js", () => ({
	createCaptureFile: vi.fn(),
	searchCaptures: vi.fn(() => []),
	importCaptureItems: vi.fn(() => ({ created: 2, skipped: 1 })),
	parseTags: vi.fn((raw: string | boolean | undefined) => {
		if (!raw || typeof raw !== "string") return [];
		return raw.split(",").map((t: string) => t.trim()).filter(Boolean);
	}),
	NOTE_TYPES: ["Task", "Bug", "Note", "Documentation", "Idea"],
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
	},
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-10T00:00:00.000Z", now: () => new Date("2026-03-10"), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/test", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		isAbsolute: (p: string) => p.startsWith("/"),
		relative: (_from: string, to: string) => to,
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../src/ui/displays/capture-display.js", () => ({
	renderSearchResults: vi.fn(),
	renderImportResult: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

import { commands } from "../../src/controller/capture.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { createCaptureFile, searchCaptures, importCaptureItems } from "../../src/domain/capture/capture.js";
import { log } from "../../src/infrastructure/logger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";

const logMock = log as ReturnType<typeof vi.fn>;

describe("capture.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell: {} as never, paths, clock, proc,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
		});
	});

	describe("capture:idea", () => {
		it("calls createCaptureFile when --text is provided", () => {
			commands["capture:idea"]({ text: "My great idea" }, [], "capture:idea");

			expect(createCaptureFile).toHaveBeenCalledOnce();
			expect(createCaptureFile).toHaveBeenCalledWith(
				expect.any(String), expect.any(Object), "Idea", "My great idea", "My great idea", [],
			);
		});

		it("passes parsed tags to createCaptureFile", () => {
			commands["capture:idea"](
				{ text: "Tagged idea", tags: "urgent,review" }, [], "capture:idea",
			);

			expect(createCaptureFile).toHaveBeenCalledOnce();
			expect(createCaptureFile).toHaveBeenCalledWith(
				expect.any(String), expect.any(Object), "Idea", "Tagged idea", "Tagged idea", ["urgent", "review"],
			);
		});

		it("truncates title to 60 chars for long text", () => {
			const longText = "A".repeat(80);
			commands["capture:idea"]({ text: longText }, [], "capture:idea");

			expect(createCaptureFile).toHaveBeenCalledOnce();
			const titleArg = (createCaptureFile as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
			expect(titleArg.length).toBeLessThanOrEqual(60);
		});

		it("returns error when --text is missing", () => {
			commands["capture:idea"]({ format: "json" }, [], "capture:idea");

			expect(createCaptureFile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--text");
		});

		it("returns error when --text is boolean", () => {
			commands["capture:idea"](
				{ text: true, format: "json" }, [], "capture:idea",
			);

			expect(createCaptureFile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
		});
	});

	describe("capture:note", () => {
		it("calls createCaptureFile with normalized type", () => {
			commands["capture:note"](
				{ type: "task", title: "Do this" }, [], "capture:note",
			);

			expect(createCaptureFile).toHaveBeenCalledOnce();
			expect(createCaptureFile).toHaveBeenCalledWith(expect.any(String), expect.any(Object), "Task", "Do this", "", []);
		});

		it("returns error when --type is missing", () => {
			commands["capture:note"](
				{ title: "Something", format: "json" }, [], "capture:note",
			);

			expect(createCaptureFile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("--type");
		});

		it("returns error when --title is missing", () => {
			commands["capture:note"](
				{ type: "task", format: "json" }, [], "capture:note",
			);

			expect(createCaptureFile).not.toHaveBeenCalled();
		});

		it("returns error for invalid note type", () => {
			commands["capture:note"](
				{ type: "invalid", title: "Test", format: "json" }, [], "capture:note",
			);

			expect(createCaptureFile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("Invalid type");
		});
	});

	describe("capture:search", () => {
		it("calls searchCaptures with query", () => {
			(searchCaptures as ReturnType<typeof vi.fn>).mockReturnValue([
				{ file: "idea-1.md", title: "Test idea", type: "Idea" },
			]);

			commands["capture:search"](
				{ query: "test", format: "json" }, [], "capture:search",
			);

			expect(searchCaptures).toHaveBeenCalledOnce();
			expect(searchCaptures).toHaveBeenCalledWith(expect.any(String), expect.any(Function), expect.any(Object), "test", undefined, undefined);
		});

		it("passes type and tag filters", () => {
			commands["capture:search"](
				{ query: "test", type: "idea", tag: "urgent" }, [], "capture:search",
			);

			expect(searchCaptures).toHaveBeenCalledWith(expect.any(String), expect.any(Function), expect.any(Object), "test", "Idea", "urgent");
		});

		it("returns error when --query is missing", () => {
			commands["capture:search"]({ format: "json" }, [], "capture:search");

			expect(searchCaptures).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("--query");
		});

		it("returns search results model as JSON", () => {
			(searchCaptures as ReturnType<typeof vi.fn>).mockReturnValue([
				{ file: "idea-1.md", title: "Found", type: "Idea" },
			]);

			commands["capture:search"](
				{ query: "found", format: "json" }, [], "capture:search",
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("query", "found");
			expect(output).toHaveProperty("results");
			expect(output.results).toHaveLength(1);
		});
	});

	describe("capture:import", () => {
		it("calls importCaptureItems with absolute path", () => {
			commands["capture:import"](
				{ file: "/data/items.json" }, [], "capture:import",
			);

			expect(importCaptureItems).toHaveBeenCalledOnce();
			expect(importCaptureItems).toHaveBeenCalledWith(expect.any(Function), expect.any(Object), "/data/items.json");
		});

		it("returns error when --file is missing", () => {
			commands["capture:import"]({ format: "json" }, [], "capture:import");

			expect(importCaptureItems).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("--file");
		});

		it("returns import result model as JSON", () => {
			commands["capture:import"](
				{ file: "/data/items.json", format: "json" }, [], "capture:import",
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("created", 2);
			expect(output).toHaveProperty("skipped", 1);
		});
	});
});
