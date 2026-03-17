/**
 * use-action-dispatch.ts — Dispatches sitemap actions by type.
 *
 * Routes navigate, signal, handler, form, and command actions
 * to the appropriate target (navigation, registry handler, etc.).
 */

import type { SitemapActionDef } from "./use-sitemap-actions.js";
import type { NavigationContextValue } from "../sitemap/navigation-context.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext, TuiActionResult } from "../registry/tui-handler-types.js";

type RunEffect = (handler: () => Promise<TuiActionResult>, label: string) => Promise<void>;

export async function dispatchAction(
	action: SitemapActionDef,
	nav: NavigationContextValue,
	registry: TuiHandlerRegistry,
	actionCtx: TuiActionContext,
	runEffect: RunEffect,
): Promise<void> {
	if (action.disabled) return;

	switch (action.type) {
		case "navigate":
			if (action.target) nav.navigate(action.target, action.params as Record<string, string> | undefined);
			break;

		case "signal":
			switch (action.target) {
				case "back": nav.goBack(); break;
				case "quit": nav.navigate("quit"); break;
				case "refresh": nav.refresh(); break;
				case "start": nav.navigate("start"); break;
			}
			break;

		case "handler":
			if (action.target && registry.hasHandler(action.target)) {
				const handler = registry.getHandler(action.target);
				await runEffect(
					async () => {
						const result = await handler(actionCtx);
						if (result.kind === "navigate") {
							nav.navigate(result.target, result.params);
							return { kind: "ok" };
						}
						return result;
					},
					action.label,
				);
			}
			break;

		case "form":
			if (action.target) nav.navigate(action.target, action.params as Record<string, string> | undefined);
			break;

		case "command":
			// Command execution — will be implemented with CommandOutput component
			break;
	}
}
