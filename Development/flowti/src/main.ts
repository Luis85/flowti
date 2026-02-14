import { Notice, Plugin } from "obsidian";
import { registerCommands } from "./infrastructure/commands/registry";
import type { CommandContext, ICommandRegistry } from "./infrastructure/commands/types";
import { LifecycleError } from "./infrastructure/errors/FlowtiError";
import type { IErrorService } from "./infrastructure/errors/types";
import type { IEventBridge, IEventBus } from "./infrastructure/events/types";
import type { ILogger } from "./infrastructure/logger/types";
import { registerServices } from "./infrastructure/services/registry";
import type { IServiceContainer } from "./infrastructure/services/types";
import { FlowtiSettingTab } from "./domain/settings/FlowtiSettingTab";
import {
	DEFAULT_SETTINGS,
	FlowtiSettings,
	FlowtiSettingsSchema,
} from "./domain/settings/settings";
import type { IInstallerService } from "./domain/installer/types";
import { InstallerWizardModal } from "./domain/installer/InstallerWizardModal";
import type { ISettingsService } from "./domain/settings/types";
import type { IUserService } from "./domain/user/types";
import type { EventNotificationService } from "./domain/eventNotify/EventNotificationService";
import type { EventFilterService } from "./domain/eventFilter/EventFilterService";
import type { DiscoveryService } from "./domain/discovery/DiscoveryService";
import type { SubscriptionService } from "./domain/subscription/SubscriptionService";
import type { EventDefinitionService } from "./domain/eventDefinition/EventDefinitionService";
import type { IngestionService } from "./domain/ingestion/IngestionService";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { IngestionStatusBar } from "./ui/IngestionStatusBar";
import { VIEW_TYPE_EVENT_CATALOG } from "./ui/EventCatalogView";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import { VIEW_TYPE_DATA_EXCHANGE_HUB } from "./ui/DataExchangeHubView";
import { DataExchangeSetup } from "./dataExchangeSetup";
import { createInfrastructure, setupCrossCuttingListeners } from "./pluginBootstrap";


/**  
 * Main plugin class for Flowti - Integrated Business Development Environment.
 *
 * Acts as the orchestrator for the plugin lifecycle. All domain logic lives in
 * dedicated services that communicate through the {@link IEventBus}. The plugin
 * itself only wires things together and manages the startup/shutdown sequence.
 *
 * **Initialization phases** (see {@link onload}):
 *
 * | Phase | What happens |
 * |-------|-------------|
 * | 1 - Core | Settings, EventBus, Logger, ErrorService, EventBridge (request handlers only) |
 * | 2 - Containers | ServiceContainer, CommandRegistry, ViewRegistry |
 * | 3 - Registration | Services, commands, and views are registered |
 * | 4 - Init | All services are initialized in dependency order |
 * | 5 - UI | Settings tab, views, and commands are bound to Obsidian |
 * | 6 - Post-load | Vault listeners registered, user data loaded, plugin.ready emitted |
 *
 * **Key architectural decisions:**
 * - The {@link IEventBridge} owns all Obsidian API ↔ EventBus translation
 *   (file operations, frontmatter, vault change notifications).
 *   This keeps services decoupled from Obsidian and fully testable.
 * - Cross-cutting event listeners (logging, debug mode sync) live in
 *   {@link setupCrossCuttingListeners} because they span multiple domains.
 * - Shutdown order is the reverse of startup: EventBridge → Services →
 *   Commands → Views → EventBus.
 *
 * @see {@link IEventBridge} for Obsidian API bridging
 * @see {@link IServiceContainer} for dependency injection
 * @see {@link ICommandRegistry} for command middleware pipeline
 */
export default class FlowtiBasePlugin extends Plugin {
	settings!: FlowtiSettings;
	eventBus!: IEventBus;
	eventBridge!: IEventBridge;
	logger!: ILogger;
	errorService!: IErrorService;
	services!: IServiceContainer;
	commands!: ICommandRegistry;
	views!: IViewRegistry;

