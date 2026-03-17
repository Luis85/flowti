/**
 * register-tui-handlers.ts — Registers all TUI action, form, condition, and data source handlers.
 *
 * Handler registration will be added as handlers are migrated from the legacy
 * router-based HandlerRegistry to TUI-native implementations.
 */

import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import { registerConditionHandlers } from "./condition-handlers.js";
import { registerEffectHandlers } from "./effect-handlers.js";
import { registerNavigationHandlers } from "./navigation-handlers.js";
import { registerDataSourceHandlers } from "./data-source-handlers.js";

export function registerTuiHandlers(registry: TuiHandlerRegistry): void {
	registerConditionHandlers(registry);
	registerEffectHandlers(registry);
	registerNavigationHandlers(registry);
	registerDataSourceHandlers(registry);
}
