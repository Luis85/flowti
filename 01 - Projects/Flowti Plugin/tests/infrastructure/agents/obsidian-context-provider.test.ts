import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObsidianContextProvider } from "../../../src/infrastructure/agents/obsidian-context-provider.js";

function mockWorkspace() {
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	return {
		getActiveFile: vi.fn(() => null),
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
			const set = listeners.get(event) ?? new Set();
			set.add(cb);
			listeners.set(event, set);
			return { id: event, fn: cb };
		}),
		offref: vi.fn(),
		_fire(event: string, ...args: unknown[]) {
			for (const cb of listeners.get(event) ?? []) cb(...args);
		},
		_listeners: listeners,
	};
}

function mockVault() {
	return {
		cachedRead: vi.fn(async () => "file content"),
		on: vi.fn(() => ({ id: "modify", fn: () => {} })),
		offref: vi.fn(),
	};
}

describe("ObsidianContextProvider", () => {
	let workspace: ReturnType<typeof mockWorkspace>;
	let vault: ReturnType<typeof mockVault>;

	beforeEach(() => {
		workspace = mockWorkspace();
		vault = mockVault();
	});

	it("returns null when no active file", () => {
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		expect(provider.getActiveFileContext()).toBeNull();
	});

	it("returns file context for active file", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "notes/test.md" });
		vault.cachedRead.mockResolvedValue("hello world");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		await provider.refreshContext();
		const ctx = provider.getActiveFileContext();
		expect(ctx).not.toBeNull();
		expect(ctx!.path).toBe("notes/test.md");
		expect(ctx!.content).toBe("hello world");
		expect(ctx!.contentHash).toBeTruthy();
	});

	it("computes diff between previous and current content", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "test.md" });
		vault.cachedRead.mockResolvedValueOnce("line1\nline2");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		await provider.refreshContext();
		const hash1 = provider.getActiveFileContext()!.contentHash;

		vault.cachedRead.mockResolvedValueOnce("line1\nline2\nline3");
		await provider.refreshContext();
		const diff = provider.getDiff(hash1);
		expect(diff).not.toBeNull();
		expect(diff!.diff).toContain("line3");
		expect(diff!.previousHash).toBe(hash1);
	});

	it("getDiff returns null when hash matches current", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "test.md" });
		vault.cachedRead.mockResolvedValue("same content");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		await provider.refreshContext();
		const hash = provider.getActiveFileContext()!.contentHash;
		expect(provider.getDiff(hash)).toBeNull();
	});

	it("dispose cleans up event refs", () => {
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		provider.dispose();
		expect(workspace.offref).toHaveBeenCalled();
	});

	it("onFileChanged registers subscriber", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "test.md" });
		vault.cachedRead.mockResolvedValue("content");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		const changes: unknown[] = [];
		provider.onFileChanged((ctx) => changes.push(ctx));
		await provider.refreshContext();
		expect(changes).toHaveLength(1);
	});
});
