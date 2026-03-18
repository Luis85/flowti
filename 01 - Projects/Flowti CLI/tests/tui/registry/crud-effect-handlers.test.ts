vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/test-vault",
	CLI_PROJECT: "/test-vault/01 - Projects/Flowti CLI",
	PROJECTS_DIR: "/test-vault/01 - Projects",
	PLUGIN_ROOT: "/test-vault/Development/flowti",
	cliConfig: {},
	loadJson: () => null,
}));
vi.mock("../../../src/domain/make/component/storybook-settings.js", () => ({
	readComponentsConfig: vi.fn().mockReturnValue({}),
	getFramework: vi.fn().mockReturnValue("react"),
	setFramework: vi.fn(),
}));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	isStorybookInstalled: vi.fn().mockReturnValue(false),
	isStorybookRunning: vi.fn().mockReturnValue(false),
	stopStorybook: vi.fn(),
	startStorybookDev: vi.fn().mockResolvedValue({ started: true, url: "http://localhost:6006" }),
	runStorybookBuild: vi.fn(),
	installStorybook: vi.fn().mockReturnValue(true),
	resolveStorybookDir: vi.fn().mockReturnValue(".storybook"),
}));
vi.mock("../../../src/domain/make/component/storybook-renderer.js", () => ({
	nullStorybookRenderer: {},
}));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerCrudEffectHandlers } from "../../../src/tui/registry/crud-effect-handlers.js";
import type { TuiActionContext } from "../../../src/tui/registry/tui-handler-types.js";

function makeCtx(overrides?: Partial<TuiActionContext>): TuiActionContext {
	return {
		deps: {
			disk: { existsSync: vi.fn().mockReturnValue(false) },
			paths: { join: (...a: string[]) => a.join("/"), basename: (p: string) => p.split("/").pop() ?? "" },
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

	// ── Storybook handler tests ──────────────────────────────────────

	it("comp:sb-install returns error when no project", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-install")(makeCtx({ project: undefined }));
		expect(result).toEqual({ kind: "error", message: "No project selected" });
	});

	it("comp:sb-install reports already installed when storybook exists", async () => {
		const { isStorybookInstalled } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-install")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Storybook is already installed" });
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
	});

	it("comp:sb-install calls installStorybook and returns ok on success", async () => {
		const { isStorybookInstalled, installStorybook } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(installStorybook as ReturnType<typeof vi.fn>).mockReturnValue(true);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-install")(makeCtx());
		expect(result.kind).toBe("ok");
		expect(installStorybook).toHaveBeenCalled();
	});

	it("comp:sb-install returns error on installation failure", async () => {
		const { isStorybookInstalled, installStorybook } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(installStorybook as ReturnType<typeof vi.fn>).mockReturnValue(false);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-install")(makeCtx());
		expect(result).toEqual({ kind: "error", message: "Storybook installation failed" });
		(installStorybook as ReturnType<typeof vi.fn>).mockReturnValue(true);
	});

	it("comp:sb-start returns error when not installed", async () => {
		const { isStorybookInstalled } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-start")(makeCtx());
		expect(result).toEqual({ kind: "error", message: "Storybook not installed. Use Install Storybook first." });
	});

	it("comp:sb-start returns ok when already running", async () => {
		const { isStorybookInstalled, isStorybookRunning } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(true);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-start")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Storybook is already running" });
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(false);
	});

	it("comp:sb-start calls startStorybookDev and returns url on success", async () => {
		const { isStorybookInstalled, isStorybookRunning, startStorybookDev } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(startStorybookDev as ReturnType<typeof vi.fn>).mockResolvedValue({ started: true, url: "http://localhost:6006" });
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-start")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Storybook running at http://localhost:6006" });
		expect(startStorybookDev).toHaveBeenCalled();
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(false);
	});

	it("comp:sb-stop returns ok when not running", async () => {
		const { isStorybookRunning } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(false);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-stop")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Storybook is not running" });
	});

	it("comp:sb-stop calls stopStorybook when running", async () => {
		const { isStorybookRunning, stopStorybook } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(true);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-stop")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Storybook stopped" });
		expect(stopStorybook).toHaveBeenCalled();
		(isStorybookRunning as ReturnType<typeof vi.fn>).mockReturnValue(false);
	});

	it("comp:sb-build returns error when not installed", async () => {
		const { isStorybookInstalled } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-build")(makeCtx());
		expect(result).toEqual({ kind: "error", message: "Storybook not installed. Use Install Storybook first." });
	});

	it("comp:sb-build calls runStorybookBuild when installed", async () => {
		const { isStorybookInstalled, runStorybookBuild } = await import("../../../src/domain/make/component/storybook-service.js");
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);
		const result = await registry.getHandler("comp:sb-build")(makeCtx());
		expect(result).toEqual({ kind: "ok", message: "Storybook build complete" });
		expect(runStorybookBuild).toHaveBeenCalled();
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
	});
});
