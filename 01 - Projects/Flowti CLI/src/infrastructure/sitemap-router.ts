/**
 * sitemap-router.ts — Navigation engine that drives the CLI from sitemap.json (v2).
 *
 * Maintains a view stack (like browser history) and resolves pages from the
 * v2 PageObject sitemap. Builds MenuEntry[] from PageAction[] with auto-key
 * assignment and group-based separators. Supports data sources for dynamic
 * content injection and form page navigation.
 */

import { runMenu, insertGroupSeparators } from "./menu.js";
import { interpolate } from "./context-provider.js";
import { resolveDisabledCondition, resolveHiddenCondition } from "./sitemap-conditions.js";
import { assignKeys } from "./key-assigner.js";
import { input } from "./input.js";
import { log } from "./logger.js";
import { RESET, RED, YELLOW } from "./ui.js";
import type { MenuEntry, MenuResult, ProjectContext } from "./types.js";
import type { CliDeps } from "./deps.js";
import type { Sitemap, PageObject, PageAction, RouterContext, StackEntry } from "./sitemap-types.js";
import type { HandlerRegistry } from "./handler-registry.js";
import type { CommandRegistry } from "./command-registry.js";

// ── Router ──────────────────────────────────────────────────────────

export interface SitemapRouterDeps {
	readonly sitemap: Sitemap;
	readonly handlers: HandlerRegistry;
	readonly commands: CommandRegistry;
	readonly deps: CliDeps;
	readonly getProject: () => ProjectContext | undefined;
	readonly getTools: () => Record<string, boolean> | undefined;
	readonly onProjectSelected: () => void;
	readonly onProjectCleared: () => void;
}

export class SitemapRouter {
	readonly #sitemap: Sitemap;
	readonly #handlers: HandlerRegistry;
	readonly #commands: CommandRegistry;
	readonly #deps: CliDeps;
	readonly #getProject: () => ProjectContext | undefined;
	readonly #getTools: () => Record<string, boolean> | undefined;
	readonly #onProjectSelected: () => void;
	readonly #onProjectCleared: () => void;
	#sitemapRef: Sitemap;

	constructor(routerDeps: SitemapRouterDeps) {
		this.#sitemap = routerDeps.sitemap;
		this.#sitemapRef = routerDeps.sitemap;
		this.#handlers = routerDeps.handlers;
		this.#commands = routerDeps.commands;
		this.#deps = routerDeps.deps;
		this.#getProject = routerDeps.getProject;
		this.#getTools = routerDeps.getTools;
		this.#onProjectSelected = routerDeps.onProjectSelected;
		this.#onProjectCleared = routerDeps.onProjectCleared;
	}

	/** Hot-swap sitemap definitions (called by SitemapWatcher). */
	updateSitemap(sitemap: Sitemap): void {
		this.#sitemapRef = sitemap;
	}

	/** Run the interactive router loop starting from the given view. */
	async run(startViewId: string): Promise<void> {
		const stack: StackEntry[] = [{ viewId: startViewId }];

		while (stack.length > 0) {
			const current = stack[stack.length - 1];
			const page = this.#sitemapRef.pages[current.viewId];

			if (!page) {
				log(`\n  ${RED}Unknown page: "${current.viewId}"${RESET}\n`);
				stack.pop();
				continue;
			}

			const ctx = this.#buildContext(current.params);

			if (page.context?.includes("project") && !ctx.project) {
				log(`\n  ${YELLOW}No project selected — returning to previous view.${RESET}\n`);
				stack.pop();
				continue;
			}

			const result = this.#handlers.hasView(current.viewId)
				? await this.#runDynamicPage(current.viewId, page, ctx)
				: await this.#runStaticPage(page, ctx);

			const shouldReturn = this.#applyResult(result, stack, startViewId);
			if (shouldReturn) return;
		}
	}

	// ── Result interpretation ────────────────────────────────────────

