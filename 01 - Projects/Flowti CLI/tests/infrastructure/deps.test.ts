/**
 * deps.test.ts — Tests for the DI container and test deps factory.
 */

import { describe, it, expect } from "vitest";
import { createDefaultDeps } from "../../src/infrastructure/deps.js";
import { createTestDeps } from "../mocks/mock-deps.js";

describe("createDefaultDeps", () => {
	it("returns an object with all dependency keys", () => {
		const deps = createDefaultDeps();
		expect(deps.disk).toBeDefined();
		expect(deps.shell).toBeDefined();
		expect(deps.paths).toBeDefined();
		expect(deps.clock).toBeDefined();
		expect(deps.proc).toBeDefined();
		expect(deps.input).toBeDefined();
		expect(typeof deps.log).toBe("function");
		expect(typeof deps.warn).toBe("function");
	});

	it("returns the same singletons on repeated calls", () => {
		const a = createDefaultDeps();
		const b = createDefaultDeps();
		expect(a.disk).toBe(b.disk);
		expect(a.shell).toBe(b.shell);
	});
});

describe("createTestDeps", () => {
	it("returns an object with all dependency keys", () => {
		const deps = createTestDeps();
		expect(deps.disk).toBeDefined();
		expect(deps.shell).toBeDefined();
		expect(deps.paths).toBeDefined();
		expect(deps.clock).toBeDefined();
		expect(deps.proc).toBeDefined();
		expect(deps.input).toBeDefined();
		expect(typeof deps.log).toBe("function");
		expect(typeof deps.warn).toBe("function");
	});

	it("uses mock filesystem with provided files", () => {
		const deps = createTestDeps({ files: { "/test.txt": "hello" } });
		expect(deps.disk.readFileSync("/test.txt", "utf-8")).toBe("hello");
	});

	it("mock paths.join concatenates with /", () => {
		const deps = createTestDeps();
		expect(deps.paths.join("a", "b", "c")).toBe("a/b/c");
	});

	it("mock paths.basename strips extension", () => {
		const deps = createTestDeps();
		expect(deps.paths.basename("file.json", ".json")).toBe("file");
		expect(deps.paths.basename("file.json")).toBe("file.json");
	});

	it("mock clock has fixed time", () => {
		const deps = createTestDeps({ clock: "2025-01-01T00:00:00.000Z" });
		expect(deps.clock.iso()).toBe("2025-01-01T00:00:00.000Z");
	});

	it("log and warn are callable mock functions", () => {
		const deps = createTestDeps();
		deps.log("test message");
		deps.warn("test warning");
		expect(deps.log).toHaveBeenCalledWith("test message");
		expect(deps.warn).toHaveBeenCalledWith("test warning");
	});
});
