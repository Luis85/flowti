import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FSWatcher } from "node:fs";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockWatchListener: { current: ((event: string, filename: string) => void) | null } = { current: null };
const mockWatcherClose = vi.fn();
const mockWatcherOn = vi.fn();

const mockFsWatcher: FSWatcher = {
	close: mockWatcherClose,
	on: mockWatcherOn,
	once: vi.fn(),
	emit: vi.fn(),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	off: vi.fn(),
	removeAllListeners: vi.fn(),
	setMaxListeners: vi.fn(),
	getMaxListeners: vi.fn(),
	listeners: vi.fn(),
	rawListeners: vi.fn(),
	listenerCount: vi.fn(),
	prependListener: vi.fn(),
	prependOnceListener: vi.fn(),
	eventNames: vi.fn(),
	ref: vi.fn().mockReturnThis(),
	unref: vi.fn().mockReturnThis(),
} as unknown as FSWatcher;

vi.mock("node:fs", () => ({
	watch: vi.fn((_path: string, cb: (event: string, filename: string) => void) => {
		mockWatchListener.current = cb;
		return mockFsWatcher;
	}),
	readFileSync: vi.fn(),
	statSync: vi.fn(),
	existsSync: vi.fn(),
	openSync: vi.fn(),
	readSync: vi.fn(),
	closeSync: vi.fn(),
}));