	#applyResult(result: MenuResult, stack: StackEntry[], startViewId: string): boolean {
		if (typeof result === "string" && result.startsWith("navigate:")) {
			pushOrReplace(stack, parseNavigateResult(result));
			return false;
		}
		if (result === "refresh") return false; // re-render current page (don't pop stack)
		if (result === "quit") return true;
		if (result === "start") {
			stack.length = 0;
			stack.push({ viewId: startViewId });
			this.#onProjectCleared();
			return false;
		}
		this.#popAndRecover(stack, startViewId);
		return false;
	}

	#popAndRecover(stack: StackEntry[], startViewId: string): void {
		stack.pop();
		// Auto-navigate: if a project was just selected and we're back at
		// the start view (or stack is empty), push project-detail.
		if (this.#getProject() && (stack.length === 0 || stack[stack.length - 1].viewId === startViewId)) {
			if (this.#sitemapRef.pages["project-detail"]) {
				this.#onProjectSelected();
				stack.push({ viewId: "project-detail" });
			}
		}
		// Never let the stack empty out — re-push the start view.
		if (stack.length === 0) {
			stack.push({ viewId: startViewId });
		}
	}

	// ── Dynamic page rendering ──────────────────────────────────────

	async #runDynamicPage(pageId: string, page: PageObject, ctx: RouterContext): Promise<MenuResult> {
		const handler = this.#handlers.getView(pageId);

		// Resolve data sources for the view handler
		const dataSourceEntries = this.#resolveDataSources(page, ctx);

		// Build action entries for the handler to use
		const actionEntries = this.#buildActionEntries(page, ctx);

		const viewCtx: RouterContext = {
			...ctx,
			dataSourceEntries: {
				...dataSourceEntries,
				_actions: actionEntries,
			},
		};

		if (page.onBeforeRender && this.#handlers.hasBeforeRender(page.onBeforeRender)) {
			this.#handlers.getBeforeRender(page.onBeforeRender)(viewCtx);
		}

		return handler(viewCtx);
	}

	// ── Static page rendering ────────────────────────────────────────

	async #runStaticPage(page: PageObject, ctx: RouterContext): Promise<MenuResult> {
		let navigationTarget: StackEntry | null = null;
		const onNav = (target: string, params?: Readonly<Record<string, unknown>>) => {
			navigationTarget = { viewId: target, ...(params ? { params } : {}) };
		};

		// Resolve data sources first
		const dsEntries = this.#resolveDataSourceEntries(page, ctx);

		// Build action entries
		const actionEntries = this.#buildMenuEntries(page, ctx, onNav);

		// Combine: data sources first, then actions
		const allEntries = [...dsEntries, ...actionEntries];

		const title = interpolate(page.label, ctx);
		const beforeMenu = page.onBeforeRender && this.#handlers.hasBeforeRender(page.onBeforeRender)
			? () => this.#handlers.getBeforeRender(page.onBeforeRender!)(ctx)
			: undefined;

		const result = await runMenu(title, allEntries, { beforeMenu });

		const nav = navigationTarget as StackEntry | null;
		if (nav) {
			const paramsSuffix = nav.params ? `?${JSON.stringify(nav.params)}` : "";
			return `navigate:${nav.viewId}${paramsSuffix}` as MenuResult;
		}

		return result;
	}

	// ── Data source resolution ───────────────────────────────────────

	#resolveDataSources(page: PageObject, ctx: RouterContext): Record<string, readonly MenuEntry[]> {
		const result: Record<string, MenuEntry[]> = {};
		if (!page.dataSources) return result;

		for (const ds of page.dataSources) {
			const key = ds.slot ?? ds.id;
			if (this.#handlers.hasDataSource(ds.id)) {
				result[key] = this.#handlers.getDataSource(ds.id)(ctx, ds.params);
			}
		}

		return result;
	}

	#resolveDataSourceEntries(page: PageObject, ctx: RouterContext): MenuEntry[] {
		if (!page.dataSources) return [];
		const entries: MenuEntry[] = [];

		for (const ds of page.dataSources) {
			if (this.#handlers.hasDataSource(ds.id)) {
				entries.push(...this.#handlers.getDataSource(ds.id)(ctx, ds.params));
			}
			entries.push({ separator: true });
		}

		return entries;
	}

	// ── Action entry building ────────────────────────────────────────

	#visibleActions(page: PageObject, ctx: RouterContext): readonly PageAction[] {
		return page.actions.filter((action) => {
			if (action.hidden === undefined) return true;
			return !resolveHiddenCondition(action.hidden, ctx, this.#handlers);
		});
	}

	#buildActionEntries(page: PageObject, ctx: RouterContext): MenuEntry[] {
		const keyed = assignKeys(this.#visibleActions(page, ctx));
		const entries: MenuEntry[] = [];
		for (const { action, assignedKey } of keyed) {
			entries.push(this.#actionToMenuEntry(action, assignedKey, ctx, () => {}));
		}
		return insertGroupSeparators(entries);
	}

	#buildMenuEntries(
		page: PageObject,
		ctx: RouterContext,
		onNavigate: (target: string, params?: Readonly<Record<string, unknown>>) => void,
	): MenuEntry[] {
		const keyed = assignKeys(this.#visibleActions(page, ctx));
		const entries: MenuEntry[] = [];
		for (const { action, assignedKey } of keyed) {
			entries.push(this.#actionToMenuEntry(action, assignedKey, ctx, onNavigate));
		}
		return insertGroupSeparators(entries);
	}

	#actionToMenuEntry(
		action: PageAction,
		key: string,
		ctx: RouterContext,
		onNavigate: (target: string, params?: Readonly<Record<string, unknown>>) => void,
	): MenuEntry {
		const label = interpolate(action.label, ctx);
		const disabled = action.disabled !== undefined
			? () => resolveDisabledCondition(action.disabled, ctx, this.#handlers)
			: undefined;

		return {
			key,
			label,
			disabled,
			disabledMessage: action.disabledMessage ? `\n  ${action.disabledMessage}\n` : undefined,
			group: action.group,
			action: this.#buildAction(action, ctx, onNavigate),
		};
	}

	#buildAction(
		action: PageAction,
		ctx: RouterContext,
		onNavigate: (target: string, params?: Readonly<Record<string, unknown>>) => void,
	): () => MenuResult | Promise<MenuResult> {
		switch (action.type) {
			case "navigate":
				return () => {
					onNavigate(action.target!, action.params);
					const paramsSuffix = action.params ? `?${JSON.stringify(action.params)}` : "";
					return `navigate:${action.target}${paramsSuffix}` as MenuResult;
				};

			case "signal":
				switch (action.target) {
					case "quit": return () => "quit" as MenuResult;
					case "start": return () => "start" as MenuResult;
					case "back": return () => "main" as MenuResult;
					default: return () => undefined;
				}

			case "command":
				return async () => {
					const handler = this.#commands.handlers[action.target!];
					if (!handler) {
						log(`\n  ${RED}Unknown command: "${action.target}"${RESET}\n`);
						await input.waitForEnter();
						return undefined;
					}
					await handler({}, [], action.target!, ctx.project);
					await input.waitForEnter();
					return undefined;
				};

			case "handler":
				return async () => {
					const handler = this.#handlers.getAction(action.target!);
					const result = await handler(ctx) as string | undefined;
					if (result && (result === "quit" || result === "start" || result === "main" || result.startsWith("navigate:"))) {
						return result as MenuResult;
					}
					return undefined;
				};

			case "form":
				return async () => {
					const formPageId = action.target!;
					const formPage = this.#sitemapRef.pages[formPageId];
					if (!formPage || !formPage.fields) {
						log(`\n  ${RED}Form page not found or has no fields: "${formPageId}"${RESET}\n`);
						return undefined;
					}
					const { runForm } = await import("./form-runner.js");
					const formResult = await runForm(formPage.fields, formPage.validation, {
						input: ctx.deps.input,
						log: ctx.deps.log,
					});
					if (!formResult) return undefined;
					// Call the form's submit handler if registered
					const submitAction = formPage.actions.find((a) => a.name === "onSubmit");
					if (submitAction?.target && this.#handlers.hasFormHandler(submitAction.target)) {
						await this.#handlers.getFormHandler(submitAction.target)({ ...ctx, formData: formResult });
					} else if (submitAction?.target && this.#handlers.hasAction(submitAction.target)) {
						await this.#handlers.getAction(submitAction.target)({ ...ctx, params: { ...ctx.params, formData: formResult } });
					}
					return undefined;
				};
		}
	}

	// ── Context building ────────────────────────────────────────────

	#buildContext(params?: Readonly<Record<string, unknown>>): RouterContext {
		return {
			deps: this.#deps,
			project: this.#getProject(),
			tools: this.#getTools(),
			...(params ? { params } : {}),
		};
	}
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Parse `"navigate:viewId"` or `"navigate:viewId?json-params"` into a StackEntry.
 *
 * Params format: `navigate:component-detail?{"componentId":"btn-1"}`
 */
/** Push a navigate entry, replacing the top if it targets the same page (avoids duplicates). */
function pushOrReplace(stack: StackEntry[], entry: StackEntry): void {
	if (stack.length > 0 && stack[stack.length - 1].viewId === entry.viewId) {
		stack[stack.length - 1] = entry;
	} else {
		stack.push(entry);
	}
}

export function parseNavigateResult(result: string): StackEntry {
	const payload = result.slice("navigate:".length);
	const qIdx = payload.indexOf("?");
	if (qIdx === -1) return { viewId: payload };
	const viewId = payload.slice(0, qIdx);
	try {
		const params = JSON.parse(payload.slice(qIdx + 1)) as Record<string, unknown>;
		return { viewId, params };
	} catch {
		return { viewId };
	}
}

/**
 * Build a `"navigate:viewId?params"` string for use as a `MenuResult`.
 *
 * Handlers that need parameterized navigation can return:
 * `navigateWithParams("component-detail", { componentId: "btn-1" }) as MenuResult`
 */
export function navigateWithParams(viewId: string, params?: Record<string, unknown>): string {
	if (!params) return `navigate:${viewId}`;
	return `navigate:${viewId}?${JSON.stringify(params)}`;
}
