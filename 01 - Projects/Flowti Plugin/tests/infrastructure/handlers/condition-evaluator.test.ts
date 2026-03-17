import { describe, it, expect, vi } from "vitest";
import { ConditionEvaluator } from "../../../src/infrastructure/handlers/condition-evaluator";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { ConditionContext } from "../../../src/infrastructure/handlers/plugin-handler-registry";

describe("ConditionEvaluator", () => {
	function setup() {
		const registry = new PluginHandlerRegistry();
		const evaluator = new ConditionEvaluator(registry);
		const ctx: ConditionContext = { app: {}, eventBus: { emit: vi.fn(), on: vi.fn() } as unknown as ConditionContext["eventBus"] };
		return { registry, evaluator, ctx };
	}

	describe("single handler ID", () => {
		it("returns true when condition handler returns true", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("no-active-train", () => true);
			expect(evaluator.evaluate("no-active-train", ctx)).toBe(true);
		});

		it("returns false when condition handler returns false", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("no-active-train", () => false);
			expect(evaluator.evaluate("no-active-train", ctx)).toBe(false);
		});

		it("passes context to condition handler", () => {
			const { registry, evaluator, ctx } = setup();
			const handler = vi.fn(() => true);
			registry.registerCondition("check", handler);
			evaluator.evaluate("check", ctx);
			expect(handler).toHaveBeenCalledWith(ctx);
		});
	});

	describe("negation", () => {
		it("negates a handler result", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("active", () => true);
			expect(evaluator.evaluate("!active", ctx)).toBe(false);
		});

		it("double negation", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("active", () => true);
			expect(evaluator.evaluate("!!active", ctx)).toBe(true);
		});
	});

	describe("logical AND", () => {
		it("returns true when both sides are true", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("a && b", ctx)).toBe(true);
		});

		it("returns false when one side is false", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			expect(evaluator.evaluate("a && b", ctx)).toBe(false);
		});
	});

	describe("logical OR", () => {
		it("returns true when one side is true", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => false);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("a || b", ctx)).toBe(true);
		});

		it("returns false when both are false", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => false);
			registry.registerCondition("b", () => false);
			expect(evaluator.evaluate("a || b", ctx)).toBe(false);
		});
	});

	describe("parentheses", () => {
		it("groups expressions", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			registry.registerCondition("c", () => true);
			expect(evaluator.evaluate("(a || b) && c", ctx)).toBe(true);
		});

		it("negation on grouped expression", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("!(a && b)", ctx)).toBe(false);
		});
	});

	describe("operator precedence", () => {
		it("AND binds tighter than OR", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			registry.registerCondition("c", () => false);
			// a || b && c → a || (false && false) → true || false → true
			expect(evaluator.evaluate("a || b && c", ctx)).toBe(true);
		});
	});

	describe("compound with negation", () => {
		it("no-active-train && !session-active", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("no-active-train", () => true);
			registry.registerCondition("session-active", () => false);
			expect(evaluator.evaluate("no-active-train && !session-active", ctx)).toBe(true);
		});
	});

	describe("unknown handlers", () => {
		it("returns false for unknown handler ID (safe default)", () => {
			const { evaluator, ctx } = setup();
			expect(evaluator.evaluate("unknown-handler", ctx)).toBe(false);
		});

		it("returns false for unknown handler in compound", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("known", () => true);
			expect(evaluator.evaluate("known && unknown", ctx)).toBe(false);
		});
	});

	describe("whitespace handling", () => {
		it("handles extra whitespace", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("  a  &&  b  ", ctx)).toBe(true);
		});

		it("handles no whitespace around operators", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			expect(evaluator.evaluate("a&&b", ctx)).toBe(false);
		});
	});

	describe("empty expression", () => {
		it("returns false for empty string", () => {
			const { evaluator, ctx } = setup();
			expect(evaluator.evaluate("", ctx)).toBe(false);
		});

		it("returns false for whitespace-only", () => {
			const { evaluator, ctx } = setup();
			expect(evaluator.evaluate("   ", ctx)).toBe(false);
		});
	});
});