vi.mock("node:crypto", () => ({
	createHash: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { watchJsonFile, tailJsonlFile } from "../../../src/infrastructure/agents/file-watcher.js";
import { watch, readFileSync, statSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function setupHash(hex: string): void {
	const hashObj = { update: vi.fn().mockReturnThis(), digest: vi.fn().mockReturnValue(hex) };
	vi.mocked(createHash).mockReturnValue(hashObj as unknown as ReturnType<typeof createHash>);
}

function triggerWatch(): void {
	if (mockWatchListener.current) {
		mockWatchListener.current("change", "file.json");
	}
}

/* ------------------------------------------------------------------ */
/*  Tests: watchJsonFile                                               */
/* ------------------------------------------------------------------ */

describe("watchJsonFile", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockWatchListener.current = null;
		// Restore watch implementation (may have been overridden by prior tests)
		vi.mocked(watch).mockImplementation((_path: unknown, cb: unknown) => {
			mockWatchListener.current = cb as (event: string, filename: string) => void;
			return mockFsWatcher;
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("calls onChange with parsed JSON on content change", () => {
		const data = { name: "test", value: 42 };
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(data));
		setupHash("hash-1");

		const onChange = vi.fn();
		watchJsonFile("/tmp/test.json", onChange, 100);

		triggerWatch();
		vi.advanceTimersByTime(100);

		expect(onChange).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledWith(data);
	});

	it("does NOT call onChange when hash is same (duplicate event)", () => {
		const data = { x: 1 };
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(data));
		setupHash("same-hash");

		const onChange = vi.fn();
		watchJsonFile("/tmp/test.json", onChange, 50);

		// First change — should fire
		triggerWatch();
		vi.advanceTimersByTime(50);
		expect(onChange).toHaveBeenCalledOnce();

		// Second change with same hash — should NOT fire
		triggerWatch();
		vi.advanceTimersByTime(50);
		expect(onChange).toHaveBeenCalledOnce();
	});

	it("debounces rapid changes", () => {
		const data = { debounced: true };
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(data));
		setupHash("hash-debounce");

		const onChange = vi.fn();
		watchJsonFile("/tmp/test.json", onChange, 200);

		// Fire 5 rapid events
		triggerWatch();
		vi.advanceTimersByTime(50);
		triggerWatch();
		vi.advanceTimersByTime(50);
		triggerWatch();
		vi.advanceTimersByTime(50);
		triggerWatch();
		vi.advanceTimersByTime(50);
		triggerWatch();

		// Not yet fired — timer not elapsed since last trigger
		expect(onChange).not.toHaveBeenCalled();

		// Now let the debounce complete
		vi.advanceTimersByTime(200);
		expect(onChange).toHaveBeenCalledOnce();
	});

	it("close() stops watcher and clears timer", () => {
		vi.mocked(existsSync).mockReturnValue(true);
		setupHash("close-hash");

		const onChange = vi.fn();
		const watcher = watchJsonFile("/tmp/test.json", onChange, 100);

		triggerWatch();
		// Close before debounce fires
		watcher.close();

		vi.advanceTimersByTime(200);
		expect(onChange).not.toHaveBeenCalled();
		expect(mockWatcherClose).toHaveBeenCalled();
	});

	it("handles missing file without error", () => {
		vi.mocked(watch).mockImplementation(() => {
			throw new Error("ENOENT");
		});

		const onChange = vi.fn();
		// Should not throw
		const watcher = watchJsonFile("/tmp/missing.json", onChange);
		expect(watcher).toBeDefined();
		expect(watcher.close).toBeTypeOf("function");
		watcher.close();
	});

	it("handles invalid JSON gracefully", () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue("not valid json {{{");
		setupHash("bad-json-hash");

		const onChange = vi.fn();
		watchJsonFile("/tmp/bad.json", onChange, 50);

		triggerWatch();
		vi.advanceTimersByTime(50);

		// createHash update was called but JSON.parse failed — no callback
		expect(onChange).not.toHaveBeenCalled();
	});
});

/* ------------------------------------------------------------------ */
/*  Tests: tailJsonlFile                                               */
/* ------------------------------------------------------------------ */

describe("tailJsonlFile", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockWatchListener.current = null;
		// Restore watch implementation (may have been overridden by prior tests)
		vi.mocked(watch).mockImplementation((_path: unknown, cb: unknown) => {
			mockWatchListener.current = cb as (event: string, filename: string) => void;
			return mockFsWatcher;
		});
		// Default: file exists with initial size 0
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(statSync).mockReturnValue({ size: 0 } as ReturnType<typeof statSync>);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("reads new lines appended after initial offset", () => {
		// Initial size is 0
		const onLine = vi.fn();
		const watcher = tailJsonlFile("/tmp/log.jsonl", onLine);

		// Simulate appending two lines
		const line1 = JSON.stringify({ event: "a" });
		const line2 = JSON.stringify({ event: "b" });
		const chunk = line1 + "\n" + line2 + "\n";
		const chunkBuffer = Buffer.from(chunk, "utf-8");

		vi.mocked(statSync).mockReturnValue({ size: chunkBuffer.length } as ReturnType<typeof statSync>);
		vi.mocked(openSync).mockReturnValue(10);
		vi.mocked(readSync).mockImplementation((_fd, buf: Buffer) => {
			chunkBuffer.copy(buf);
			return chunkBuffer.length;
		});

		triggerWatch();

		expect(onLine).toHaveBeenCalledTimes(2);
		expect(onLine).toHaveBeenCalledWith({ event: "a" });
		expect(onLine).toHaveBeenCalledWith({ event: "b" });

		watcher.close();
	});

	it("buffers partial lines (no trailing newline)", () => {
		const onLine = vi.fn();
		const watcher = tailJsonlFile("/tmp/log.jsonl", onLine);

		// First chunk: one complete line + partial second line
		const part1 = '{"complete":true}\n{"partial":';
		const buf1 = Buffer.from(part1, "utf-8");

		vi.mocked(statSync).mockReturnValue({ size: buf1.length } as ReturnType<typeof statSync>);
		vi.mocked(openSync).mockReturnValue(10);
		vi.mocked(readSync).mockImplementation((_fd, buf: Buffer) => {
			buf1.copy(buf);
			return buf1.length;
		});

		triggerWatch();
		expect(onLine).toHaveBeenCalledOnce();
		expect(onLine).toHaveBeenCalledWith({ complete: true });

		// Second chunk completes the partial line
		const part2 = 'true}\n';
		const buf2 = Buffer.from(part2, "utf-8");
		const totalSize = buf1.length + buf2.length;

		vi.mocked(statSync).mockReturnValue({ size: totalSize } as ReturnType<typeof statSync>);
		vi.mocked(readSync).mockImplementation((_fd, buf: Buffer) => {
			buf2.copy(buf);
			return buf2.length;
		});

		triggerWatch();
		expect(onLine).toHaveBeenCalledTimes(2);
		expect(onLine).toHaveBeenCalledWith({ partial: true });

		watcher.close();
	});

	it("handles missing file gracefully", () => {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(watch).mockImplementation(() => {
			throw new Error("ENOENT");
		});

		const onLine = vi.fn();
		// Should not throw
		const watcher = tailJsonlFile("/tmp/missing.jsonl", onLine);
		expect(watcher).toBeDefined();
		expect(watcher.close).toBeTypeOf("function");
		watcher.close();
	});

	it("close() stops watcher and polling interval", () => {
		const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

		const onLine = vi.fn();
		const watcher = tailJsonlFile("/tmp/log.jsonl", onLine);
		watcher.close();

		expect(mockWatcherClose).toHaveBeenCalled();
		expect(clearIntervalSpy).toHaveBeenCalled();

		clearIntervalSpy.mockRestore();
	});

	it("parses each line as JSON and calls callback", () => {
		const onLine = vi.fn();
		const watcher = tailJsonlFile("/tmp/log.jsonl", onLine);

		const lines = [
			JSON.stringify({ type: "start", ts: 1 }),
			JSON.stringify({ type: "end", ts: 2 }),
			"not-json",
			JSON.stringify({ type: "info", ts: 3 }),
		];
		const chunk = lines.join("\n") + "\n";
		const buf = Buffer.from(chunk, "utf-8");

		vi.mocked(statSync).mockReturnValue({ size: buf.length } as ReturnType<typeof statSync>);
		vi.mocked(openSync).mockReturnValue(10);
		vi.mocked(readSync).mockImplementation((_fd, b: Buffer) => {
			buf.copy(b);
			return buf.length;
		});

		triggerWatch();

		// 3 valid JSON lines, 1 invalid skipped
		expect(onLine).toHaveBeenCalledTimes(3);
		expect(onLine).toHaveBeenCalledWith({ type: "start", ts: 1 });
		expect(onLine).toHaveBeenCalledWith({ type: "end", ts: 2 });
		expect(onLine).toHaveBeenCalledWith({ type: "info", ts: 3 });

		watcher.close();
	});

	it("polling interval triggers readNewBytes", () => {
		const onLine = vi.fn();
		const watcher = tailJsonlFile("/tmp/log.jsonl", onLine);

		const line = JSON.stringify({ polled: true }) + "\n";
		const buf = Buffer.from(line, "utf-8");

		vi.mocked(statSync).mockReturnValue({ size: buf.length } as ReturnType<typeof statSync>);
		vi.mocked(openSync).mockReturnValue(10);
		vi.mocked(readSync).mockImplementation((_fd, b: Buffer) => {
			buf.copy(b);
			return buf.length;
		});

		// Advance timer by 500ms to trigger the poll interval
		vi.advanceTimersByTime(500);

		expect(onLine).toHaveBeenCalledOnce();
		expect(onLine).toHaveBeenCalledWith({ polled: true });

		watcher.close();
	});
});
