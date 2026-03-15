// tests/helpers/store-deps.ts
import { createMockFs } from "../mocks/mock-fs.js";
import { createMockClock } from "../mocks/mock-clock.js";
import type { IPaths } from "../../src/infrastructure/types.js";

function createMockPaths(): IPaths {
	return {
		join: (...segments: string[]) => segments.join("/"),
		resolve: (...segments: string[]) => segments.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string, ext?: string) => {
			const b = p.split("/").pop() ?? p;
			return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
		},
		relative: (_from: string, to: string) => to,
		extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
		isAbsolute: (p: string) => p.startsWith("/"),
		sep: "/",
	};
}

export function createStoreDeps(opts?: { files?: Record<string, string>; iso?: string }) {
	return {
		disk: createMockFs(opts?.files),
		paths: createMockPaths(),
		clock: createMockClock(opts?.iso),
	};
}
