import { describe, it, expect, vi } from "vitest";
import {
	mockDisk, mockDiskEmpty,
	mockShellPreset, mockShellEmpty,
	mockUiPreset, mockLoggerPreset,
	mockPathsPreset, mockProcPreset,
	mockConfigPreset, mockInputPreset,
	mockMenuPreset, mockClockPreset,
} from "./mock-presets.js";

describe("mock-presets", () => {
	describe("mockDisk", () => {
		it("returns disk object with all methods as vi.fn()", () => {
			const { disk } = mockDisk();
			expect(disk.existsSync).toBeDefined();
			expect(disk.readFileSync).toBeDefined();
			expect(disk.writeFileSync).toBeDefined();
			expect(disk.mkdirSync).toBeDefined();
			expect(disk.readdirSync).toBeDefined();
			expect(disk.copyFileSync).toBeDefined();
			expect(disk.rmSync).toBeDefined();
			expect(disk.unlinkSync).toBeDefined();
			expect(disk.statSync).toBeDefined();
		});

		it("defaults existsSync to false", () => {
			const { disk } = mockDisk();
			expect(disk.existsSync("/any")).toBe(false);
		});

		it("accepts overrides", () => {
			const { disk } = mockDisk({ existsSync: vi.fn(() => true) });
			expect(disk.existsSync("/any")).toBe(true);
		});
	});

	describe("mockDiskEmpty", () => {
		it("returns empty disk object", () => {
			const { disk } = mockDiskEmpty();
			expect(disk).toBeDefined();
		});
	});

	describe("mockShellPreset", () => {
		it("returns shell with all methods", () => {
			const { shell } = mockShellPreset();
			expect(shell.run("test")).toBe(0);
			expect(shell.runSilent("test")).toBe(null);
			expect(shell.check("test")).toBe(true);
			expect(shell.runCapture("test")).toBe("");
			expect(shell.runCaptureStatus("test")).toEqual({ output: "", exitCode: 0 });
		});

		it("accepts overrides", () => {
			const { shell } = mockShellPreset({ run: vi.fn(() => 1) });
			expect(shell.run("test")).toBe(1);
		});
	});

	describe("mockUiPreset", () => {
		it("returns empty ANSI strings", () => {
			const ui = mockUiPreset();
			expect(ui.RESET).toBe("");
			expect(ui.BOLD).toBe("");
			expect(ui.GREEN).toBe("");
			expect(ui.RED).toBe("");
		});
	});

	describe("mockLoggerPreset", () => {
		it("returns log as vi.fn()", () => {
			const { log } = mockLoggerPreset();
			log("test");
			expect(log).toHaveBeenCalledWith("test");
		});
	});

	describe("mockPathsPreset", () => {
		it("joins paths with /", () => {
			const { paths } = mockPathsPreset();
			expect(paths.join("a", "b", "c")).toBe("a/b/c");
		});

		it("resolves paths with /", () => {
			const { paths } = mockPathsPreset();
			expect(paths.resolve("/root", "sub")).toBe("/root/sub");
		});

		it("extracts dirname", () => {
			const { paths } = mockPathsPreset();
			expect(paths.dirname("/a/b/c.txt")).toBe("/a/b");
		});

		it("extracts basename", () => {
			const { paths } = mockPathsPreset();
			expect(paths.basename("/a/b/c.txt")).toBe("c.txt");
		});

		it("extracts extname", () => {
			const { paths } = mockPathsPreset();
			expect(paths.extname("file.json")).toBe(".json");
		});

		it("checks isAbsolute", () => {
			const { paths } = mockPathsPreset();
			expect(paths.isAbsolute("/root")).toBe(true);
			expect(paths.isAbsolute("relative")).toBe(false);
		});
	});

	describe("mockProcPreset", () => {
		it("defaults to empty argv and /mock/cwd", () => {
			const { proc } = mockProcPreset();
			expect(proc.argv()).toEqual([]);
			expect(proc.cwd()).toBe("/mock/cwd");
			expect(proc.env()).toEqual({});
		});

		it("accepts overrides", () => {
			const { proc } = mockProcPreset({ argv: ["build"], cwd: "/my/project" });
			expect(proc.argv()).toEqual(["build"]);
			expect(proc.cwd()).toBe("/my/project");
		});
	});

	describe("mockConfigPreset", () => {
		it("provides default config paths", () => {
			const config = mockConfigPreset();
			expect(config.PLUGIN_ROOT).toBe("/mock/plugin");
			expect(config.VAULT_ROOT).toBe("/mock/vault");
		});

		it("accepts overrides", () => {
			const config = mockConfigPreset({ VAULT_ROOT: "/custom" });
			expect(config.VAULT_ROOT).toBe("/custom");
		});
	});

	describe("mockInputPreset", () => {
		it("returns input with ask, confirm, select", () => {
			const { input } = mockInputPreset();
			expect(input.ask).toBeDefined();
			expect(input.confirm).toBeDefined();
			expect(input.select).toBeDefined();
		});
	});

	describe("mockMenuPreset", () => {
		it("returns runMenu as vi.fn()", () => {
			const { runMenu } = mockMenuPreset();
			expect(runMenu).toBeDefined();
		});
	});

	describe("mockClockPreset", () => {
		it("returns fixed clock values", () => {
			const { clock } = mockClockPreset("2025-01-01T00:00:00.000Z");
			expect(clock.iso()).toBe("2025-01-01T00:00:00.000Z");
			expect(clock.now().toISOString()).toBe("2025-01-01T00:00:00.000Z");
			expect(clock.ms()).toBe(new Date("2025-01-01T00:00:00.000Z").getTime());
		});

		it("returns safe ISO with dashes", () => {
			const { clock } = mockClockPreset("2025-01-01T10:30:00.000Z");
			expect(clock.safeIso()).toBe("2025-01-01T10-30-00.000Z");
		});
	});
});
