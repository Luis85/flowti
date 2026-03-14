import { describe, it, expect, vi, beforeEach } from "vitest";
import { SitemapWatcher, computeHash } from "../../src/infrastructure/sitemap-watcher.js";
import type { IFileSystem } from "../../src/infrastructure/types.js";

vi.mock("../../src/infrastructure/sitemap-loader.js", () => ({
	validateSitemap: vi.fn(),
}));

import { validateSitemap } from "../../src/infrastructure/sitemap-loader.js";

function stubFs(files: Record<string, string>): IFileSystem {
	return {
		existsSync: (p: string) => p in files,
		readFileSync: (p: string) => {
			if (!(p in files)) throw new Error(`ENOENT: ${p}`);
			return files[p];
		},
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
		statSync: vi.fn(),
	} as unknown as IFileSystem;
}

const VALID_SITEMAP = JSON.stringify({
	version: 2,
	pages: { start: { kind: "page", label: "Start", description: "Start page", actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }] } },
});

beforeEach(() => vi.clearAllMocks());

describe("computeHash", () => {
	it("returns a hex string", () => {
		const hash = computeHash("hello");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("returns different hashes for different content", () => {
		expect(computeHash("a")).not.toBe(computeHash("b"));
	});

	it("returns same hash for same content", () => {
		expect(computeHash("test")).toBe(computeHash("test"));
	});
});

describe("SitemapWatcher", () => {
	const hash = computeHash(VALID_SITEMAP);

	describe("isDirty", () => {
		it("starts clean", () => {
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash);
			expect(watcher.isDirty()).toBe(false);
		});
	});

	describe("hash", () => {
		it("returns the initial hash", () => {
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash);
			expect(watcher.hash).toBe(hash);
		});
	});

	describe("lastLoaded", () => {
		it("returns a Date", () => {
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash);
			expect(watcher.lastLoaded).toBeInstanceOf(Date);
		});
	});

	describe("start/stop without watchFn", () => {
		it("does not throw without a watch function", () => {
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash);
			expect(() => watcher.start()).not.toThrow();
			expect(() => watcher.stop()).not.toThrow();
		});
	});

	describe("start/stop with watchFn", () => {
		it("calls watchFn and can be stopped", () => {
			const closeFn = vi.fn();
			const watchFn = vi.fn(() => ({ close: closeFn }));
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash, watchFn);

			watcher.start();
			expect(watchFn).toHaveBeenCalledWith("/sitemap.json", expect.any(Function));

			watcher.stop();
			expect(closeFn).toHaveBeenCalled();
		});

		it("does not start twice", () => {
			const watchFn = vi.fn(() => ({ close: vi.fn() }));
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash, watchFn);
			watcher.start();
			watcher.start();
			expect(watchFn).toHaveBeenCalledTimes(1);
		});

		it("sets dirty when onChange fires", () => {
			let onChange: () => void = () => {};
			const watchFn = vi.fn((_p: string, cb: () => void) => { onChange = cb; return { close: vi.fn() }; });
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash, watchFn);

			watcher.start();
			expect(watcher.isDirty()).toBe(false);
			onChange();
			expect(watcher.isDirty()).toBe(true);
		});

		it("handles watchFn throwing", () => {
			const watchFn = vi.fn(() => { throw new Error("not supported"); });
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash, watchFn);
			expect(() => watcher.start()).not.toThrow();
		});
	});

	describe("reload", () => {
		it("returns null when content has not changed", () => {
			const fs = stubFs({ "/sitemap.json": VALID_SITEMAP });
			const watcher = new SitemapWatcher("/sitemap.json", fs, hash);
			expect(watcher.reload()).toBeNull();
		});

		it("returns errors when file is missing", () => {
			const watcher = new SitemapWatcher("/sitemap.json", stubFs({}), hash);
			const result = watcher.reload();
			expect(result).toEqual({ errors: ["Sitemap file not found"] });
		});

		it("returns errors for invalid JSON", () => {
			const fs = stubFs({ "/sitemap.json": "not json{" });
			const watcher = new SitemapWatcher("/sitemap.json", fs, hash);
			const result = watcher.reload();
			expect(result).not.toBeNull();
			expect("errors" in result!).toBe(true);
			expect((result as { errors: string[] }).errors[0]).toContain("Invalid JSON");
		});

		it("returns errors when validation fails", () => {
			const newContent = JSON.stringify({ version: 99 });
			const fs = stubFs({ "/sitemap.json": newContent });
			vi.mocked(validateSitemap).mockReturnValue({ ok: false, errors: ["bad version"] });

			const watcher = new SitemapWatcher("/sitemap.json", fs, hash);
			const result = watcher.reload();
			expect(result).toEqual({ errors: ["bad version"] });
		});

		it("returns new sitemap on valid change", () => {
			const newSitemap = { version: 2, pages: { home: { kind: "page", label: "Home", description: "", actions: [] } } };
			const newContent = JSON.stringify(newSitemap);
			const fs = stubFs({ "/sitemap.json": newContent });
			vi.mocked(validateSitemap).mockReturnValue({ ok: true, sitemap: newSitemap as any, errors: [] });

			const watcher = new SitemapWatcher("/sitemap.json", fs, hash);
			const result = watcher.reload();
			expect(result).not.toBeNull();
			expect("sitemap" in result!).toBe(true);
			expect((result as { sitemap: unknown; hash: string }).hash).toBe(computeHash(newContent));
		});

		it("updates hash after successful reload", () => {
			const newContent = JSON.stringify({ version: 2, pages: { x: { kind: "page", label: "X", description: "", actions: [] } } });
			const fs = stubFs({ "/sitemap.json": newContent });
			vi.mocked(validateSitemap).mockReturnValue({ ok: true, sitemap: {} as any, errors: [] });

			const watcher = new SitemapWatcher("/sitemap.json", fs, hash);
			watcher.reload();
			expect(watcher.hash).toBe(computeHash(newContent));
		});

		it("clears dirty flag on reload", () => {
			let onChange: () => void = () => {};
			const watchFn = vi.fn((_p: string, cb: () => void) => { onChange = cb; return { close: vi.fn() }; });
			const fs = stubFs({ "/sitemap.json": VALID_SITEMAP });
			const watcher = new SitemapWatcher("/sitemap.json", fs, hash, watchFn);

			watcher.start();
			onChange();
			expect(watcher.isDirty()).toBe(true);
			watcher.reload(); // same content → null, but dirty is cleared
			expect(watcher.isDirty()).toBe(false);
		});
	});
});
