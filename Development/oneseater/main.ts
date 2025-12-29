import { Plugin, Notice } from "obsidian";
import { EventType, IEventBus } from "src/eventsystem";
import { SetTimeScaleEvent } from "src/eventsystem/engine/SetTimeScaleEvent";
import { SimulationStartedEvent } from "src/eventsystem/engine/SimulationStartedEvent";
import { SimulationStoppedEvent } from "src/eventsystem/engine/SimulationStoppedEvent";
import { SimulationTickEvent } from "src/eventsystem/engine/SimulationTickEvent";
import { SimulationTockEvent } from "src/eventsystem/engine/SimulationTockEvent";
import { TogglePauseEvent } from "src/eventsystem/engine/TogglePauseEvent";
import { ResetInboxEvent } from "src/eventsystem/messages/ResetInboxEvent";
import { AddTimerEvent } from "src/eventsystem/timer/AddTimerEvent";
import { RemoveTimerEvent } from "src/eventsystem/timer/RemoveTimerEvent";
import { InboxEventBridge } from "src/machines/inbox/InboxEventBridge";
import { OrderEventBridge } from "src/machines/order/OrderEventBridge";
import { SimulationMachine } from "src/machines/SimulationMachine";
import { OneSeaterSettingTab } from "src/settings/settings";
import { buildDefaultSettings } from "src/settings/settings.utils";
import { OneSeaterSettings } from "src/settings/types";
import { ISimulation, Simulation } from "src/simulation/Simulation";
import { GameSettingsStore } from "src/simulation/stores/GameSettingsStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { NotificationService } from "src/ui/NotificationService";
import { ReactiveRibbonManager } from "src/ui/ReactiveRibbonManager";
import { GAME_COMPENDIUM_VIEW, GameCompendiumView } from "src/ui/views/GameCompendiumView";
import { GAMELOOP_DEBUG_VIEW, GameLoopDebugView } from "src/ui/views/GameLoopDebugView";
import { GAME_MARKET_VIEW, GameMarketView } from "src/ui/views/GameMarketView";
import { GAME_OFFICE_VIEW, GameView } from "src/ui/views/GameView";
import { GAME_PRODUCT_CATALOG_VIEW, ProductCatalogView } from "src/ui/views/ProductCatalogView";


export default class OneSeater extends Plugin {
	settings: OneSeaterSettings;
	gameSettings: GameSettingsStore;
	private debug: boolean;

	private simulation: ISimulation;
	private simulationEvents: IEventBus;

	private store: SimulationStore;
	private latest: SimulationTickEvent;

	private simulationMachine: SimulationMachine;
	private inboxBridge: InboxEventBridge;
	private orderBridge: OrderEventBridge;

	private ribbons: ReactiveRibbonManager;
	private notificationService: NotificationService;
	private statusBarItem: HTMLElement;
	private rafPending = false;
	private fpsEma?: number;
	private readonly fpsSmoothing = 0.1;

