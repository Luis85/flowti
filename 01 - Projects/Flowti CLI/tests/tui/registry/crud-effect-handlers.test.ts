vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerCrudEffectHandlers } from "../../../src/tui/registry/crud-effect-handlers.js";
import type { TuiActionContext } from "../../../src/tui/registry/tui-handler-types.js";

function makeCtx(overrides?: Partial<TuiActionContext>): TuiActionContext {
	return {
		deps: {
			disk: { existsSync: vi.fn().mockReturnValue(false) },
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: { run: vi.fn().mockReturnValue(0) },
		} as never,
		session: { pipeline: {} },
		project: { name: "CLI", path: "/p" },
		...overrides,
	};
}

describe("crud effect handlers", () => {
	it("registers all expected handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);

		// Spot check key handler categories
		const spotChecks = [
			// RAID
			"raid:list", "raid:add-risk", "raid:add-assumption", "raid:add-issue", "raid:add-dependency", "raid:add-decision", "raid:update-status",
			// CAPA
			"capa:list", "capa:add-corrective", "capa:add-preventive", "capa:update-status",
			// Deliverables
			"deliverables:list", "deliverables:add", "deliverables:update-status",
			// Resources
			"resources:list", "resources:add-human", "resources:add-material", "resources:add-role", "resources:add-budget", "resources:financials",
			// Timelog
			"timelog:list", "timelog:add", "timelog:summary",
			// Requirements
			"req:list", "req:add-functional", "req:add-nonfunctional", "req:add-constraint", "req:add-usecase", "req:add-userstory", "req:update-status",
			// Capture
			"capture:idea", "capture:note", "capture:bug",
			// Agents
			"agents:add", "agents:remove", "agents:edit-identity", "agents:talk", "agents:assign-task",
			// Events
			"events:add", "events:flow",
			// Onboarding
			"onboarding:select-tour", "onboarding:skip-tour", "onboarding:continue",
			// Docs
			"docs:update-refs", "docs:dependencies",
			// Tooling
			"make:help", "reports:browse", "devtools:console", "devtools:npm-scripts", "devtools:reload",
			// Component
			"comp:regen-dirty", "comp:sb-install", "comp:sb-start", "comp:sb-stop", "comp:sb-build", "comp:data-providers", "comp:action-ref",
			// Workspace
			"workspace:inspect", "workspace:collect", "workspace:dispose", "workspace:prune",
			// Dashboard
			"agents:start-dashboard", "agents:rebuild-dashboard", "agents:stop-dashboard",
			// Project
			"project:manage-agents", "readme:show",
			// Review pipeline
			"review:e2e", "review:journey", "review:run-all", "review:list-journeys", "review:new-journey",
			"review:vault-create", "review:vault-open", "review:vault-teardown", "review:vault-rebuild",
			// Publish
			"publish:distribute", "publish:run-all",
			// Reports
			"reports:export-html",
			// Agent status
			"agent:status",
			// Lifecycle
			"lifecycle:features", "lifecycle:products",
		];
		for (const id of spotChecks) {
			expect(registry.hasHandler(id), `Missing handler: ${id}`).toBe(true);
		}
	});

	it("raid:list navigates to raid page", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("raid:list")(makeCtx());
		expect(result).toEqual({ kind: "navigate", target: "raid" });
	});

	it("capture:idea navigates with type param", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("capture:idea")(makeCtx());
		expect(result).toEqual({ kind: "navigate", target: "capture-add", params: { type: "idea" } });
	});

	it("agents:edit-identity passes agentId and field params", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const ctx = makeCtx({ params: { agentId: "scout" } });
		const result = await registry.getHandler("agents:edit-identity")(ctx);
		expect(result).toEqual({ kind: "navigate", target: "agent-edit", params: { agentId: "scout", field: "identity" } });
	});

	it("onboarding:skip-tour returns ok", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("onboarding:skip-tour")(makeCtx());
		expect(result.kind).toBe("ok");
	});

	it("docs:update-refs calls shell.run", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const ctx = makeCtx();
		const result = await registry.getHandler("docs:update-refs")(ctx);
		expect(result.kind).toBe("ok");
		expect(ctx.deps.shell.run).toHaveBeenCalled();
	});

	it("docs:update-refs returns error when no project", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const ctx = makeCtx({ project: undefined });
		const result = await registry.getHandler("docs:update-refs")(ctx);
		expect(result.kind).toBe("error");
	});

	it("review:run-all returns ok on success", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const ctx = makeCtx();
		const result = await registry.getHandler("review:run-all")(ctx);
		expect(result.kind).toBe("ok");
		expect(ctx.session.pipeline["review:buildPassed"]).toBe(true);
		expect(ctx.session.pipeline["review:testPassed"]).toBe(true);
	});

	it("review:run-all returns error on build failure", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const ctx = makeCtx();
		(ctx.deps.shell.run as ReturnType<typeof vi.fn>).mockReturnValue(1);
		const result = await registry.getHandler("review:run-all")(ctx);
		expect(result.kind).toBe("error");
		expect(ctx.session.pipeline["review:buildPassed"]).toBe(false);
	});

	it("devtools:console returns ok stub message", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("devtools:console")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Console not available in TUI" });
	});
});
