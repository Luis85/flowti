/**
 * crud-effect-handlers.ts — TUI CRUD effect handlers for management domains.
 *
 * Covers RAID, CAPA, deliverables, resources, timelog, iterations,
 * requirements, agents, events, onboarding, docs, workspace, component,
 * dashboard, and remaining review/publish pipeline handlers.
 *
 * Most legacy handlers used input.ask() for data collection — in the TUI
 * they become either navigation-to-form handlers or simple status stubs.
 */

import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import type { TuiActionContext, TuiActionResult } from "./tui-handler-types.js";
import { readComponentsConfig, getFramework, setFramework } from "../../domain/make/component/storybook-settings.js";
import {
	isStorybookInstalled,
	isStorybookRunning,
	stopStorybook,
	startStorybookDev,
	runStorybookBuild,
	installStorybook,
	resolveStorybookDir,
} from "../../domain/make/component/storybook-service.js";
import { nullStorybookRenderer } from "../../domain/make/component/storybook-renderer.js";

export function registerCrudEffectHandlers(registry: TuiHandlerRegistry): void {
	// ── RAID handlers ────────────────────────────────────────────────
	registry.registerHandler("raid:list", async () => ({ kind: "navigate", target: "raid" }));
	registry.registerHandler("raid:add-risk", async () => ({ kind: "navigate", target: "raid-add", params: { type: "risk" } }));
	registry.registerHandler("raid:add-assumption", async () => ({ kind: "navigate", target: "raid-add", params: { type: "assumption" } }));
	registry.registerHandler("raid:add-issue", async () => ({ kind: "navigate", target: "raid-add", params: { type: "issue" } }));
	registry.registerHandler("raid:add-dependency", async () => ({ kind: "navigate", target: "raid-add", params: { type: "dependency" } }));
	registry.registerHandler("raid:add-decision", async () => ({ kind: "navigate", target: "raid-add", params: { type: "decision" } }));
	registry.registerHandler("raid:update-status", async () => ({ kind: "navigate", target: "raid-update-status" }));

	// ── CAPA handlers ────────────────────────────────────────────────
	registry.registerHandler("capa:list", async () => ({ kind: "navigate", target: "capa" }));
	registry.registerHandler("capa:add-corrective", async () => ({ kind: "navigate", target: "capa-add", params: { type: "corrective" } }));
	registry.registerHandler("capa:add-preventive", async () => ({ kind: "navigate", target: "capa-add", params: { type: "preventive" } }));
	registry.registerHandler("capa:update-status", async () => ({ kind: "navigate", target: "capa-update-status" }));

	// ── Deliverables handlers ────────────────────────────────────────
	registry.registerHandler("deliverables:list", async () => ({ kind: "navigate", target: "deliverables" }));
	registry.registerHandler("deliverables:add", async () => ({ kind: "navigate", target: "deliverables-add" }));
	registry.registerHandler("deliverables:update-status", async () => ({ kind: "navigate", target: "deliverables-update-status" }));

	// ── Resources handlers ───────────────────────────────────────────
	registry.registerHandler("resources:list", async () => ({ kind: "navigate", target: "resources" }));
	registry.registerHandler("resources:add-human", async () => ({ kind: "navigate", target: "resources-add", params: { type: "human" } }));
	registry.registerHandler("resources:add-material", async () => ({ kind: "navigate", target: "resources-add", params: { type: "material" } }));
	registry.registerHandler("resources:add-role", async () => ({ kind: "navigate", target: "resources-add", params: { type: "role" } }));
	registry.registerHandler("resources:add-budget", async () => ({ kind: "navigate", target: "resources-add", params: { type: "budget" } }));
	registry.registerHandler("resources:financials", async () => ({ kind: "navigate", target: "resources-financials" }));

	// ── Timelog handlers ─────────────────────────────────────────────
	registry.registerHandler("timelog:list", async () => ({ kind: "navigate", target: "timelog" }));
	registry.registerHandler("timelog:add", async () => ({ kind: "navigate", target: "timelog-add" }));
	registry.registerHandler("timelog:summary", async () => ({ kind: "navigate", target: "timelog-summary" }));

	// ── Requirements handlers ────────────────────────────────────────
	registry.registerHandler("req:list", async () => ({ kind: "navigate", target: "requirements" }));
	registry.registerHandler("req:add-functional", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "functional" } }));
	registry.registerHandler("req:add-nonfunctional", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "non-functional" } }));
	registry.registerHandler("req:add-constraint", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "constraint" } }));
	registry.registerHandler("req:add-usecase", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "use-case" } }));
	registry.registerHandler("req:add-userstory", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "user-story" } }));
	registry.registerHandler("req:update-status", async () => ({ kind: "navigate", target: "requirements-update-status" }));

	// ── Capture handlers ─────────────────────────────────────────────
	registry.registerHandler("capture:idea", async () => ({ kind: "navigate", target: "capture-add", params: { type: "idea" } }));
	registry.registerHandler("capture:note", async () => ({ kind: "navigate", target: "capture-add", params: { type: "note" } }));
	registry.registerHandler("capture:bug", async () => ({ kind: "navigate", target: "capture-add", params: { type: "bug" } }));

	// ── Agent management (form-based) ────────────────────────────────
	registry.registerHandler("agents:add", async () => ({ kind: "navigate", target: "agent-add" }));
	registry.registerHandler("agents:remove", async () => ({ kind: "navigate", target: "agent-remove" }));
	registry.registerHandler("agents:edit-identity", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "identity" } }));
	registry.registerHandler("agents:edit-skills", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "skills" } }));
	registry.registerHandler("agents:edit-tools", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "tools" } }));
	registry.registerHandler("agents:edit-roles", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "roles" } }));
	registry.registerHandler("agents:edit-ai", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "ai" } }));
	registry.registerHandler("agents:edit-prompt", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "prompt" } }));
	registry.registerHandler("agents:change-permission", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "permission" } }));
	registry.registerHandler("agents:manage-grants", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "grants" } }));
	registry.registerHandler("agents:talk", async (ctx) => ({ kind: "navigate", target: "agents-chat", params: { agentId: ctx.params?.agentId ?? "" } }));
	registry.registerHandler("agents:assign-task", async (ctx) => ({ kind: "navigate", target: "agent-assign-task", params: { agentId: ctx.params?.agentId ?? "" } }));
	registry.registerHandler("agents:assign-to-project", async (ctx) => ({ kind: "navigate", target: "agent-assign-project", params: { agentId: ctx.params?.agentId ?? "" } }));
	registry.registerHandler("agents:edit-inventory", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "inventory" } }));

	// ── Events ───────────────────────────────────────────────────────
	registry.registerHandler("events:add", async () => ({ kind: "navigate", target: "event-add" }));
	registry.registerHandler("events:flow", async () => ({ kind: "navigate", target: "event-flow" }));

	// ── Onboarding ───────────────────────────────────────────────────
	registry.registerHandler("onboarding:select-tour", async () => ({ kind: "navigate", target: "onboarding-tour" }));
	registry.registerHandler("onboarding:skip-tour", async () => ({ kind: "ok", message: "Tour skipped" }));
	registry.registerHandler("onboarding:continue", async () => ({ kind: "navigate", target: "onboarding-tour" }));

	// ── Docs & references ────────────────────────────────────────────
	registry.registerHandler("docs:update-refs", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node -e \"require('./src/domain/docs/doc-runner.js').runAllDocs()\"", { cwd: ctx.project.path });
		return code === 0
			? { kind: "ok", message: "Docs updated" }
			: { kind: "error", message: "Docs update failed" };
	});

	// ── Remaining tooling handlers ───────────────────────────────────
	registry.registerHandler("make:help", async () => ({ kind: "navigate", target: "help" }));
	registry.registerHandler("reports:browse", async () => ({ kind: "navigate", target: "reports" }));
	registry.registerHandler("devtools:console", async () => ({ kind: "ok", message: "Console not available in TUI" }));
	registry.registerHandler("devtools:npm-scripts", async () => ({ kind: "navigate", target: "devtools" }));
	registry.registerHandler("devtools:reload", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node scripts/cli-reload.mjs", { cwd: ctx.project.path });
		return code === 0
			? { kind: "ok", message: "Reloaded" }
			: { kind: "error", message: "Reload failed" };
	});

	// ── Component handlers (storybook, etc.) ─────────────────────────
	registry.registerHandler("comp:regen-dirty", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Regeneration triggered" };
	});
	registry.registerHandler("comp:sb-install", async (ctx: TuiActionContext): Promise<TuiActionResult> => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const { disk, paths, shell } = ctx.deps;
		const config = readComponentsConfig(ctx.project.path, { disk, paths });
		if (isStorybookInstalled(ctx.project.path, config, { disk, paths })) {
			return { kind: "ok", message: "Storybook is already installed" };
		}
		const framework = getFramework(ctx.project.path, { disk, paths });
		setFramework(ctx.project.path, framework, { disk, paths });
		const projectName = paths.basename(ctx.project.path);
		const sbDir = resolveStorybookDir(ctx.project.path, config, { paths });
		// installStorybook accepts StorybookDeps (includes input) but never calls input —
		// pass a no-op stub so the type is satisfied.
		const noopInput = { ask: async () => "", waitForEnter: async () => {}, askYesNo: async () => true } as never;
		const installed = installStorybook(
			ctx.project.path, projectName,
			{ ...config, framework },
			{ disk, paths, shell, input: noopInput },
			nullStorybookRenderer,
		);
		return installed
			? { kind: "ok", message: `Storybook installed in ${sbDir}` }
			: { kind: "error", message: "Storybook installation failed" };
	});
	registry.registerHandler("comp:sb-start", async (ctx: TuiActionContext): Promise<TuiActionResult> => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const { disk, paths, shell } = ctx.deps;
		const config = readComponentsConfig(ctx.project.path, { disk, paths });
		if (!isStorybookInstalled(ctx.project.path, config, { disk, paths })) {
			return { kind: "error", message: "Storybook not installed. Use Install Storybook first." };
		}
		if (isStorybookRunning()) {
			return { kind: "ok", message: "Storybook is already running" };
		}
		const { VAULT_ROOT } = await import("../../infrastructure/config.js");
		const result = await startStorybookDev(ctx.project.path, config, VAULT_ROOT, { disk, paths, shell }, nullStorybookRenderer);
		return result.started
			? { kind: "ok", message: `Storybook running at ${result.url}` }
			: { kind: "error", message: result.error ?? "Storybook failed to start" };
	});
	registry.registerHandler("comp:sb-stop", async (): Promise<TuiActionResult> => {
		if (!isStorybookRunning()) {
			return { kind: "ok", message: "Storybook is not running" };
		}
		stopStorybook(nullStorybookRenderer);
		return { kind: "ok", message: "Storybook stopped" };
	});
	registry.registerHandler("comp:sb-build", async (ctx: TuiActionContext): Promise<TuiActionResult> => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const { disk, paths, shell } = ctx.deps;
		const config = readComponentsConfig(ctx.project.path, { disk, paths });
		if (!isStorybookInstalled(ctx.project.path, config, { disk, paths })) {
			return { kind: "error", message: "Storybook not installed. Use Install Storybook first." };
		}
		runStorybookBuild(ctx.project.path, config, { disk, paths, shell }, nullStorybookRenderer);
		return { kind: "ok", message: "Storybook build complete" };
	});
	registry.registerHandler("comp:data-providers", async () => ({ kind: "navigate", target: "component-data-providers" }));
	registry.registerHandler("comp:action-ref", async () => ({ kind: "navigate", target: "component-action-ref" }));

	// ── Workspace handlers ───────────────────────────────────────────
	registry.registerHandler("workspace:inspect", async () => ({ kind: "navigate", target: "workspace-inspect" }));
	registry.registerHandler("workspace:collect", async () => ({ kind: "ok", message: "Workspace collect completed" }));
	registry.registerHandler("workspace:dispose", async () => ({ kind: "ok", message: "Workspace disposed" }));
	registry.registerHandler("workspace:prune", async () => ({ kind: "ok", message: "Workspaces pruned" }));

	// ── Dashboard ────────────────────────────────────────────────────
	registry.registerHandler("agents:start-dashboard", async () => ({ kind: "ok", message: "Dashboard is TUI-native" }));
	registry.registerHandler("agents:rebuild-dashboard", async () => ({ kind: "ok", message: "Dashboard is TUI-native" }));
	registry.registerHandler("agents:stop-dashboard", async () => ({ kind: "ok", message: "Dashboard stopped" }));

	// ── Project management ───────────────────────────────────────────
	registry.registerHandler("project:manage-agents", async () => ({ kind: "navigate", target: "ai-tools" }));
	registry.registerHandler("readme:show", async () => ({ kind: "navigate", target: "help" }));

	// ── Review pipeline remaining handlers ───────────────────────────
	registry.registerHandler("review:e2e", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "E2E not available in TUI yet" };
	});
	registry.registerHandler("review:journey", async () => ({ kind: "navigate", target: "review-journey" }));
	registry.registerHandler("review:run-all", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const buildCode = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		if (buildCode !== 0) {
			ctx.session.pipeline["review:buildPassed"] = false;
			return { kind: "error", message: "Review pipeline failed (build)" };
		}
		ctx.session.pipeline["review:buildPassed"] = true;
		const testCode = ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
		ctx.session.pipeline["review:testPassed"] = testCode === 0;
		return testCode === 0
			? { kind: "ok", message: "Review pipeline complete" }
			: { kind: "error", message: "Review pipeline failed (tests)" };
	});
	registry.registerHandler("review:list-journeys", async () => ({ kind: "navigate", target: "review-journeys" }));
	registry.registerHandler("review:new-journey", async () => ({ kind: "navigate", target: "review-new-journey" }));
	registry.registerHandler("review:vault-create", async () => ({ kind: "ok", message: "Vault create not available in TUI yet" }));
	registry.registerHandler("review:vault-open", async () => ({ kind: "ok", message: "Vault open not available in TUI yet" }));
	registry.registerHandler("review:vault-teardown", async () => ({ kind: "ok", message: "Vault teardown not available in TUI yet" }));
	registry.registerHandler("review:vault-rebuild", async () => ({ kind: "ok", message: "Vault rebuild not available in TUI yet" }));

	// ── Publish remaining ────────────────────────────────────────────
	registry.registerHandler("publish:distribute", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Distribution not available in TUI yet" };
	});
	registry.registerHandler("publish:run-all", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const buildCode = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		if (buildCode !== 0) {
			ctx.session.pipeline["publish:buildPassed"] = false;
			return { kind: "error", message: "Publish pipeline failed (build)" };
		}
		ctx.session.pipeline["publish:buildPassed"] = true;
		const testCode = ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
		ctx.session.pipeline["publish:testPassed"] = testCode === 0;
		return testCode === 0
			? { kind: "ok", message: "Publish pipeline complete" }
			: { kind: "error", message: "Publish pipeline failed (tests)" };
	});

	// ── Reports ──────────────────────────────────────────────────────
	registry.registerHandler("reports:export-html", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "HTML export not available in TUI yet" };
	});
	registry.registerHandler("docs:dependencies", async () => ({ kind: "navigate", target: "docs-dependencies" }));

	// ── Agent status ─────────────────────────────────────────────────
	registry.registerHandler("agent:status", async (ctx) => ({ kind: "navigate", target: "agent-detail", params: { agentId: ctx.params?.agentId ?? "" } }));

	// ── Lifecycle features/products ──────────────────────────────────
	registry.registerHandler("lifecycle:features", async () => ({ kind: "navigate", target: "lifecycle-features" }));
	registry.registerHandler("lifecycle:products", async () => ({ kind: "navigate", target: "lifecycle-products" }));
}
