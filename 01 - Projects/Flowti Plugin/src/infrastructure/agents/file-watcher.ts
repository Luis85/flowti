/**
 * File-watching utilities for observing JSON/JSONL files.
 *
 * - watchJsonFile: debounced, hash-diffed watcher for a single JSON file
 * - tailJsonlFile: tailing watcher for append-only JSONL streams
 *
 * Both use Node.js built-ins available in Electron.
 */

import { watch, readFileSync, statSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import type { FSWatcher } from "node:fs";
import { createHash } from "node:crypto";

export interface FileWatcher {
	close(): void;
}

/**
 * Watch a JSON file for changes. Uses SHA-256 hash comparison to suppress
 * duplicate fs.watch events (common on Windows). Debounces by default 300ms.
 */
export function watchJsonFile<T>(
	path: string,
	onChange: (data: T) => void,
	debounceMs = 300,
): FileWatcher {
	let lastHash = "";
	let timer: ReturnType<typeof setTimeout> | null = null;
	let watcher: FSWatcher | null = null;

	function readAndNotify(): void {
		try {
			if (!existsSync(path)) return;
			const raw = readFileSync(path, "utf-8");
			const hash = createHash("sha256").update(raw).digest("hex");
			if (hash === lastHash) return;
			lastHash = hash;
			const parsed = JSON.parse(raw) as T;
			onChange(parsed);
		} catch {
			/* missing file or invalid JSON — silently ignore */
		}
	}

	try {
		watcher = watch(path, () => {
			if (timer !== null) clearTimeout(timer);
			timer = setTimeout(readAndNotify, debounceMs);
		});
		watcher.on("error", () => { /* file may not exist yet */ });
	} catch {
		/* fs.watch can throw if path doesn't exist */
	}

	return {
		close(): void {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
			if (watcher) {
				watcher.close();
				watcher = null;
			}
		},
	};
}

/**
 * Tail a JSONL (newline-delimited JSON) file, emitting each new complete line
 * as a parsed object. Tracks byte offset so only new content is read.
 *
 * Includes a 500ms polling fallback for Windows where fs.watch can miss events.
 */
export function tailJsonlFile(
	path: string,
	onLine: (data: unknown) => void,
): FileWatcher {
	let offset = 0;
	let partialLine = "";
	let watcher: FSWatcher | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	// Initialise offset to current file size (if it exists)
	try {
		if (existsSync(path)) {
			offset = statSync(path).size;
		}
	} catch {
		/* file may not exist yet */
	}

	function readNewBytes(): void {
		try {
			if (!existsSync(path)) return;
			const size = statSync(path).size;
			if (size <= offset) {
				// File was truncated or unchanged
				if (size < offset) {
					offset = size;
					partialLine = "";
				}
				return;
			}
			const bytesToRead = size - offset;
			const buffer = Buffer.alloc(bytesToRead);
			const fd = openSync(path, "r");
			try {
				readSync(fd, buffer, 0, bytesToRead, offset);
			} finally {
				closeSync(fd);
			}
			offset = size;

			const chunk = buffer.toString("utf-8");
			const text = partialLine + chunk;
			const lines = text.split("\n");

			// Last element is either empty (if chunk ended with \n) or a partial line
			partialLine = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					const parsed: unknown = JSON.parse(trimmed);
					onLine(parsed);
				} catch {
					/* malformed line — skip */
				}
			}
		} catch {
			/* file disappeared or I/O error — silently ignore */
		}
	}

	try {
		watcher = watch(path, () => {
			readNewBytes();
		});
		watcher.on("error", () => { /* file may not exist yet */ });
	} catch {
		/* fs.watch can throw if path doesn't exist */
	}

	// Windows polling fallback — supplement fs.watch with interval
	pollTimer = setInterval(readNewBytes, 500);

	return {
		close(): void {
			if (watcher) {
				watcher.close();
				watcher = null;
			}
			if (pollTimer !== null) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			partialLine = "";
		},
	};
}