	// Service references (populated in onLayoutReady)
	userService!: IUserService;
	private eventFilterService?: EventFilterService;
	private eventNotifyService?: EventNotificationService;
	private discoveryService?: DiscoveryService;
	private subscriptionService?: SubscriptionService;
	private ingestionService?: IngestionService;
	private eventDefinitionService?: EventDefinitionService;
	private dataExchangeService?: DataExchangeService;
	private ingestionStatusBar?: IngestionStatusBar;
	private collapsedCategories = new Set<string>();
	private crossCuttingListeners: (() => void)[] = [];

	// ── Notice throttle ──────────────────────────────────────
	// Batches rapid-fire notices (e.g. during bulk import) into a single
	// summary notice per key. Within the window, counts accumulate; when
	// the timer fires, a single Notice is shown with the total count.
	private static readonly NOTICE_WINDOW_MS = 2000;
	private noticeBatches = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>();

	private throttledNotice(key: string, singleMsg: string): void {
		const existing = this.noticeBatches.get(key);
		if (existing) {
			existing.count++;
			return; // timer already running — it will flush
		}
		const batch = {
			count: 1,
			timer: setTimeout(() => {
				const b = this.noticeBatches.get(key);
				this.noticeBatches.delete(key);
				if (!b) return;
				if (b.count === 1) {
					new Notice(singleMsg);
				} else {
					new Notice(`${singleMsg} (+${b.count - 1} more)`);
				}
			}, FlowtiBasePlugin.NOTICE_WINDOW_MS),
		};
		this.noticeBatches.set(key, batch);
	}

	async onload() {
		try {
			// ── Phase 1-2: Core infrastructure + Containers ─────────
			await this.loadSettings();

			const infra = createInfrastructure({
				app: this.app,
				settings: this.settings,
				registerEvent: (ref) => this.registerEvent(ref),
			});
			this.eventBus = infra.eventBus;
			this.logger = infra.logger;
			this.errorService = infra.errorService;
			this.eventBridge = infra.eventBridge;
			this.services = infra.services;
			this.commands = infra.commands;
			this.views = infra.views;

			void this.eventBus.emit("plugin.loading", {
				timestamp: new Date().toISOString(),
			});

			this.crossCuttingListeners = setupCrossCuttingListeners({
				eventBus: this.eventBus,
				logger: this.logger,
				onSettingsChanged: (s) => {
					this.settings = s;
					this.collapsedCategories = new Set(s.collapsedCategories);
				},
				throttledNotice: (key, msg) => this.throttledNotice(key, msg),
			});

			void this.eventBus.emit("settings.loaded", { settings: this.settings });

			// ── Phase 3: Registration ─────────────────────────────────
			this.registerAllServices();
			this.registerAllCommands();
			this.registerAllViews();

			// ── Phase 4: Service initialization ───────────────────────
			// Resolves dependency graph and initializes in topological order.
			await this.services.initializeAll();

			// ── Phase 5: UI binding ───────────────────────────────────
			this.addSettingTab(new FlowtiSettingTab(this.app, this));
			this.bindViews();
			this.bindCommands();

			// Ribbon icon — opens Event Catalog
			this.addRibbonIcon("list", "Open Event Catalog", () => {
				const { workspace } = this.app;
				const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}
				const leaf = workspace.getLeaf(true);
				void leaf.setViewState({ type: VIEW_TYPE_EVENT_CATALOG, active: true });
				workspace.revealLeaf(leaf);
			});

			// Ribbon icon — opens Data Exchange Hub
			this.addRibbonIcon("arrow-left-right", "Open Data Exchange Hub", () => {
				const { workspace } = this.app;
				const existing = workspace.getLeavesOfType(VIEW_TYPE_DATA_EXCHANGE_HUB);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}
				const leaf = workspace.getLeaf(true);
				void leaf.setViewState({ type: VIEW_TYPE_DATA_EXCHANGE_HUB, active: true });
				workspace.revealLeaf(leaf);
			});

			// Status bar
			const statusBarEl = this.addStatusBarItem();
			this.ingestionStatusBar = new IngestionStatusBar(statusBarEl, this.eventBus);
			this.ingestionStatusBar.register();

			// ── Phase 6: Post-load ────────────────────────────────────
			// Deferred until Obsidian's workspace layout is ready.
			this.app.workspace.onLayoutReady(() => {
				this.onLayoutReady();
			});

			// Emit plugin.loaded event
			void this.eventBus.emit("plugin.loaded", {
				timestamp: new Date().toISOString(),
			});

