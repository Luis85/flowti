/**
 * plan-watcher.ts — Watches an iteration plan file for changes and notifies on content updates.
 *
 * Uses the same hash-based change detection pattern as SitemapWatcher to guard
 * against spurious fs.watch events on Windows. Includes debouncing for rapid
 * successive writes (e.g. an agent writing multiple sections).
 */

import { createHash } from "node:crypto";
import type { IFileSystem } from "./types.js";
import type { FileWatcher, WatchFn } from "./sitemap-watcher.js";

export class PlanWatcher {
	readonly #filePath: string;
	readonly #fs: IFileSystem;
	readonly #watchFn: WatchFn | undefined;
	readonly #debounceMs: number;
	#currentHash: string;
	#watcher: FileWatcher | null = null;
	#debounceTimer: ReturnType<typeof setTimeout> | null = null;
	#onChange: (() => void) | null = null;

	constructor(filePath: string, fs: IFileSystem, watchFn?: WatchFn, debounceMs = 500) {
		this.#filePath = filePath;
		this.#fs = fs;
		this.#watchFn = watchFn;
		this.#debounceMs = debounceMs;
		this.#currentHash = this.#computeCurrentHash();
	}

	/** Start watching the plan file. Calls `onChange` when content actually changes. */
	start(onChange: () => void): void {
		if (this.#watcher || !this.#watchFn) return;
		this.#onChange = onChange;
		try {
			this.#watcher = this.#watchFn(this.#filePath, () => this.#handleEvent());
		} catch {
			// Watch not available — caller must poll manually
		}
	}

	/** Stop watching and clean up. */
	stop(): void {
		this.#watcher?.close();
		this.#watcher = null;
		this.#onChange = null;
		if (this.#debounceTimer) {
			clearTimeout(this.#debounceTimer);
			this.#debounceTimer = null;
		}
	}

	/** Whether the watcher is currently active. */
	get active(): boolean {
		return this.#watcher !== null;
	}

	/** Current content hash. */
	get hash(): string {
		return this.#currentHash;
	}

	/** Check if file content has changed since last check. Updates hash if changed. */
	checkForChanges(): boolean {
		const newHash = this.#computeCurrentHash();
		if (newHash === this.#currentHash) return false;
		this.#currentHash = newHash;
		return true;
	}

	#handleEvent(): void {
		if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
		this.#debounceTimer = setTimeout(() => {
			this.#debounceTimer = null;
			if (this.checkForChanges() && this.#onChange) {
				this.#onChange();
			}
		}, this.#debounceMs);
	}

	#computeCurrentHash(): string {
		try {
			const content = this.#fs.readFileSync(this.#filePath, "utf-8");
			return createHash("sha256").update(content, "utf-8").digest("hex");
		} catch {
			return "";
		}
	}
}
