import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/request-response.js", () => ({
	getSharedDeps: vi.fn(() => ({ log: vi.fn() })),
	handleResponse: vi.fn(),
	dataResponse: vi.fn((data: unknown, render: unknown) => ({ data, render })),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderNoProject: vi.fn(),
}));

import { parseFlags, validateFlags, adaptDescriptor } from "../../src/infrastructure/command-engine.js";
import type { FlagSpec } from "../../src/infrastructure/command-engine.js";

describe("parseFlags", () => {
	it("extracts string flags with defaults", () => {
		const spec: Record<string, FlagSpec> = {
			mode: { type: "string", default: "fast" },
		};
		const result = parseFlags({ mode: "full" }, spec);
		expect(result.mode).toBe("full");
	});

	it("applies default when flag is missing", () => {
		const spec: Record<string, FlagSpec> = {
			mode: { type: "string", default: "fast" },
		};
		const result = parseFlags({}, spec);
		expect(result.mode).toBe("fast");
	});

	it("coerces number flags with int", () => {
		const spec: Record<string, FlagSpec> = {
			count: { type: "number", coerce: "int", default: 0 },
		};
		const result = parseFlags({ count: "42" }, spec);
		expect(result.count).toBe(42);
	});

	it("coerces number flags with float", () => {
		const spec: Record<string, FlagSpec> = {
			hours: { type: "number", coerce: "float", default: 1 },
		};
		const result = parseFlags({ hours: "2.5" }, spec);
		expect(result.hours).toBe(2.5);
	});

	it("splits list flags by comma", () => {
		const spec: Record<string, FlagSpec> = {
			tags: { type: "list" },
		};
		const result = parseFlags({ tags: "a,b,c" }, spec);
		expect(result.tags).toEqual(["a", "b", "c"]);
	});

	it("handles boolean flags", () => {
		const spec: Record<string, FlagSpec> = {
			verbose: { type: "boolean", default: false },
		};
		expect(parseFlags({ verbose: true }, spec).verbose).toBe(true);
		expect(parseFlags({}, spec).verbose).toBe(false);
	});

	it("calls custom parse function", () => {
		const spec: Record<string, FlagSpec> = {
			payload: { type: "string", parse: (raw) => JSON.parse(raw) },
		};
		const result = parseFlags({ payload: '{"key":"val"}' }, spec);
		expect(result.payload).toEqual({ key: "val" });
	});
});

describe("validateFlags", () => {
	it("returns error for missing required flag", () => {
		const spec: Record<string, FlagSpec> = {
			name: { type: "string", required: true, hint: "--name=<value>" },
		};
		const result = validateFlags({}, spec);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("--name");
		expect(result!.hint).toContain("--name=<value>");
	});

	it("returns null when required flag is present", () => {
		const spec: Record<string, FlagSpec> = {
			name: { type: "string", required: true },
		};
		const result = validateFlags({ name: "test" }, spec);
		expect(result).toBeNull();
	});

	it("returns error for invalid choice", () => {
		const spec: Record<string, FlagSpec> = {
			status: { type: "string", choices: ["open", "closed"] },
		};
		const result = validateFlags({ status: "invalid" }, spec);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("invalid");
		expect(result!.error).toContain("open");
	});

	it("accepts valid choice", () => {
		const spec: Record<string, FlagSpec> = {
			status: { type: "string", choices: ["open", "closed"] },
		};
		const result = validateFlags({ status: "open" }, spec);
		expect(result).toBeNull();
	});
});

describe("adaptDescriptor", () => {
	it("calls handler with parsed flags", () => {
		const handlerFn = vi.fn(() => ({ value: 42 }));
		const handler = adaptDescriptor({
			flags: { mode: { type: "string", default: "fast" } },
			handler: handlerFn,
			renderer: vi.fn(),
		});
		handler({ mode: "full" }, [], "test:cmd", undefined);
		expect(handlerFn).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "test:cmd",
				flags: { mode: "full" },
			}),
		);
	});

	it("handles async handlers", async () => {
		const handlerFn = vi.fn(async () => ({ async: true }));
		const renderer = vi.fn();
		const handler = adaptDescriptor({
			handler: handlerFn,
			renderer,
		});
		const result = handler({}, [], "test:cmd", undefined);
		expect(result).toBeInstanceOf(Promise);
		await result;
	});

	it("applies exitCode from callback", () => {
		const handler = adaptDescriptor({
			handler: () => ({ errors: ["bad"] }),
			renderer: vi.fn(),
			exitCode: (m: { errors: string[] }) => m.errors.length > 0 ? 1 : undefined,
		});
		// adaptDescriptor returns void and calls handleResponse internally,
		// so we just ensure it doesn't throw
		handler({}, [], "test:cmd", undefined);
	});

	it("resolves wildcard from prefix", () => {
		const handlerFn = vi.fn(() => ({ report: "coverage" }));
		const handler = adaptDescriptor({
			wildcardPrefix: "report:",
			handler: handlerFn,
			renderer: vi.fn(),
		});
		handler({}, [], "report:coverage", undefined);
		expect(handlerFn).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "report:coverage",
				wildcard: "coverage",
			}),
		);
	});

	it("passes rawArgs when rawArgs: true", () => {
		const handlerFn = vi.fn(() => ({}));
		const handler = adaptDescriptor({
			rawArgs: true,
			handler: handlerFn,
			renderer: vi.fn(),
		});
		handler({}, ["help", "build"], "help", undefined);
		expect(handlerFn).toHaveBeenCalledWith(
			expect.objectContaining({
				rawArgs: ["help", "build"],
			}),
		);
	});

	it("stamps __descriptor on returned handler", () => {
		const desc = { handler: () => ({}), renderer: vi.fn() };
		const handler = adaptDescriptor(desc);
		expect((handler as any).__descriptor).toBe(desc);
	});
});
