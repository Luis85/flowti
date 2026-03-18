import { describe, it, expect } from "vitest";
import type { IContextProvider, FileContext, FileDiff } from "../../../src/domain/agents/context-provider.js";

describe("IContextProvider types", () => {
	it("FileContext has required shape", () => {
		const ctx: FileContext = { path: "test.md", contentHash: "abc", content: "hello" };
		expect(ctx.path).toBe("test.md");
		expect(ctx.contentHash).toBe("abc");
		expect(ctx.content).toBe("hello");
	});

	it("FileDiff has required shape", () => {
		const diff: FileDiff = { path: "test.md", previousHash: "a", currentHash: "b", diff: "+line" };
		expect(diff.diff).toBe("+line");
	});

	it("IContextProvider interface is implementable", () => {
		const provider: IContextProvider = {
			getActiveFileContext: () => null,
			getDiff: () => null,
			onFileChanged: () => () => {},
			dispose: () => {},
		};
		expect(provider.getActiveFileContext()).toBeNull();
		expect(typeof provider.dispose).toBe("function");
	});
});
