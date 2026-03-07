import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { log, info, warn, error, blank } from "../../src/infrastructure/logger.js";

describe("logger", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("log() calls console.log with args", () => {
		log("hello");
		expect(logSpy).toHaveBeenCalledWith("hello");
	});

	it("info() calls console.log with args", () => {
		info("details");
		expect(logSpy).toHaveBeenCalledWith("details");
	});

	it("warn() calls console.warn with args", () => {
		warn("careful");
		expect(warnSpy).toHaveBeenCalledWith("careful");
	});

	it("error() calls console.error with args", () => {
		error("fail");
		expect(errorSpy).toHaveBeenCalledWith("fail");
	});

	it("blank() calls console.log with no args", () => {
		blank();
		expect(logSpy).toHaveBeenCalledWith();
	});

	it("functions pass through multiple args", () => {
		log("a", 1, true);
		expect(logSpy).toHaveBeenCalledWith("a", 1, true);

		warn("w", { x: 2 });
		expect(warnSpy).toHaveBeenCalledWith("w", { x: 2 });

		error("e", 42, null);
		expect(errorSpy).toHaveBeenCalledWith("e", 42, null);
	});
});
