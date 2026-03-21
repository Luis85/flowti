/**
 * Sitemap handler registration — extracted from main.ts.
 *
 * Registers all action, condition, and domain-specific handlers with
 * the PluginHandlerRegistry. Uses lazy accessors (getter closures) so
 * service references resolve at invocation time — after onLayoutReady.
 */

import type { Plugin } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { ILogger } from "../infrastructure/logger/types.js";
import { PluginHandlerRegistry } from "../infrastructure/handlers/plugin-handler-registry.js";
import { ConditionEvaluator } from "../infrastructure/handlers/condition-evaluator.js";
import { registerActionHandlers } from "../infrastructure/handlers/action-handlers.js";
import { registerConditionHandlers } from "../infrastructure/handlers/condition-handlers.js";
import { registerTrainHandlers } from "../infrastructure/handlers/train-handlers.js";
import { registerCatalogHandlers } from "../infrastructure/handlers/catalog-handlers.js";
import { registerDataExchangeHandlers } from "../infrastructure/handlers/data-exchange-handlers.js";
import { registerAnalyticsHandlers } from "../infrastructure/handlers/analytics-handlers.js";
import { registerUserHandlers } from "../infrastructure/handlers/user-handlers.js";
import { SitemapBootstrap } from "../infrastructure/sitemap/sitemap-bootstrap.js";
import { buildScannerEntities } from "./hub-setup.js";
import type { PluginSitemap } from "../domain/sitemap/plugin-sitemap-types.js";
import type { ActionHandlerDeps } from "../infrastructure/handlers/action-handlers.js";
import type { ConditionHandlerDeps } from "../infrastructure/handlers/condition-handlers.js";
import type { TrainHandlerDeps } from "../infrastructure/handlers/train-handlers.js";
import type { CatalogHandlerDeps } from "../infrastructure/handlers/catalog-handlers.js";
import type { DataExchangeHandlerDeps } from "../infrastructure/handlers/data-exchange-handlers.js";
import type { AnalyticsHandlerDeps } from "../infrastructure/handlers/analytics-handlers.js";
import type { UserHandlerDeps } from "../infrastructure/handlers/user-handlers.js";

/**
 * All deps needed for sitemap handler registration.
 * Each sub-object matches the exact interface required by the handler.
 */
export interface SitemapHandlerDeps {
	actionDeps: ActionHandlerDeps;
	conditionDeps: ConditionHandlerDeps;
	trainDeps: TrainHandlerDeps;
	catalogDeps: CatalogHandlerDeps;
	dataExchangeDeps: DataExchangeHandlerDeps;
	analyticsDeps: AnalyticsHandlerDeps;
	userDeps: UserHandlerDeps;
}

/**
 * Creates and configures the full handler registry + sitemap bootstrap.
 */
export function createSitemapHandlerRegistry(
	plugin: Plugin,
	eventBus: IEventBus,
	logger: ILogger,
	sitemap: PluginSitemap,
	deps: SitemapHandlerDeps,
): PluginHandlerRegistry {
	const handlerRegistry = new PluginHandlerRegistry();

	registerActionHandlers(handlerRegistry, deps.actionDeps);
	registerConditionHandlers(handlerRegistry, deps.conditionDeps);
	registerTrainHandlers(handlerRegistry, deps.trainDeps);
	registerCatalogHandlers(handlerRegistry, deps.catalogDeps);
	registerDataExchangeHandlers(handlerRegistry, deps.dataExchangeDeps);
	registerAnalyticsHandlers(handlerRegistry, deps.analyticsDeps);
	registerUserHandlers(handlerRegistry, deps.userDeps);

	const conditionEvaluator = new ConditionEvaluator(handlerRegistry);
	const bootstrap = new SitemapBootstrap(sitemap, {
		plugin, eventBus, logger, handlerRegistry, conditionEvaluator,
	});
	bootstrap.registerAll();
	bootstrap.validate();

	return handlerRegistry;
}

export { buildScannerEntities };