	async onload() {
		const loadStartTime = Date.now();
		console.log("--- 🟡⚫🟡 MOTORSPORT MANAGER LOADING ⚫🟡⚫ ---");

		await this.loadSettings();
		this.statusBarItem = this.addStatusBarItem();
		this.ribbons = new ReactiveRibbonManager(this);
		console.log("Settings loaded...");
		console.log("🟡⚫🟡⚫🟡");

		try {
			this.simulation = new Simulation();
			await this.simulation.init();
			this.store = this.simulation.getStore();
			this.gameSettings = this.simulation.getSettings();
			this.gameSettings.applyFrom(this.settings.game);
			this.simulationEvents = this.simulation.getEvents();

			this.registerMachines();
			this.registerEventSubscriber();
			this.subscribeToSimulationState();
			this.registerViews();
			this.registerRibbonButtons();
			this.addSettingTab(new OneSeaterSettingTab(this.app, this));

			// we void here to prevent waiting for resolving which will never happen
			void this.simulation.start();

			console.log(
				`--- 🟢🟢🟢 MOTORSPORT MANAGER LOADED (${
					Date.now() - loadStartTime
				}ms) 🟢🟢🟢 ---`
			);
		} catch (error) {
			console.error(error);
			this.simulation.stop();
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			buildDefaultSettings(),
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// @TODO: Refactor to target specific windows (e.g. Sidebar) when activating
	// maybe its also possible to use obsidians workspace feature and target specific splits
	async activateView(
		viewType: string,
		target: "sb-left" | "main" | "sb-right" = "main"
	) {
		const { workspace } = this.app;
		console.log(target);

		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
			const newLeaf = workspace.getLeaf("tab");
			if (newLeaf) {
				await newLeaf.setViewState({ type: viewType, active: true });
				leaf = newLeaf;
			}
		}

		if (leaf) {
			console.log(`View activated: ${viewType}`);
			workspace.revealLeaf(leaf);
		}
	}

	// --- STATUSBAR EVENTS AND RENDER UPDATE

	private onTick = (event: SimulationTickEvent): void => {
		if (this.debug) this.debugMessages();
		this.latest = event;
		this.requestStatusbarRender();
	};

	private onTock = (event: SimulationTockEvent): void => {
		if (this.debug) console.log(event);
	};

	private onPauseChanged = (event: TogglePauseEvent): void => {
		this.simulationMachine.send(event);
	};

	private requestStatusbarRender() {
		if (this.rafPending) return;
		this.rafPending = true;

		requestAnimationFrame(() => {
			this.rafPending = false;
			this.renderStatusbar();
		});
	}

	private renderStatusbar(): void {
		if (!this.statusBarItem) return;
		if (!this.latest?.state) {
			this.statusBarItem.setText(`📧 0 · 1x · …`);
			return;
		}
		const messageCount = this.store.getActiveMessages().length;

		// ---- PAUSED UI
		if (this.latest.state.paused) {
			this.statusBarItem.setText(
				`📧 ${messageCount} · ⏸ PAUSED · ${
					this.store.beforePause || 1
				}x`
			);
			return;
		}
		const speedText = `${this.store.speed || 1}x`;

		// ---- RUNNING UI
		const tick = this.latest;
		const dtMs = tick?.lastFrameDeltaTime ?? 0;

		const fpsInstant = dtMs > 0 ? 1000 / dtMs : 0;
		this.fpsEma =
			this.fpsEma === undefined
				? fpsInstant
				: this.fpsEma + this.fpsSmoothing * (fpsInstant - this.fpsEma);

		const fpsText = Number.isFinite(this.fpsEma)
			? Math.round(this.fpsEma)
			: 0;
		const dtText = Math.round(dtMs);

		this.statusBarItem.setText(
			`📧 ${messageCount} · ${speedText} · ${fpsText} FPS · Δ ${dtText}ms`
		);
	}

	// --- REGISTRY

	private registerMachines() {
		this.simulationMachine = new SimulationMachine(
			this.simulationEvents,
			this.store
		);
		this.inboxBridge = new InboxEventBridge(
			this.simulationEvents,
			this.store,
			this.settings
		);
		this.orderBridge = new OrderEventBridge(
			this.simulationEvents,
			this.store
		);
		this.notificationService = new NotificationService(
			this.simulationEvents,
			{
				orders: true, // Show order notifications
				messages: true, // Show message notifications
				tasks: false, // XP popups (optional, can be noisy)
				errors: true, // Show error notifications

				// Callbacks für Action Buttons
				onOpenOffice: () => this.activateView(GAME_OFFICE_VIEW),
				onViewOrder: (orderId) => this.activateView(GAME_OFFICE_VIEW),
			}
		);
	}

	private registerEventSubscriber() {
		this.sub(SimulationTickEvent, this.onTick);
		this.sub(SimulationTockEvent, this.onTock);
		this.sub(TogglePauseEvent, this.onPauseChanged);
	}

	private registerViews(): void {
		this.registerView(
			GAME_OFFICE_VIEW,
			(leaf) => new GameView(leaf, this.simulationEvents, this.settings)
		);
		this.registerView(
			GAME_PRODUCT_CATALOG_VIEW,
			(leaf) => new ProductCatalogView(leaf, this.simulationEvents)
		);
		this.registerView(
			GAME_MARKET_VIEW,
			(leaf) => new GameMarketView(leaf, this.simulationEvents)
		);
		this.registerView(
			GAME_COMPENDIUM_VIEW,
			(leaf) => new GameCompendiumView(leaf)
		);
		this.registerView(
			GAMELOOP_DEBUG_VIEW,
			(leaf) => new GameLoopDebugView(leaf)
		);
	}

	private registerRibbonButtons() {
		// === Navigation ===
		this.ribbons.register({
			id: "office",
			initialState: { icon: "trophy", tooltip: "Go to your office" },
			onClick: () => this.activateView(GAME_OFFICE_VIEW),
		});

		this.ribbons.register({
			id: "catalog",
			initialState: { icon: "gift", tooltip: "Product Catalog" },
			onClick: () => this.activateView(GAME_PRODUCT_CATALOG_VIEW),
		});

		this.addRibbonIcon("store", "Visit the Market", () => {
			this.activateView(GAME_MARKET_VIEW);
		});

		this.addRibbonIcon("square-dashed-kanban", "Data Dashboard", () => {
			this.activateView(GAME_COMPENDIUM_VIEW);
		});

		this.addRibbonIcon("hand-helping", "CTRL A + DEL", () => {
			void this.simulationEvents.publish(new ResetInboxEvent());
		});

		this.ribbons.register({
			id: "pause",
			initialState: { icon: "pause", tooltip: "Pause", disabled: true },
			onClick: () =>
				this.simulationEvents.publish(new TogglePauseEvent()),
		});

		// === Time Scale (Radio-Button Style) ===
		this.ribbons.register({
			id: "speed-1x",
			initialState: { icon: "gauge", tooltip: "1x Speed", active: true },
			onClick: () => this.setTimeScale(1),
		});

		this.ribbons.register({
			id: "speed-fast",
			initialState: { icon: "rabbit", tooltip: "Fast (3600x)" },
			onClick: () => this.setTimeScale(3600),
		});

		this.ribbons.register({
			id: "speed-ultra",
			initialState: { icon: "fast-forward", tooltip: "Ultra (36000x)" },
			onClick: () => this.setTimeScale(36000),
		});

		this.addRibbonIcon("bug-off", "Debug Mode", () => {
			this.toggleDebug();
		});

		this.addRibbonIcon("bug-off", "Debug Panel", () => {
			this.activateView(GAMELOOP_DEBUG_VIEW);
		});

		this.addRibbonIcon("clock-arrow-up", "Timer Test", () => {
			this.timersTest();
		});

		// === Simulation Controls ===
		this.ribbons.register({
			id: "start",
			initialState: { icon: "play", tooltip: "Start Simulation" },
			onClick: () => this.simulation.start(),
		});

		this.ribbons.register({
			id: "stop",
			initialState: {
				icon: "square",
				tooltip: "Stop Simulation",
				disabled: true,
			},
			onClick: () => this.simulation.stop(),
		});
	}

	private setTimeScale(scale: number) {
		this.simulationEvents.publish(new SetTimeScaleEvent(scale));

		// Update active states
		this.ribbons.update("speed-1x", { active: scale === 1 });
		this.ribbons.update("speed-fast", { active: scale === 3600 });
		this.ribbons.update("speed-ultra", { active: scale === 36000 });
	}

	private subscribeToSimulationState() {
		this.simulationEvents.subscribe(SimulationStartedEvent, () => {
			this.ribbons.update("start", { disabled: true, icon: "play" });
			this.ribbons.update("stop", { disabled: false });
			this.ribbons.update("pause", {
				disabled: false,
				icon: "pause",
				tooltip: "Pause",
			});
			this.activateView(GAME_OFFICE_VIEW);
		});

		this.simulationEvents.subscribe(SimulationStoppedEvent, () => {
			this.ribbons.update("start", { disabled: false });
			this.ribbons.update("stop", { disabled: true });
			this.ribbons.update("pause", { disabled: true });
		});

		this.simulationEvents.subscribe(TogglePauseEvent, () => {
			if (this.latest.state.paused) {
				this.ribbons.update("pause", {
					icon: "play",
					tooltip: "Resume",
				});
			} else {
				this.ribbons.update("pause", {
					icon: "pause",
					tooltip: "Pause",
				});
			}
		});
	}

	private sub<T>(eventType: EventType<T>, handler: (event: T) => void): void {
		this.simulationEvents.subscribe(eventType, handler);
		this.register(() => {
			this.simulationEvents.unsubscribe(eventType, handler);
		});
	}

	// --- DEBUG
	toggleDebug(): void {
		this.debug = !this.debug;
		this.store.debug = this.debug;
		this.simulation.setDebug(this.debug);
		this.notificationService.setOptions({ tasks: this.debug });

		new Notice(`Debug mode: ${this.debug ? "ON" : "OFF"}`);
	}

	private debugMessages(): void {
		console.log(this.latest);
		console.log("Tasks", this.simulation.getTasks());
		console.log("Inbox Stats", this.store.getInboxStats());
		console.log("Order Stats", this.store.getOrderStats());
	}

	private timersTest(): void {
		const eventBus = this.simulationEvents;
		// Einfacher Timer - einmalig
		eventBus.publish(
			new AddTimerEvent({
				delayMs: 5 * 60 * 1000, // 5 Spielminuten
				trigger: {
					eventType: "PaymentDue",
					payload: { paymentId: "pay_123" },
				},
				source: "PaymentSystem",
			})
		);

		// Timer mit fester ID (zum späteren Abbrechen)
		eventBus.publish(
			new AddTimerEvent({
				id: `payment_reminder_123`,
				delayMs: 24 * 60 * 60 * 1000, // 1 Spieltag
				trigger: {
					eventType: "Reminder",
					payload: { message: "Zahlung fällig!" },
				},
			})
		);

		// Wiederholender Timer
		eventBus.publish(
			new AddTimerEvent({
				id: "daily_report",
				delayMs: 60 * 1000, // Start in 1 Minute
				trigger: {
					eventType: "DailyReport",
					payload: {},
				},
				repeat: {
					intervalMs: 24 * 60 * 60 * 1000, // Täglich
					maxRepeats: 7, // Nur 7 Tage
				},
				source: "ReportSystem",
			})
		);

		// Timer abbrechen
		eventBus.publish(new RemoveTimerEvent(`payment_reminder_123`));
	}

	// --- CLEANUP

	onunload() {
		this.simulation.stop();

		this.ribbons.dispose();
		this.notificationService?.destroy();
		this.orderBridge?.destroy();
		this.inboxBridge?.destroy();

		this.app.workspace.detachLeavesOfType(GAME_COMPENDIUM_VIEW);
		this.app.workspace.detachLeavesOfType(GAME_OFFICE_VIEW);
		this.app.workspace.detachLeavesOfType(GAME_MARKET_VIEW);
		this.app.workspace.detachLeavesOfType(GAME_PRODUCT_CATALOG_VIEW);
		this.app.workspace.detachLeavesOfType(GAMELOOP_DEBUG_VIEW);

		console.log("--- ⚫⚫⚫ MOTORSPORT MANAGER UNLOADED ⚫⚫⚫ ---");
	}
}
