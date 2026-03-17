vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	findCurrentIteration: vi.fn().mockReturnValue(null),
}));
vi.mock("../../../src/domain/knowledgebase/knowledgebase.js", () => ({
	isKnowledgebaseAvailable: vi.fn().mockReturnValue(false),
}));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerConditionHandlers } from "../../../src/tui/registry/condition-handlers.js";
import type { TuiActionContext } from "../../../src/tui/registry/tui-handler-types.js";

function makeCtx(overrides?: Partial<TuiActionContext>): TuiActionContext {
	return {
		deps: {
			disk: { existsSync: vi.fn().mockReturnValue(false) },
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: { run: vi.fn(), execFile: vi.fn() },
		} as never,
		session: { pipeline: {} },
		project: { name: "CLI", path: "/p" },
		...overrides,
	};
}

describe("condition handlers", () => {
	it("registers all 10 condition handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerConditionHandlers(registry);

		const expectedIds = [
			"no-project-selected",
			"knowledgebase:available",
			"readme:exists",
			"iteration:running",
			"iteration:not-running",
			"iteration:not-planned",
			"iteration:cannot-advance",
			"iteration:not-in-review",
			"agents:dashboard-running",
			"agents:dashboard-not-running",
		];
		for (const id of expectedIds) {
			expect(registry.hasCondition(id), `Missing condition: ${id}`).toBe(true);
		}
	});

	it("no-project-selected returns true when no project", () => {
		const registry = new TuiHandlerRegistry();
		registerConditionHandlers(registry);
		const fn = registry.getCondition("no-project-selected");
		expect(fn(makeCtx({ project: undefined }))).toBe(true);
	});

	it("no-project-selected returns false when project set", () => {
		const registry = new TuiHandlerRegistry();
		registerConditionHandlers(registry);
		const fn = registry.getCondition("no-project-selected");
		expect(fn(makeCtx())).toBe(false);
	});

	it("agents:dashboard-running returns false (stubbed)", () => {
		const registry = new TuiHandlerRegistry();
		registerConditionHandlers(registry);
		const fn = registry.getCondition("agents:dashboard-running");
		expect(fn(makeCtx())).toBe(false);
	});

	it("agents:dashboard-not-running returns true (stubbed)", () => {
		const registry = new TuiHandlerRegistry();
		registerConditionHandlers(registry);
		const fn = registry.getCondition("agents:dashboard-not-running");
		expect(fn(makeCtx())).toBe(true);
	});
});
