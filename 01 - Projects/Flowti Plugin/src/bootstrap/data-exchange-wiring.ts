/**
 * Data Exchange UI wiring — extracted from main.ts.
 *
 * Creates the DataExchangeSetup and wires it to UiCommandService.
 */

import type { App, ViewCreator, EventRef, Command } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { ILogger } from "../infrastructure/logger/types.js";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService.js";
import type { SignalService } from "../domain/signal/SignalService.js";
import type { CanvasService } from "../domain/canvas/CanvasService.js";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService.js";
import type { OnboardingService } from "../domain/onboarding/OnboardingService.js";
import type { HubRegistry } from "../domain/hub/HubRegistry.js";
import type { UiCommandService } from "../infrastructure/ui/UiCommandService.js";
import { DataExchangeSetup } from "./dataExchangeSetup.js";

export interface DataExchangeWiringDeps {
	app: App;
	eventBus: IEventBus;
	logger: ILogger;
	dataExchangeService: DataExchangeService;
	signalService?: SignalService;
	canvasService?: CanvasService;
	analyticsService?: AnalyticsService;
	onboardingService: OnboardingService;
	hubRegistry?: HubRegistry;
	docsRootPath: string;
	uiCommandService?: UiCommandService;
	safeRegisterView: (type: string, factory: ViewCreator) => void;
	registerExtensions: (exts: string[], type: string) => void;
	registerEvent: (ref: EventRef) => void;
	addCommand: (cmd: Command) => Command;
}

/**
 * Wires Data Exchange UI: views, commands, file-menu items,
 * and UiCommandService callbacks.
 */
export function wireDataExchange(deps: DataExchangeWiringDeps): void {
	const dxSetup = new DataExchangeSetup({
		app: deps.app,
		eventBus: deps.eventBus,
		dataExchangeService: deps.dataExchangeService,
		signalService: deps.signalService,
		canvasService: deps.canvasService,
		analyticsService: deps.analyticsService,
		onboardingService: deps.onboardingService,
		hubRegistry: deps.hubRegistry,
		docsRootPath: deps.docsRootPath,
		registerView: (type, factory) => deps.safeRegisterView(type, factory),
		registerExtensions: (exts, type) => deps.registerExtensions(exts, type),
		registerEvent: (ref) => deps.registerEvent(ref),
		addCommand: (cmd) => deps.addCommand(cmd),
	});
	dxSetup.wireCallbacks();

	deps.uiCommandService?.setOpenCsvImport(
		(filePath, savedConfig) => dxSetup.openCsvImportWithConfig(filePath, savedConfig),
	);
	deps.uiCommandService?.setOpenExportView(
		(sourcePath, sourceType, format) => dxSetup.openExportView(sourcePath, sourceType, format),
	);
	deps.uiCommandService?.setOpenExportWithSavedConfig(
		(savedConfig) => dxSetup.openExportWithSavedConfig(savedConfig),
	);

	const registerDxHeavyUi = (): void => {
		try {
			dxSetup.registerViews();
			dxSetup.registerFileMenuItems();
			dxSetup.registerCommands();
		} catch (err) {
			deps.logger.error(
				`[Flowti] Data exchange UI registration failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};
	if (typeof requestIdleCallback !== "undefined") {
		requestIdleCallback(() => { registerDxHeavyUi(); }, { timeout: 2500 });
	} else {
		setTimeout(registerDxHeavyUi, 0);
	}
}
