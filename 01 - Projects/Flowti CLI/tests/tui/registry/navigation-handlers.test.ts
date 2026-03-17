vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerNavigationHandlers } from "../../../src/tui/registry/navigation-handlers.js";

describe("navigation handlers", () => {
	it("registers navigation handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerNavigationHandlers(registry);

		const expectedIds = [
			"project:open",
			"project:create",
			"agents:navigate-edit",
			"events:list",
			"lifecycle:project",
			"comp:add",
			"help:main",
			"info:show",
			"workspace:list",
		];
		for (const id of expectedIds) {
			expect(registry.hasHandler(id), `Missing handler: ${id}`).toBe(true);
		}
	});

	it("project:open navigates to projects-list", async () => {
		const registry = new TuiHandlerRegistry();
		registerNavigationHandlers(registry);
		const result = await registry.getHandler("project:open")({ deps: {} as never, session: { pipeline: {} } });
		expect(result).toEqual({ kind: "navigate", target: "projects-list" });
	});

	it("help:main navigates to help", async () => {
		const registry = new TuiHandlerRegistry();
		registerNavigationHandlers(registry);
		const result = await registry.getHandler("help:main")({ deps: {} as never, session: { pipeline: {} } });
		expect(result).toEqual({ kind: "navigate", target: "help" });
	});

	it("agents:navigate-edit passes agentId param", async () => {
		const registry = new TuiHandlerRegistry();
		registerNavigationHandlers(registry);
		const result = await registry.getHandler("agents:navigate-edit")({
			deps: {} as never,
			session: { pipeline: {} },
			params: { agentId: "scout" },
		});
		expect(result).toEqual({ kind: "navigate", target: "agent-detail", params: { agentId: "scout" } });
	});
});
