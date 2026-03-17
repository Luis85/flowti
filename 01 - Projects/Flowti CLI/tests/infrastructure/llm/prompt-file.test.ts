import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));

import { writePromptFile, cleanupPromptFile } from "../../../src/infrastructure/llm/prompt-file.js";
import type { IFileSystem, IPaths, IClock } from "../../../src/infrastructure/types.js";

function makeDeps() {
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } as unknown as IFileSystem,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as unknown as IPaths,
		clock: { ms: vi.fn(() => 9999) } as unknown as IClock,
	};
}

describe("writePromptFile", () => {
	it("writes prompt to a temp file and returns the path", () => {
		const deps = makeDeps();
		const path = writePromptFile(deps, "hello world");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(path, "hello world", "utf-8");
		expect(path).toContain(".flowti-prompt-");
	});
});

describe("cleanupPromptFile", () => {
	it("deletes the temp file silently", () => {
		const deps = makeDeps();
		cleanupPromptFile(deps, "/tmp/prompt.tmp");
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith("/tmp/prompt.tmp");
	});

	it("does not throw if file is already gone", () => {
		const deps = makeDeps();
		(deps.disk.unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("ENOENT"); });
		expect(() => cleanupPromptFile(deps, "/tmp/gone.tmp")).not.toThrow();
	});
});
