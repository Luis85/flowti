vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerEffectHandlers } from "../../../src/tui/registry/effect-handlers.js";
import type { TuiActionContext } from "../../../src/tui/registry/tui-handler-types.js";

function makeCtx(overrides?: Partial<TuiActionContext>): TuiActionContext {
	return {
		deps: {
			disk: {},
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: { run: vi.fn().mockReturnValue(0) },
		} as never,
		session: { pipeline: {} },
		project: { name: "CLI", path: "/p" },
		...overrides,
	};
}

describe("effect handlers", () => {
	it("registers core effect handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);

		const expectedIds = [
			"build:interactive",
			"devtools:check",
			"devtools:lint",
			"devtools:rebuild",
			"reports:run-all",
			"health:show",
			"sitemap:export",
			"review:build",
			"review:test",
			"publish:build",
			"publish:test",
		];
		for (const id of expectedIds) {
			expect(registry.hasHandler(id), `Missing handler: ${id}`).toBe(true);
		}
	});

	it("devtools:check returns ok on success", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const handler = registry.getHandler("devtools:check");
		const ctx = makeCtx();
		const result = await handler(ctx);
		expect(result.kind).toBe("ok");
	});

	it("devtools:check returns error on failure", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const handler = registry.getHandler("devtools:check");
		const ctx = makeCtx();
		(ctx.deps.shell.run as ReturnType<typeof vi.fn>).mockReturnValue(1);
		const result = await handler(ctx);
		expect(result.kind).toBe("error");
	});

	it("build:interactive records pipeline state on success", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const handler = registry.getHandler("build:interactive");
		const ctx = makeCtx();
		await handler(ctx);
		expect(ctx.session.pipeline["buildPassed"]).toBe(true);
	});

	it("build:interactive records pipeline state on failure", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const handler = registry.getHandler("build:interactive");
		const ctx = makeCtx();
		(ctx.deps.shell.run as ReturnType<typeof vi.fn>).mockReturnValue(1);
		await handler(ctx);
		expect(ctx.session.pipeline["buildPassed"]).toBe(false);
	});

	it("health:show navigates to health page", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const result = await registry.getHandler("health:show")(makeCtx());
		expect(result).toEqual({ kind: "navigate", target: "health" });
	});

	it("effect handlers return error when no project selected", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const ctx = makeCtx({ project: undefined });
		const result = await registry.getHandler("build:interactive")(ctx);
		expect(result.kind).toBe("error");
	});
});
