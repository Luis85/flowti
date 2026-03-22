import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlanWatcher } from "../../src/infrastructure/plan-watcher.js";
import type { IFileSystem } from "../../src/infrastructure/types.js";
import type { WatchFn } from "../../src/infrastructure/sitemap-watcher.js";

function mockFs(content = "initial content"): IFileSystem {
	return {
		readFileSync: vi.fn(() => content) as unknown as IFileSystem["readFileSync"],
		writeFileSync: vi.fn(),
		existsSync: vi.fn(() => true),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []) as any,
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
		statSync: vi.fn() as any,
		renameSync: vi.fn(),
	};
}

function mockWatchFn(): { watchFn: WatchFn; trigger: () => void; closed: boolean } {
	let callback: (() => void) | null = null;
	const state = { closed: false };
	const watchFn: WatchFn = (_path, onChange) => {
		callback = onChange;
		return { close: () => { state.closed = true; } };
	};
	return {
		watchFn,
		get closed() { return state.closed; },
		trigger: () => callback?.(),
	};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("PlanWatcher", () => {
	it("starts and stops watching", () => {
		const fs = mockFs();
		const mock = mockWatchFn();
		const watcher = new PlanWatcher("/plan.md", fs, mock.watchFn);
		expect(watcher.active).toBe(false);
		watcher.start(vi.fn());
		expect(watcher.active).toBe(true);
		watcher.stop();
		expect(watcher.active).toBe(false);
		expect(mock.closed).toBe(true);
	});

	it("does not start without watchFn", () => {
		const watcher = new PlanWatcher("/plan.md", mockFs());
		watcher.start(vi.fn());
		expect(watcher.active).toBe(false);
	});

	it("does not start twice", () => {
		const fs = mockFs();
		const startCalls: number[] = [];
		const watchFn: WatchFn = (_path, _onChange) => {
			startCalls.push(1);
			return { close: vi.fn() };
		};
		const watcher = new PlanWatcher("/plan.md", fs, watchFn);
		watcher.start(vi.fn());
		watcher.start(vi.fn());
		expect(startCalls).toHaveLength(1);
	});

	it("computes initial hash from file content", () => {
		const watcher = new PlanWatcher("/plan.md", mockFs("hello"));
		expect(watcher.hash).toBeTruthy();
		expect(watcher.hash.length).toBe(64); // SHA-256 hex
	});

	it("returns empty hash when file does not exist", () => {
		const fs = mockFs();
		(fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("ENOENT"); });
		const watcher = new PlanWatcher("/plan.md", fs);
		expect(watcher.hash).toBe("");
	});

	it("detects content changes via checkForChanges", () => {
		const fs = mockFs("version1");
		const watcher = new PlanWatcher("/plan.md", fs);
		expect(watcher.checkForChanges()).toBe(false); // same content
		(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("version2");
		expect(watcher.checkForChanges()).toBe(true);
		expect(watcher.checkForChanges()).toBe(false); // hash updated
	});

	it("calls onChange after debounce when content changes", () => {
		const fs = mockFs("v1");
		const { watchFn, trigger } = mockWatchFn();
		const onChange = vi.fn();
		const watcher = new PlanWatcher("/plan.md", fs, watchFn, 100);
		watcher.start(onChange);

		(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("v2");
		trigger();
		expect(onChange).not.toHaveBeenCalled(); // debounce pending
		vi.advanceTimersByTime(100);
		expect(onChange).toHaveBeenCalledTimes(1);

		watcher.stop();
	});

	it("does not call onChange when content unchanged (spurious event)", () => {
		const fs = mockFs("same");
		const { watchFn, trigger } = mockWatchFn();
		const onChange = vi.fn();
		const watcher = new PlanWatcher("/plan.md", fs, watchFn, 50);
		watcher.start(onChange);

		trigger();
		vi.advanceTimersByTime(50);
		expect(onChange).not.toHaveBeenCalled();

		watcher.stop();
	});

	it("debounces rapid successive events", () => {
		const fs = mockFs("v1");
		const { watchFn, trigger } = mockWatchFn();
		const onChange = vi.fn();
		const watcher = new PlanWatcher("/plan.md", fs, watchFn, 200);
		watcher.start(onChange);

		(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("v2");
		trigger();
		vi.advanceTimersByTime(100);
		trigger(); // resets debounce
		vi.advanceTimersByTime(100);
		trigger(); // resets debounce again
		vi.advanceTimersByTime(200);
		expect(onChange).toHaveBeenCalledTimes(1); // only once after final debounce

		watcher.stop();
	});

	it("clears debounce timer on stop", () => {
		const fs = mockFs("v1");
		const { watchFn, trigger } = mockWatchFn();
		const onChange = vi.fn();
		const watcher = new PlanWatcher("/plan.md", fs, watchFn, 200);
		watcher.start(onChange);

		(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("v2");
		trigger();
		watcher.stop(); // should clear pending timer
		vi.advanceTimersByTime(200);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("handles watch function throwing", () => {
		const fs = mockFs();
		const throwingWatch: WatchFn = () => { throw new Error("EPERM"); };
		const watcher = new PlanWatcher("/plan.md", fs, throwingWatch);
		watcher.start(vi.fn()); // should not throw
		expect(watcher.active).toBe(false);
	});
});
