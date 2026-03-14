/**
 * sitemap-conditions.ts — Expression evaluator for sitemap disabled/hidden conditions.
 *
 * Evaluates simple boolean expressions like `"tools.esbuild || tools.tsc"`
 * against a flat context object. Supports dot-path resolution, `||`, `&&`, `!`,
 * and parentheses. Does NOT use `eval()`.
 */

import type { DisabledCondition, HiddenCondition } from "../domain/sitemap/unified-page.js";
import type { RouterContext } from "./sitemap-types.js";
import type { HandlerRegistry } from "./handler-registry.js";

// ── Public API ──────────────────────────────────────────────────────

/**
 * Resolve a `disabled` condition to a boolean.
 * Returns `true` if the item IS disabled.
 */
export function resolveDisabledCondition(
	condition: DisabledCondition | undefined,
	ctx: RouterContext,
	registry: HandlerRegistry,
): boolean {
	if (condition === undefined) return false;
	if (typeof condition === "boolean") return condition;
	if (typeof condition === "string") return resolveStringCondition(condition, ctx, registry);
	// { unless: expr } — disabled when the expression is falsy
	return !evaluateExpression(condition.unless, buildFlatContext(ctx));
}

/**
 * Resolve a `hidden` condition to a boolean.
 * Returns `true` if the item IS hidden.
 */
export function resolveHiddenCondition(
	condition: HiddenCondition | undefined,
	ctx: RouterContext,
	registry: HandlerRegistry,
): boolean {
	if (condition === undefined) return false;
	if (typeof condition === "boolean") return condition;
	return resolveStringCondition(condition, ctx, registry);
}

/** A string condition is either a registered handler ID or an inline expression. */
function resolveStringCondition(condition: string, ctx: RouterContext, registry: HandlerRegistry): boolean {
	if (registry.hasCondition(condition)) return registry.getCondition(condition)(ctx);
	return evaluateExpression(condition, buildFlatContext(ctx));
}

// ── Context flattening ──────────────────────────────────────────────

/** Builds a flat key-value map from RouterContext for dot-path resolution. */
export function buildFlatContext(ctx: RouterContext): Record<string, boolean> {
	const flat: Record<string, boolean> = {};

	if (ctx.tools) {
		for (const [key, val] of Object.entries(ctx.tools)) {
			flat[`tools.${key}`] = val;
		}
	}

	if (ctx.project) {
		flat["project"] = true;
		flat["project.config"] = true;
		const cfg = ctx.project.config;
		flat["config.build"] = !!cfg.build;
		flat["config.test"] = !!cfg.test;
		flat["config.publish"] = !!cfg.publish;
		flat["config.review"] = !!cfg.review;
		flat["config.reports"] = !!cfg.reports;
		flat["config.health"] = !!cfg.health;
		flat["config.management"] = !!cfg.management;
	}

	return flat;
}

// ── Expression evaluator ────────────────────────────────────────────

/**
 * Tokenize a boolean expression into atoms.
 *
 * Supported tokens: identifiers (dot-paths), `||`, `&&`, `!`, `(`, `)`.
 */
export function tokenize(expr: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	while (i < expr.length) {
		const ch = expr[i];
		// Whitespace
		if (ch === " " || ch === "\t") { i++; continue; }
		// Single-char tokens
		const singleResult = tokenizeSingle(ch, expr, i);
		if (singleResult) { tokens.push(singleResult.token); i += singleResult.advance; continue; }
		// Identifier (dot-path)
		if (/[a-zA-Z_]/.test(ch)) {
			let id = ch; i++;
			while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) { id += expr[i]; i++; }
			tokens.push(id);
			continue;
		}
		throw new Error(`Unexpected character '${ch}' in expression: "${expr}"`);
	}
	return tokens;
}

function tokenizeSingle(ch: string, expr: string, i: number): { token: string; advance: number } | null {
	if (ch === "(" || ch === ")") return { token: ch, advance: 1 };
	if (ch === "!" && expr[i + 1] !== "=") return { token: "!", advance: 1 };
	if (ch === "|" && expr[i + 1] === "|") return { token: "||", advance: 2 };
	if (ch === "&" && expr[i + 1] === "&") return { token: "&&", advance: 2 };
	return null;
}

/**
 * Evaluate a boolean expression against a flat context.
 *
 * Grammar (recursive descent):
 *   expr     → orExpr
 *   orExpr   → andExpr ("||" andExpr)*
 *   andExpr  → unary ("&&" unary)*
 *   unary    → "!" unary | primary
 *   primary  → "(" expr ")" | IDENTIFIER
 */
export function evaluateExpression(expr: string, context: Record<string, boolean>): boolean {
	const tokens = tokenize(expr);
	let pos = 0;

	function peek(): string | undefined { return tokens[pos]; }
	function consume(): string { return tokens[pos++]; }

	function parseOr(): boolean {
		let left = parseAnd();
		while (peek() === "||") {
			consume();
			const right = parseAnd();
			left = left || right;
		}
		return left;
	}

	function parseAnd(): boolean {
		let left = parseUnary();
		while (peek() === "&&") {
			consume();
			const right = parseUnary();
			left = left && right;
		}
		return left;
	}

	function parseUnary(): boolean {
		if (peek() === "!") { consume(); return !parseUnary(); }
		return parsePrimary();
	}

	function parsePrimary(): boolean {
		if (peek() === "(") {
			consume(); // "("
			const val = parseOr();
			if (peek() !== ")") throw new Error(`Expected ')' in expression: "${expr}"`);
			consume(); // ")"
			return val;
		}
		const token = consume();
		if (token === undefined) throw new Error(`Unexpected end of expression: "${expr}"`);
		return !!context[token];
	}

	const result = parseOr();
	if (pos < tokens.length) throw new Error(`Unexpected token '${tokens[pos]}' in expression: "${expr}"`);
	return result;
}
