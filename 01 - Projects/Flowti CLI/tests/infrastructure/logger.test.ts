import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { log, info, warn, error, blank, debug, setLogLevel, setColorEnabled } from "../../src/infrastructure/logger.js";

describe("logger", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	let debugSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
		setLogLevel("normal");
		setColorEnabled(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setLogLevel("normal");
		setColorEnabled(true);
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

describe("logger --quiet mode", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		setLogLevel("quiet");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setLogLevel("normal");
	});

	it("suppresses log()", () => {
		log("should not appear");
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("suppresses info()", () => {
		info("should not appear");
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("suppresses blank()", () => {
		blank();
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("still shows warn()", () => {
		warn("important");
		expect(warnSpy).toHaveBeenCalledWith("important");
	});

	it("still shows error()", () => {
		error("critical");
		expect(errorSpy).toHaveBeenCalledWith("critical");
	});
});

describe("logger --verbose mode", () => {
	let debugSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
		setLogLevel("debug");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setLogLevel("normal");
	});

	it("enables debug()", () => {
		debug("trace info");
		expect(debugSpy).toHaveBeenCalledWith("trace info");
	});

	it("debug() is suppressed in normal mode", () => {
		setLogLevel("normal");
		debug("hidden");
		expect(debugSpy).not.toHaveBeenCalled();
	});
});

describe("logger --no-color mode", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		setColorEnabled(false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setColorEnabled(true);
	});

	it("strips ANSI from log output", () => {
		log("\x1b[32mgreen\x1b[0m text");
		expect(logSpy).toHaveBeenCalledWith("green text");
	});

	it("strips ANSI from warn output", () => {
		warn("\x1b[31merror\x1b[0m msg");
		expect(warnSpy).toHaveBeenCalledWith("error msg");
	});

	it("passes non-string args unchanged", () => {
		log("text", 42, null);
		expect(logSpy).toHaveBeenCalledWith("text", 42, null);
	});

	it("preserves color when enabled", () => {
		setColorEnabled(true);
		log("\x1b[32mgreen\x1b[0m");
		expect(logSpy).toHaveBeenCalledWith("\x1b[32mgreen\x1b[0m");
	});
});
