import { describe, it, expect, vi } from "vitest";
import {
	tokenize,
	evaluateExpression,
	buildFlatContext,
	resolveDisabledCondition,
	resolveHiddenCondition,
} from "../../src/infrastructure/sitemap-conditions.js";
import { HandlerRegistry } from "../../src/infrastructure/handler-registry.js";
import type { RouterContext } from "../../src/infrastructure/sitemap-types.js";
import type { CliDeps } from "../../src/infrastructure/deps.js";

const stubDeps = {} as CliDeps;

function makeCtx(overrides: Partial<RouterContext> = {}): RouterContext {
	return { deps: stubDeps, ...overrides };
}

// ── tokenize ────────────────────────────────────────────────────────

describe("tokenize", () => {
	it("tokenizes a simple identifier", () => {
		expect(tokenize("tools.esbuild")).toEqual(["tools.esbuild"]);
	});

	it("tokenizes OR expression", () => {
		expect(tokenize("tools.esbuild || tools.tsc")).toEqual(["tools.esbuild", "||", "tools.tsc"]);
	});

	it("tokenizes AND expression", () => {
		expect(tokenize("a && b")).toEqual(["a", "&&", "b"]);
	});

	it("tokenizes negation", () => {
		expect(tokenize("!a")).toEqual(["!", "a"]);
	});

	it("tokenizes parentheses", () => {
		expect(tokenize("(a || b) && !c")).toEqual(["(", "a", "||", "b", ")", "&&", "!", "c"]);
	});

	it("throws on unexpected character", () => {
		expect(() => tokenize("a @ b")).toThrow("Unexpected character '@'");
	});

	it("handles empty expression", () => {
		expect(tokenize("")).toEqual([]);
	});
});

// ── evaluateExpression ──────────────────────────────────────────────

describe("evaluateExpression", () => {
	it("resolves a single truthy identifier", () => {
		expect(evaluateExpression("tools.esbuild", { "tools.esbuild": true })).toBe(true);
	});

	it("resolves a single falsy identifier", () => {
		expect(evaluateExpression("tools.esbuild", {})).toBe(false);
	});

	it("evaluates OR: true || false", () => {
		expect(evaluateExpression("a || b", { a: true })).toBe(true);
	});

	it("evaluates OR: false || false", () => {
		expect(evaluateExpression("a || b", {})).toBe(false);
	});

	it("evaluates AND: true && true", () => {
		expect(evaluateExpression("a && b", { a: true, b: true })).toBe(true);
	});

	it("evaluates AND: true && false", () => {
		expect(evaluateExpression("a && b", { a: true })).toBe(false);
	});

	it("evaluates negation", () => {
		expect(evaluateExpression("!a", {})).toBe(true);
		expect(evaluateExpression("!a", { a: true })).toBe(false);
	});

	it("evaluates parenthesized expression", () => {
		expect(evaluateExpression("(a || b) && c", { a: true, c: true })).toBe(true);
		expect(evaluateExpression("(a || b) && c", { a: true })).toBe(false);
	});

	it("respects operator precedence: && before ||", () => {
		// a || b && c  →  a || (b && c)
		expect(evaluateExpression("a || b && c", { a: true })).toBe(true);
		expect(evaluateExpression("a || b && c", { b: true })).toBe(false);
		expect(evaluateExpression("a || b && c", { b: true, c: true })).toBe(true);
	});

	it("throws on unexpected end", () => {
		expect(() => evaluateExpression("!", {})).toThrow("Unexpected end");
	});

	it("throws on trailing tokens", () => {
		expect(() => evaluateExpression("a b", { a: true, b: true })).toThrow("Unexpected token");
	});
});

// ── buildFlatContext ────────────────────────────────────────────────

describe("buildFlatContext", () => {
	it("flattens tools into dot-paths", () => {
		const ctx = makeCtx({ tools: { esbuild: true, tsc: false } });
		const flat = buildFlatContext(ctx);
		expect(flat["tools.esbuild"]).toBe(true);
		expect(flat["tools.tsc"]).toBe(false);
	});

	it("flattens project config flags", () => {
		const ctx = makeCtx({
			project: {
				path: "/p",
				pkg: null,
				config: { name: "test", build: { commands: {} } } as any,
				scripts: {},
			},
		});
		const flat = buildFlatContext(ctx);
		expect(flat["project"]).toBe(true);
		expect(flat["config.build"]).toBe(true);
		expect(flat["config.test"]).toBe(false);
	});

	it("returns empty object when no tools or project", () => {
		const flat = buildFlatContext(makeCtx());
		expect(Object.keys(flat)).toEqual([]);
	});
});

// ── resolveDisabledCondition ────────────────────────────────────────

describe("resolveDisabledCondition", () => {
	it("returns false for undefined", () => {
		const reg = new HandlerRegistry();
		expect(resolveDisabledCondition(undefined, makeCtx(), reg)).toBe(false);
	});

	it("returns the boolean literal", () => {
		const reg = new HandlerRegistry();
		expect(resolveDisabledCondition(true, makeCtx(), reg)).toBe(true);
		expect(resolveDisabledCondition(false, makeCtx(), reg)).toBe(false);
	});

	it("calls a registered condition handler by ID", () => {
		const reg = new HandlerRegistry();
		reg.registerCondition("my:check", () => true);
		expect(resolveDisabledCondition("my:check", makeCtx(), reg)).toBe(true);
	});

	it("evaluates { unless } expression — disabled when falsy", () => {
		const reg = new HandlerRegistry();
		const ctx = makeCtx({ tools: { esbuild: true, tsc: false } });
		// tools.esbuild is true → not disabled
		expect(resolveDisabledCondition({ unless: "tools.esbuild" }, ctx, reg)).toBe(false);
		// tools.tsc is false → disabled
		expect(resolveDisabledCondition({ unless: "tools.tsc" }, ctx, reg)).toBe(true);
	});

	it("evaluates { unless } with OR", () => {
		const reg = new HandlerRegistry();
		const ctx = makeCtx({ tools: { esbuild: false, tsc: true } });
		expect(resolveDisabledCondition({ unless: "tools.esbuild || tools.tsc" }, ctx, reg)).toBe(false);
	});
});

// ── resolveHiddenCondition ──────────────────────────────────────────

describe("resolveHiddenCondition", () => {
	it("returns false for undefined", () => {
		const reg = new HandlerRegistry();
		expect(resolveHiddenCondition(undefined, makeCtx(), reg)).toBe(false);
	});

	it("returns the boolean literal", () => {
		const reg = new HandlerRegistry();
		expect(resolveHiddenCondition(true, makeCtx(), reg)).toBe(true);
	});

	it("calls a registered condition handler by ID", () => {
		const reg = new HandlerRegistry();
		reg.registerCondition("hide:me", () => true);
		expect(resolveHiddenCondition("hide:me", makeCtx(), reg)).toBe(true);
	});
});
