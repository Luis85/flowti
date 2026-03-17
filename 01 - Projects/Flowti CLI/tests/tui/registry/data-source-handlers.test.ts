vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerDataSourceHandlers } from "../../../src/tui/registry/data-source-handlers.js";
import type { TuiActionContext } from "../../../src/tui/registry/tui-handler-types.js";

function makeCtx(overrides?: Partial<TuiActionContext>): TuiActionContext {
	return {
		deps: {
			disk: { existsSync: vi.fn().mockReturnValue(false) },
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: { run: vi.fn() },
		} as never,
		session: { pipeline: {} },
		project: { name: "CLI", path: "/p" },
		...overrides,
	};
}

describe("data source handlers", () => {
	it("registers all data source handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerDataSourceHandlers(registry);

		const expectedIds = [
			"agents:list",
			"inbox:agent-notes",
			"make:templates",
			"reports:generators",
		];
		for (const id of expectedIds) {
			expect(registry.hasDataSource(id), `Missing data source: ${id}`).toBe(true);
		}
	});

	it("agents:list returns empty array when no project", () => {
		const registry = new TuiHandlerRegistry();
		registerDataSourceHandlers(registry);
		const ds = registry.getDataSource("agents:list");
		const result = ds(makeCtx({ project: undefined }));
		expect(result).toEqual([]);
	});

	it("inbox:agent-notes returns empty array when dir not found", () => {
		const registry = new TuiHandlerRegistry();
		registerDataSourceHandlers(registry);
		const ds = registry.getDataSource("inbox:agent-notes");
		const result = ds(makeCtx());
		expect(result).toEqual([]);
	});
});
