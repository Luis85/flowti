/**
 * workspace-provisioner.test.ts — Tests for WorkspaceProvisioner (worktree-first, clone fallback).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createWorkspaceProvisioner, type IWorkspaceProvisioner } from "../../src/infrastructure/workspace-provisioner.js";
import type { IShell, IFileSystem, IPaths } from "../../src/infrastructure/types.js";

function createMockShell(responses: Record<string, { stdout: string; exitCode: number }> = {}): IShell {
	return {
		runCaptureDetailed: vi.fn((cmd: string) => {
			for (const [pattern, result] of Object.entries(responses)) {
				if (cmd.includes(pattern)) return { stdout: result.stdout, stderr: "", exitCode: result.exitCode };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		}),
	} as unknown as IShell;
}

function createMockDisk(): IFileSystem {
	return {
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
		readFileSync: vi.fn(() => ""),
		copyFileSync: vi.fn(),
	} as unknown as IFileSystem;
}

function createMockPaths(): IPaths {
	return {
		join: (...parts: string[]) => parts.join("/"),
		resolve: (p: string) => p,
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
	} as unknown as IPaths;
}

describe("WorkspaceProvisioner", () => {
	let provisioner: IWorkspaceProvisioner;
	let shell: IShell;
	let disk: IFileSystem;
	let paths: IPaths;

	beforeEach(() => {
		shell = createMockShell({
			"git worktree list": { stdout: "C:/Projects/flowti  abc1234 [master]\n", exitCode: 0 },
			"git worktree add": { stdout: "", exitCode: 0 },
			"git rev-parse": { stdout: "abc1234def5678\n", exitCode: 0 },
		});
		disk = createMockDisk();
		paths = createMockPaths();
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as never, "/vault");
	});

	it("provisions via worktree when branch is not checked out", () => {
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.method).toBe("worktree");
		expect(shell.runCaptureDetailed).toHaveBeenCalledWith(
			expect.stringContaining("git worktree add"),
			expect.anything(),
		);
	});

	it("falls back to clone when worktree add fails", () => {
		shell = createMockShell({
			"git worktree list": { stdout: "C:/Projects/flowti  abc1234 [master]\n", exitCode: 0 },
			"git worktree add": { stdout: "", exitCode: 128 },
			"git clone": { stdout: "", exitCode: 0 },
			"git rev-parse": { stdout: "abc1234\n", exitCode: 0 },
			"git checkout": { stdout: "", exitCode: 0 },
		});
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as never, "/vault");
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.method).toBe("clone");
	});

	it("falls back to clone when branch already checked out", () => {
		shell = createMockShell({
			"git worktree list": {
				stdout: "C:/Projects/flowti  abc1234 [master]\nC:/other  def5678 [agent/bob/auth]\n",
				exitCode: 0,
			},
			"git clone": { stdout: "", exitCode: 0 },
			"git rev-parse": { stdout: "abc1234\n", exitCode: 0 },
			"git checkout": { stdout: "", exitCode: 0 },
		});
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as never, "/vault");
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.method).toBe("clone");
	});

	it("creates baseDir if it does not exist", () => {
		provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(disk.mkdirSync).toHaveBeenCalled();
	});

	it("quotes paths with spaces", () => {
		provisioner.provision("bob", "agent/bob/auth", "master", "/my agents/ws-bob");
		const call = (shell.runCaptureDetailed as ReturnType<typeof vi.fn>).mock.calls.find(
			(c: string[]) => c[0].includes("worktree add"),
		);
		if (call) expect(call[0]).toContain('"');
	});

	it("dispose removes worktree via git command", () => {
		provisioner.dispose("/agents/ws-bob", "worktree");
		expect(shell.runCaptureDetailed).toHaveBeenCalledWith(
			expect.stringContaining("git worktree remove"),
			expect.anything(),
		);
	});

	it("dispose removes clone via rm -rf", () => {
		provisioner.dispose("/agents/ws-bob", "clone");
		expect(shell.runCaptureDetailed).toHaveBeenCalledWith(
			expect.stringContaining("rm -rf"),
		);
	});

	it("returns correct branch in result", () => {
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.branch).toBe("agent/bob/auth");
	});

	it("returns correct path in result", () => {
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.path).toBe("/agents/ws-bob");
	});

	it("throws when clone fails", () => {
		shell = createMockShell({
			"git worktree list": {
				stdout: "C:/Projects/flowti  abc1234 [master]\nC:/other  def5678 [agent/bob/auth]\n",
				exitCode: 0,
			},
			"git clone": { stdout: "", exitCode: 128 },
			"git rev-parse": { stdout: "abc1234\n", exitCode: 0 },
		});
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as never, "/vault");
		expect(() => provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob")).toThrow("Clone failed");
	});
});
