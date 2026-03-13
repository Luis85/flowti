/**
 * sitemap-watcher.ts — Watches sitemap.json for changes and supports hot-reload.
 *
 * Uses fs.watch() with SHA-256 hash comparison to detect actual content changes
 * (guards against spurious fs.watch events on Windows).
 */

import { createHash } from "node:crypto";
import type { IFileSystem } from "./types.js";
import type { Sitemap } from "./sitemap-types.js";
import { validateSitemap } from "./sitemap-loader.js";

/** Minimal watcher handle — matches node:fs FSWatcher shape. */
export interface FileWatcher {
	close(): void;
}

/** Function that starts watching a file and calls `onChange` when it changes. */
export type WatchFn = (path: string, onChange: () => void) => FileWatcher;

export class SitemapWatcher {
	readonly #sitemapPath: string;
	readonly #fs: IFileSystem;
	readonly #watch: WatchFn | undefined;
	#currentHash: string;
	#dirty = false;
	#watcher: FileWatcher | null = null;
	#lastLoaded: Date;

	constructor(sitemapPath: string, fs: IFileSystem, initialHash: string, watchFn?: WatchFn) {
		this.#sitemapPath = sitemapPath;
		this.#fs = fs;
		this.#watch = watchFn;
		this.#currentHash = initialHash;
		this.#lastLoaded = new Date();
	}

	/** Start watching the sitemap file. */
	start(): void {
		if (this.#watcher || !this.#watch) return;
		try {
			this.#watcher = this.#watch(this.#sitemapPath, () => {
				this.#dirty = true;
			});
		} catch {
			// Watch not available — dirtiness must be checked manually
		}
	}

	/** Stop watching. */
	stop(): void {
		this.#watcher?.close();
		this.#watcher = null;
	}

	/** Check if the sitemap has been modified since last load. */
	isDirty(): boolean {
		return this.#dirty;
	}

	/** Last-loaded timestamp. */
	get lastLoaded(): Date {
		return this.#lastLoaded;
	}

	/** Current content hash. */
	get hash(): string {
		return this.#currentHash;
	}

	/**
	 * Attempt to reload the sitemap. Returns the new Sitemap if content actually
	 * changed and validation passes. Returns null if unchanged or invalid.
	 */
	reload(): { sitemap: Sitemap; hash: string } | { errors: string[] } | null {
		this.#dirty = false;

		if (!this.#fs.existsSync(this.#sitemapPath)) {
			return { errors: ["Sitemap file not found"] };
		}

		const content = this.#fs.readFileSync(this.#sitemapPath, "utf-8");
		const newHash = computeHash(content);

		if (newHash === this.#currentHash) return null; // no actual change

		let raw: unknown;
		try {
			raw = JSON.parse(content);
		} catch (err) {
			return { errors: [`Invalid JSON: ${(err as Error).message}`] };
		}

		const result = validateSitemap(raw);
		if (!result.ok) return { errors: [...result.errors] };

		this.#currentHash = newHash;
		this.#lastLoaded = new Date();
		return { sitemap: result.sitemap!, hash: newHash };
	}
}

/** Compute SHA-256 hash of content. */
export function computeHash(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}
