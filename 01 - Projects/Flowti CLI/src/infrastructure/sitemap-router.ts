/**
 * sitemap-router.ts — Navigation engine that drives the CLI from sitemap.json.
 *
 * Maintains a view stack (like browser history) and resolves views from the
 * sitemap definition. Static views are converted to MenuEntry[] and delegated
 * to the existing runMenu() engine. Dynamic views call registered ViewHandlers.
 */

import { runMenu } from "./menu.js";
import { interpolate } from "./context-provider.js";
import { resolveDisabledCondition, resolveHiddenCondition } from "./sitemap-conditions.js";
import { input } from "./input.js";
import { log } from "./logger.js";
import { RESET, RED, YELLOW } from "./ui.js";
import type { MenuEntry, MenuResult, ProjectContext } from "./types.js";
import type { CliDeps } from "./deps.js";
import type {
	Sitemap,
	StaticView,
	DynamicView,
	SitemapEntry,
	SitemapItem,
	RouterContext,
} from "./sitemap-types.js";
import type { HandlerRegistry } from "./handler-registry.js";
import type { CommandRegistry } from "./command-registry.js";

function isNavigationResult(result: MenuResult): boolean {
	return result === "quit" || result === "start" ||
		(typeof result === "string" && result.startsWith("navigate:"));
}

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
		const stack: string[] = [startViewId];

		while (stack.length > 0) {
			const viewId = stack[stack.length - 1];
			const view = this.#sitemapRef.views[viewId];

			if (!view) {
				log(`\n  ${RED}Unknown view: "${viewId}"${RESET}\n`);
				stack.pop();
				continue;
			}

			const ctx = this.#buildContext();

			if (view.context?.includes("project") && !ctx.project) {
				log(`\n  ${YELLOW}No project selected — returning to previous view.${RESET}\n`);
				stack.pop();
				continue;
			}

			const result = view.type === "dynamic"
				? await this.#runDynamicView(view as DynamicView, ctx)
				: await this.#runStaticView(view as StaticView, ctx);

			const shouldReturn = this.#applyResult(result, stack, startViewId);
			if (shouldReturn) return;
		}
	}

	// ── Result interpretation ────────────────────────────────────────

	#applyResult(result: MenuResult, stack: string[], startViewId: string): boolean {
		if (typeof result === "string" && result.startsWith("navigate:")) {
			stack.push(result.slice("navigate:".length));
			return false;
		}
		if (result === "quit") return true;
		if (result === "start") {
			stack.length = 0;
			stack.push(startViewId);
			this.#onProjectCleared();
			return false;
		}
		// "main" or void → pop current view (go back to parent)
		stack.pop();

		// Auto-navigate: if a project was just selected and we're back at
		// the start view (or stack is empty), push project-detail.
		if (this.#getProject() && (stack.length === 0 || stack[stack.length - 1] === startViewId)) {
			if (this.#sitemapRef.views["project-detail"]) {
				this.#onProjectSelected();
				stack.push("project-detail");
			}
		}

		// Never let the stack empty out — re-push the start view.
		if (stack.length === 0) {
			stack.push(startViewId);
		}
		return false;
	}

	// ── Dynamic view rendering ───────────────────────────────────────

	async #runDynamicView(dynView: DynamicView, ctx: RouterContext): Promise<MenuResult> {
		const handler = this.#handlers.getView(dynView.handler);

		if (!dynView.items || dynView.items.length === 0) {
			return handler(ctx);
		}

		const hybridCtx = this.#buildHybridContext(dynView, ctx);
		const result = await handler(hybridCtx.ctx);
		return hybridCtx.resolveNavigation(result);
	}

	#buildHybridContext(dynView: DynamicView, ctx: RouterContext) {
		let navigationTarget: string | null = null;
		const onNav = (target: string) => { navigationTarget = target; };

		const sitemapEntries = this.#buildEntries({ items: dynView.items! }, ctx, onNav);
		const hasSlots = dynView.items!.some((e) => "slot" in e);
		const sitemapSlots = hasSlots ? this.#buildSlots(dynView.items!, ctx, onNav) : undefined;

		if (dynView.beforeRender && this.#handlers.hasBeforeRender(dynView.beforeRender)) {
			this.#handlers.getBeforeRender(dynView.beforeRender)(ctx);
		}

		const hybridCtx: RouterContext = {
			...ctx, sitemapEntries,
			...(sitemapSlots ? { sitemapSlots } : {}),
		};

		return {
			ctx: hybridCtx,
			resolveNavigation: (result: MenuResult): MenuResult => {
				if (navigationTarget && !isNavigationResult(result)) {
					return `navigate:${navigationTarget}` as MenuResult;
				}
				return result;
			},
		};
	}

	// ── Static view rendering ───────────────────────────────────────

	async #runStaticView(view: StaticView, ctx: RouterContext): Promise<MenuResult> {
		let navigationTarget: string | null = null;

		const entries = this.#buildEntries(view, ctx, (target) => {
			navigationTarget = target;
		});

		const title = interpolate(view.title, ctx);
		const beforeMenu = view.beforeRender && this.#handlers.hasBeforeRender(view.beforeRender)
			? () => this.#handlers.getBeforeRender(view.beforeRender!)(ctx)
			: undefined;

		const result = await runMenu(title, entries, { beforeMenu });

		if (navigationTarget) {
			return `navigate:${navigationTarget}` as MenuResult;
		}

		return result;
	}

	// ── Entry conversion ────────────────────────────────────────────

	#buildEntries(
		view: { readonly items: readonly SitemapEntry[] },
		ctx: RouterContext,
		onNavigate: (target: string) => void,
	): MenuEntry[] {
		const entries: MenuEntry[] = [];

		for (const entry of view.items) {
			if ("separator" in entry && entry.separator) {
				if (entry.hidden !== undefined) {
					const isHidden = resolveHiddenCondition(entry.hidden, ctx, this.#handlers);
					if (isHidden) continue;
				}
				entries.push({ separator: true });
				continue;
			}

			// Skip slot markers — they're handled by #buildSlots
			if ("slot" in entry) continue;

			const item = entry as SitemapItem;

			// Hidden items
			if (item.hidden !== undefined) {
				const isHidden = resolveHiddenCondition(item.hidden, ctx, this.#handlers);
				if (isHidden) continue;
			}

			const menuItem = this.#buildMenuItem(item, ctx, onNavigate);
			entries.push(menuItem);
		}

		return entries;
	}

	/**
	 * Build entries segmented by named slots.
	 *
	 * Returns a map: `_before` → entries before the first slot,
	 * `<slot-name>` → empty array (insertion point marker),
	 * entries between slots go into `_between_<prevSlot>`,
	 * `_after` → entries after the last slot.
	 *
	 * Handlers assemble the final menu:
	 * `[...slots._before, ...myDynamicItems, ...slots._after]`
	 */
	#buildSlots(
		items: readonly SitemapEntry[],
		ctx: RouterContext,
		onNavigate: (target: string) => void,
	): Record<string, MenuEntry[]> {
		const slotNames = items
			.filter((e): e is { slot: string } => "slot" in e && typeof (e as { slot: unknown }).slot === "string")
			.map((e) => e.slot);

		const slots: Record<string, MenuEntry[]> = {};
		let currentKey = "_before";
		slots[currentKey] = [];
		let slotIndex = 0;

		for (const entry of items) {
			if ("slot" in entry && typeof entry.slot === "string") {
				slots[entry.slot] = [];
				slotIndex++;
				currentKey = slotIndex < slotNames.length ? `_between_${entry.slot}` : "_after";
				if (!slots[currentKey]) slots[currentKey] = [];
				continue;
			}
			const menuEntry = this.#resolveEntry(entry, ctx, onNavigate);
			if (menuEntry) slots[currentKey].push(menuEntry);
		}

		return slots;
	}

	#resolveEntry(entry: SitemapEntry, ctx: RouterContext, onNavigate: (target: string) => void): MenuEntry | null {
		if ("separator" in entry && entry.separator) return { separator: true };
		const item = entry as SitemapItem;
		if (item.hidden !== undefined && resolveHiddenCondition(item.hidden, ctx, this.#handlers)) return null;
		return this.#buildMenuItem(item, ctx, onNavigate);
	}

	#buildMenuItem(
		item: SitemapItem,
		ctx: RouterContext,
		onNavigate: (target: string) => void,
	): MenuEntry {
		const label = interpolate(item.label, ctx);
		const disabled = item.disabled !== undefined
			? () => resolveDisabledCondition(item.disabled, ctx, this.#handlers)
			: undefined;

		return {
			key: item.key,
			label,
			disabled,
			disabledMessage: item.disabledMessage ? `\n  ${item.disabledMessage}\n` : undefined,
			action: this.#buildAction(item, ctx, onNavigate),
		};
	}

	#buildAction(
		item: SitemapItem,
		ctx: RouterContext,
		onNavigate: (target: string) => void,
	): () => MenuResult | Promise<MenuResult> {
		// Navigate → push view, exit runMenu
		if (item.navigate) {
			const target = item.navigate;
			return () => {
				onNavigate(target);
				return "main" as MenuResult;
			};
		}

		// Signal → navigation control
		if (item.signal) {
			switch (item.signal) {
				case "quit": return () => "quit" as MenuResult;
				case "start": return () => "start" as MenuResult;
				case "back": return () => "main" as MenuResult;
			}
		}

		// Command → dispatch through CommandRegistry
		if (item.command) {
			const command = item.command;
			return async () => {
				const handler = this.#commands.handlers[command];
				if (!handler) {
					log(`\n  ${RED}Unknown command: "${command}"${RESET}\n`);
					await input.waitForEnter();
					return undefined;
				}
				await handler({}, [], command, ctx.project);
				await input.waitForEnter();
				return undefined; // stay in menu
			};
		}

		// Handler → call registered ActionHandler
		if (item.handler) {
			const handlerId = item.handler;
			return async () => {
				const handler = this.#handlers.getAction(handlerId);
				const result = await handler(ctx);
				// Propagate navigation signals from handler
				if (result === "quit") return "quit" as MenuResult;
				if (result === "start") return "start" as MenuResult;
				if (result === "main") return "main" as MenuResult;
				return undefined; // stay in menu
			};
		}

		// Fallback — no action
		return () => undefined;
	}

	// ── Context building ────────────────────────────────────────────

	#buildContext(): RouterContext {
		return {
			deps: this.#deps,
			project: this.#getProject(),
			tools: this.#getTools(),
		};
	}
}
