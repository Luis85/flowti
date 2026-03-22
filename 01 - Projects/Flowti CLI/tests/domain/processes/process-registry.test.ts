vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/proc.js", () => ({ pidOps: {} }));

import { describe, it, expect, vi } from "vitest";
import { registerProcess, getProcess, unregisterProcess, listProcesses, killProcess } from "../../../src/domain/processes/process-registry.js";
import type { ProcessDeps } from "../../../src/infrastructure/deps.js";
import type { ProcessEntry } from "../../../src/domain/processes/process-registry.js";

function createMockDeps(overrides: Partial<ProcessDeps> = {}): ProcessDeps {
	return {
		disk: {
			writeFileSync: vi.fn(),
			readFileSync: vi.fn(),
			existsSync: vi.fn().mockReturnValue(false),
			mkdirSync: vi.fn(),
			unlinkSync: vi.fn(),
			renameSync: vi.fn(),
			readdirSync: vi.fn().mockReturnValue([]),
			statSync: vi.fn(),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
		} as unknown as ProcessDeps["disk"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
		} as unknown as ProcessDeps["paths"],
		clock: {
			iso: () => "2026-03-22T12:00:00.000Z",
		} as unknown as ProcessDeps["clock"],
		pidOps: {
			isPidAlive: vi.fn().mockReturnValue(true),
			isPortListening: vi.fn().mockResolvedValue(false),
			killPid: vi.fn().mockReturnValue(true),
		} as unknown as ProcessDeps["pidOps"],
		...overrides,
	};
}

const ENTRY: ProcessEntry = {
	type: "storybook",
	name: "MyProject",
	pid: 1234,
	port: 6006,
	url: "http://localhost:6006",
	startedAt: "2026-03-22T12:00:00.000Z",
};

describe("process-registry", () => {
	describe("registerProcess", () => {
		it("writes entry to JSON file via atomic rename", () => {
			const deps = createMockDeps();
			registerProcess(deps, ENTRY);

			expect(deps.disk.mkdirSync).toHaveBeenCalled();
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("storybook-MyProject.json.tmp"),
				expect.stringContaining('"pid":1234'),
				"utf-8",
			);
			expect(deps.disk.renameSync).toHaveBeenCalledWith(
				expect.stringContaining(".tmp"),
				expect.stringContaining("storybook-MyProject.json"),
			);
		});
	});

	describe("getProcess", () => {
		it("returns null when no entry file exists", () => {
			const deps = createMockDeps();
			expect(getProcess(deps, "storybook", "MyProject")).toBeNull();
		});

		it("returns entry when file exists and PID is alive", () => {
			const deps = createMockDeps();
			(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(ENTRY));

			const result = getProcess(deps, "storybook", "MyProject");
			expect(result).toEqual(ENTRY);
			expect(deps.pidOps.isPidAlive).toHaveBeenCalledWith(1234);
		});

		it("auto-cleans stale entry when PID is dead", () => {
			const deps = createMockDeps();
			(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(ENTRY));
			(deps.pidOps.isPidAlive as ReturnType<typeof vi.fn>).mockReturnValue(false);

			const result = getProcess(deps, "storybook", "MyProject");
			expect(result).toBeNull();
			expect(deps.disk.unlinkSync).toHaveBeenCalled();
		});
	});

	describe("unregisterProcess", () => {
		it("deletes the entry file", () => {
			const deps = createMockDeps();
			unregisterProcess(deps, "storybook", "MyProject");
			expect(deps.disk.unlinkSync).toHaveBeenCalledWith(
				expect.stringContaining("storybook-MyProject.json"),
			);
		});

		it("does not throw if file does not exist", () => {
			const deps = createMockDeps();
			(deps.disk.unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("ENOENT"); });
			expect(() => unregisterProcess(deps, "storybook", "Missing")).not.toThrow();
		});
	});

	describe("listProcesses", () => {
		it("returns empty array when directory has no entries", () => {
			const deps = createMockDeps();
			expect(listProcesses(deps)).toEqual([]);
		});

		it("returns live entries and cleans stale ones", () => {
			const alive: ProcessEntry = { ...ENTRY, pid: 100 };
			const dead: ProcessEntry = { ...ENTRY, pid: 200, name: "Dead" };
			const deps = createMockDeps();
			(deps.disk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(["storybook-MyProject.json", "storybook-Dead.json"]);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>)
				.mockReturnValueOnce(JSON.stringify(alive))
				.mockReturnValueOnce(JSON.stringify(dead));
			(deps.pidOps.isPidAlive as ReturnType<typeof vi.fn>)
				.mockImplementation((pid: number) => pid === 100);

			const result = listProcesses(deps);
			expect(result).toHaveLength(1);
			expect(result[0].pid).toBe(100);
			expect(deps.disk.unlinkSync).toHaveBeenCalled();
		});

		it("filters by type when specified", () => {
			const sb: ProcessEntry = { ...ENTRY, type: "storybook" };
			const llm: ProcessEntry = { ...ENTRY, type: "llm", name: "Atlas" };
			const deps = createMockDeps();
			(deps.disk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(["storybook-MyProject.json", "llm-Atlas.json"]);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>)
				.mockReturnValueOnce(JSON.stringify(sb))
				.mockReturnValueOnce(JSON.stringify(llm));

			expect(listProcesses(deps, "storybook")).toHaveLength(1);
		});
	});

	describe("killProcess", () => {
		it("kills the process and unregisters it", () => {
			const deps = createMockDeps();
			(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(ENTRY));

			const killed = killProcess(deps, "storybook", "MyProject");
			expect(killed).toBe(true);
			expect(deps.pidOps.killPid).toHaveBeenCalledWith(1234);
			expect(deps.disk.unlinkSync).toHaveBeenCalled();
		});

		it("returns false when no entry exists", () => {
			const deps = createMockDeps();
			expect(killProcess(deps, "storybook", "Missing")).toBe(false);
		});
	});
});