			this.logger.info("Plugin loaded successfully");
		} catch (error) {
			const lifecycleError = new LifecycleError({
				code: "PLUGIN_LOAD_FAILED",
				message: "Failed to load Flowti plugin",
				severity: "critical",
				context: "FlowtiBasePlugin",
				cause: error instanceof Error ? error : undefined,
			});

			// Log to console since logger might not be initialized
			console.error("[Flowti] Plugin load failed:", error);

			// If error service is available, use it
			this.errorService?.handle(lifecycleError);

			throw lifecycleError;
		}
	}

	/**
	 * Teardown in reverse initialization order:
	 * EventBridge → Services → Commands → Views → EventBus.
	 *
	 * Each step uses optional chaining because a failure in {@link onload}
	 * may have left some properties uninitialized.
	 */
	async onunload() {
		try {
			void this.eventBus?.emit("plugin.unloading", {
				timestamp: new Date().toISOString(),
			});

			this.ingestionStatusBar?.dispose();
			this.eventBridge?.dispose();
			await this.services?.disposeAll();
			this.commands?.clear();
			this.views?.clear();

			// Unsubscribe cross-cutting listeners before clearing EventBus
			for (const unsub of this.crossCuttingListeners) {
				unsub();
			}
			this.crossCuttingListeners = [];

			this.logger?.info("Plugin unloaded");

			void this.eventBus?.emit("plugin.unloaded", {
				timestamp: new Date().toISOString(),
			});

			// EventBus is cleared last so that unloaded listeners still fire.
			this.eventBus?.clear();
		} catch (error) {
			console.error("[Flowti] Plugin unload error:", error);
		}
	}

	/**
	 * Loads settings from Obsidian's `loadData()` and validates them
	 * against {@link FlowtiSettingsSchema}. Falls back to
	 * {@link DEFAULT_SETTINGS} when validation fails (e.g. first run).
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		const result = FlowtiSettingsSchema.safeParse(data);

		if (!result.success) {
			this.logger?.warn("Invalid settings, using defaults", {
				errors: result.error.issues,
			});
		}

		this.settings = result.success ? result.data : DEFAULT_SETTINGS;
		this.collapsedCategories = new Set(this.settings.collapsedCategories);
	}

	/**
	 * Persists settings via Obsidian's `saveData()` and emits
	 * `settings.changed` so that listeners (e.g. Logger debug mode)
	 * can react. Merges with existing stored data to preserve
	 * unrelated keys (e.g. user profile).
	 */
	async saveSettings(): Promise<void> {
		const existingData = ((await this.loadData()) as object) || {};
		await this.saveData({
			...existingData,
			...this.settings,
		});
		await this.eventBus.emit("settings.changed", { settings: this.settings });
	}

	/**
	 * Registers all services defined in {@link registerServices}.
	 *
	 * Bridges Obsidian's `loadData`/`saveData` into the storage abstraction
	 * so that services never depend on the Plugin class directly.
	 */
	private registerAllServices(): void {
		registerServices(this.services, {
			loadData: () => this.loadData(),
			saveData: (data) => this.saveData(data),
		});
	}

	/**
	 * Register plugin commands.
	 */
	private registerAllCommands(): void {
		registerCommands(this.commands);
	}

	/**
	 * Register plugin views.
	 */
	private registerAllViews(): void {
		registerViews(this.views, {
			eventBus: this.eventBus,
			state: {
				getSettings: () => this.settings,
				getExcludedTypes: () => this.eventFilterService?.getExcludedTypes() ?? [],
				getNotifiedTypes: () => this.eventNotifyService?.getNotifiedTypes() ?? [],
				getDiscoveredEvents: () => this.discoveryService?.getDiscoveredEvents() ?? [],
				collapsedCategories: this.collapsedCategories,
			},
		});
	}

	/**
	 * Binds all registered commands to Obsidian's command palette.
	 * Each command is wrapped to execute through the middleware pipeline.
	 */
	private bindCommands(): void {
		const ctx = this.createCommandContext();

		for (const command of this.commands.getCommands()) {
			this.addCommand({
				id: command.id,
				name: command.name,
				hotkeys: command.hotkeys,
				icon: command.icon,
				mobileOnly: command.mobileOnly,
				callback: () => {
					void this.commands.execute(command.id, ctx);
				},
			});
		}
	}

	/**
	 * Create command context with all dependencies.
	 */
	private createCommandContext(): CommandContext {
		return {
			app: this.app,
			eventBus: this.eventBus,
			logger: this.logger,
		};
	}

	/**
	 * Bind registered views to Obsidian.
	 */
	private bindViews(): void {
		for (const view of this.views.getViews()) {
			this.registerView(view.type, view.factory);
		}
	}

	/**
	 * Final initialization step, deferred until Obsidian's workspace
	 * layout is fully rendered.
	 *
	 * Loads all services first, then registers vault/workspace/metadata
	 * listeners via {@link EventBridge.registerVaultListeners} right
	 * before emitting `plugin.ready`. Registering vault listeners last
	 * avoids a flood of file/metadata events during Obsidian's initial
	 * cache resolution that would spam services before they're ready.
	 */
	private async onLayoutReady(): Promise<void> {
		try {
			// Load SettingsService FIRST so its internal state matches storage.
			// Without this, any event-driven update (e.g. collapsing a category)
			// would merge with DEFAULT_SETTINGS and overwrite persisted values.
			const settingsService = await this.services.get<ISettingsService>("settingsService");
			await settingsService.load();

			this.userService = await this.services.get<IUserService>("userService");
			await this.userService.load();

			const installerService = await this.services.get<IInstallerService>("installerService");
			await installerService.load();

			InstallerWizardModal.showIfNeeded(this.app, installerService, this.eventBus);

			this.eventFilterService = await this.services.get<EventFilterService>("eventFilterService");
			await this.eventFilterService.load();

			this.eventNotifyService = await this.services.get<EventNotificationService>("eventNotifyService");
			await this.eventNotifyService.load();

			this.discoveryService = await this.services.get<DiscoveryService>("discoveryService");
			await this.discoveryService.load();

			this.subscriptionService = await this.services.get<SubscriptionService>("subscriptionService");
			await this.subscriptionService.load();

			this.ingestionService = await this.services.get<IngestionService>("ingestionService");
			await this.ingestionService.load();

			this.eventDefinitionService = await this.services.get<EventDefinitionService>("eventDefinitionService");
			await this.eventDefinitionService.load();

			// ── Data Exchange: load service, wire UI ──
			this.dataExchangeService = await this.services.get<DataExchangeService>("dataExchangeService");
			await this.dataExchangeService.load();

			const dxSetup = new DataExchangeSetup({
				app: this.app,
				eventBus: this.eventBus,
				dataExchangeService: this.dataExchangeService,
				docsRootPath: settingsService.getSettings().docsRootPath,
				registerView: (type, factory) => this.registerView(type, factory),
				registerExtensions: (exts, type) => { try { this.registerExtensions(exts, type); } catch { /* may already be registered */ } },
				registerEvent: (ref) => this.registerEvent(ref),
				addCommand: (cmd) => this.addCommand(cmd),
			});
			dxSetup.wireCallbacks();
			dxSetup.registerViews();
			dxSetup.registerFileMenuItems();
			dxSetup.registerCommands();

			// Run catch-up if watch folders are configured
			if (this.settings.watchFolders.length > 0 && this.ingestionService) {
				const ingestion = this.ingestionService;
				try {
					await ingestion.runCatchUp(this.settings.watchFolders, async (folder) => {
						return this.app.vault.getFiles()
							.filter((f) => f.path.startsWith(folder + "/"))
							.map((f) => f.path);
					});
				} catch (error) {
					this.errorService.handle(
						error instanceof Error ? error : new Error(String(error)),
						"ingestion.catchUp"
					);
				}
			}

			// Register vault/workspace/metadataCache listeners AFTER all services
			// have loaded. Doing this earlier causes a flood of file.created and
			// metadata.changed events during Obsidian's initial cache resolution,
			// spamming the catalog and other listeners before they're ready.
			this.eventBridge.registerVaultListeners();

			void this.eventBus.emit("plugin.ready", {
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			this.errorService.handle(
				error instanceof Error ? error : new Error(String(error)),
				"onLayoutReady"
			);
		}
	}

	/**
	 * Get a service from the container.
	 * Convenience method for external access.
	 */
	async getService<T>(id: string): Promise<T> {
		return this.services.get<T>(id);
	}
}
