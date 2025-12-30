import { ItemView, WorkspaceLeaf } from "obsidian";
import { EventType, IEventBus } from "src/eventsystem";
import { DayPhaseChangedEvent } from "src/eventsystem/engine/DayPhaseChangedEvent";
import { SimulationTickEvent } from "src/eventsystem/engine/SimulationTickEvent";
import { TimeScaleChangedEvent } from "src/eventsystem/engine/TimeScaleChangedEvent";
import { InboxResetedEvent } from "src/eventsystem/messages/InboxResetedEvent";
import { OrderClosedEvent } from "src/eventsystem/orders/OrderClosedEvent";
import { OrderCloseRequestedEvent } from "src/eventsystem/orders/OrderCloseRequestedEvent";
import { OrderProcessRequestedEvent } from "src/eventsystem/orders/OrderProcessRequestedEvent";
import { OrderShippedEvent } from "src/eventsystem/orders/OrderShippedEvent";
import { OrderShipRequestedEvent } from "src/eventsystem/orders/OrderShipRequestedEvent";
import { OrderUpdatedEvent } from "src/eventsystem/orders/OrderUpdatedEvent";
import { SalesOrderCreatedEvent } from "src/eventsystem/orders/SalesOrderCreatedEvent";
import { GoToSleepEvent } from "src/eventsystem/player/GoToSleepEvent";
import { SleepFinishedEvent } from "src/eventsystem/player/SleepFinishedEvent";
import { SleepInterruptedEvent } from "src/eventsystem/player/SleepInterruptedEvent";
import { GameViewModel } from "src/models/GameViewModel";
import { SalesOrder } from "src/models/SalesOrder";
import { OneSeaterSettings } from "src/settings/types";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { FeedPanel } from "../panels/office/FeedPanel";
import { FinancePanel } from "../panels/office/FinancePanel";
import { HeaderControlsPanel } from "../panels/office/HeaderControlsPanel";
import { MessageInboxPanel } from "../panels/office/MessageInboxPanel";
import { PhasePanel } from "../panels/office/PhasePanel";
import { SeasonProgressPanel } from "../panels/office/SeasonProgressPanel";
import { TeamStatusPanel } from "../panels/office/TeamStatusPanel";
import { TimelinePanel } from "../panels/office/TimelinePanel";
import { ISimulation } from "src/simulation/Simulation";


export const GAME_OFFICE_VIEW = "oneseater-office-view";

export class GameView extends ItemView {
	private events: IEventBus;
	// State
	private latest: SimulationStore;
	private resumeMultiplier = 1;
	private feed: string[] = [];

	// Render scheduling
	private rafPending = false;

	// Root
	private rootEl?: HTMLElement;

	// Panels
	private headerPanel: HeaderControlsPanel;
	private timelinePanel = new TimelinePanel();
	private phasePanel = new PhasePanel();
	private feedPanel = new FeedPanel();
	private inboxPanel: MessageInboxPanel;
	private teamStatusPanel = new TeamStatusPanel();
	private financePanel: FinancePanel;
	private seasonPanel = new SeasonProgressPanel();

	constructor(leaf: WorkspaceLeaf, private simulation: ISimulation, private settings: OneSeaterSettings) {
		super(leaf);
		this.events = this.simulation.getEvents();
		this.headerPanel = new HeaderControlsPanel(this.events);
		this.inboxPanel = new MessageInboxPanel(this.simulation.getMessages(), this.events);
		this.financePanel = new FinancePanel(this.events);
	}

	getViewType() {
		return GAME_OFFICE_VIEW;
	}

	getDisplayText() {
		return "OneSeater - Your Office";
	}

	async onOpen() {
		this.setupViewEventHandlers();
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.style.cssText = `padding: 0; overflow: hidden;`;

		// Root
		this.rootEl = container.createDiv({ cls: "mm-game-root" });

		// Header
		this.headerPanel.mount(this.rootEl);

		// Timeline
		this.timelinePanel.mount(this.rootEl);

		// Main content - 3 column layout
		const main = this.rootEl.createDiv({ cls: "mm-main" });

		// LEFT: Inbox (full height)
		const leftCol = main.createDiv({ cls: "mm-col-left" });
		this.inboxPanel.mount(leftCol);
		this.inboxPanel.setApp(this.app);

		// MIDDLE: Team Status + Finance
		const midCol = main.createDiv({ cls: "mm-col-mid" });
		this.financePanel.mount(midCol);
		this.financePanel.setApp(this.app);
		this.financePanel.setCallbacks({
			onViewOrder: this.handleViewOrder,
			onProcessOrder: this.handleProcessOrder,
			onShipOrder: this.handleShipOrder,
			onCloseOrder: this.handleCloseOrder,
		});
		this.teamStatusPanel.mount(midCol);

		// RIGHT: PhasePanel (Control Center) + Season + Feed
		const rightCol = main.createDiv({ cls: "mm-col-right" });

		this.phasePanel.mount(rightCol); // Control Center OBEN
		this.seasonPanel.mount(rightCol); // Season MITTE
		this.feedPanel.mount(rightCol); // Feed UNTEN

		this.requestRender();
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Order Handlers - Publish Request Events (no direct state mutation!)
	// ═══════════════════════════════════════════════════════════════════════════

	private handleViewOrder = (order: SalesOrder) => {
		// Modal opens automatically from FinancePanel
	};

	private handleProcessOrder = (order: SalesOrder) => {
		this.events.publish(new OrderProcessRequestedEvent(order.id, "ui"));
	};

	private handleShipOrder = (order: SalesOrder) => {
		this.events.publish(new OrderShipRequestedEvent(order.id, "ui"));
	};

	private handleCloseOrder = (order: SalesOrder) => {
		this.events.publish(new OrderCloseRequestedEvent(order.id, "ui"));
	};

	// ═══════════════════════════════════════════════════════════════════════════
	// Order Result Event Handlers (from OrderMachine)
	// These update the feed with confirmation messages
	// ═══════════════════════════════════════════════════════════════════════════

	private onSalesOrderCreated = (evt: SalesOrderCreatedEvent) => {
		this.feed.unshift(`[Orders] 📋 New sales order: ${evt.order.customer}`);
	};

	private onOrderUpdated = (evt: OrderUpdatedEvent) => {
		const order = evt.order;
		if (order.status === "active") {
			this.feed.unshift(`[Orders] 📦 Order ${order.id} is now processing`);
		} else if (order.status === "paid") {
			this.feed.unshift(`[Orders] 💰 Payment received for ${order.id}`);
		} else if (order.status === "failed") {
			this.feed.unshift(`[Orders] ❌ Payment failed for ${order.id}`);
		} else if (order.status === "cancelled") {
			this.feed.unshift(`[Orders] 🚫 Order ${order.id} cancelled`);
		}
	};

	private onOrderShipped = (evt: OrderShippedEvent) => {
		this.feed.unshift(`[Orders] 🚚 Order ${evt.order.id} shipped`);
	};

	private onOrderClosed = (evt: OrderClosedEvent) => {
		this.feed.unshift(`[Orders] ✅ Order ${evt.order.id} completed`);
	};

	// ═══════════════════════════════════════════════════════════════════════════
	// Simulation Event Handlers
	// ═══════════════════════════════════════════════════════════════════════════

    private onTick = (event: SimulationTickEvent) => {
        const wasUninitialized = !this.latest;
        this.latest = event.state;
        this.resumeMultiplier = this.latest.speed;

        // Store einmalig setzen beim ersten Tick
        if (wasUninitialized) {
			this.inboxPanel.setSettings(this.settings)
            this.inboxPanel.fullSync();
        }

        this.inboxPanel.setPlayerEnergy(this.latest.player.stats.energy);
        this.inboxPanel.setSleeping(this.latest.player.status === "sleeping");
        this.requestRender();
    };

	private onPhaseChanged = (e: DayPhaseChangedEvent) => {
		this.feed.unshift(`[Day ${e.dayIndex}] Phase: ${e.from} -> ${e.to}`);
	};

	private onTimeScaleChanged = (event: TimeScaleChangedEvent) => {
		this.resumeMultiplier = this.latest.beforePause || 1;
	};

	private onGoToSleep = (msg: GoToSleepEvent) => {
		this.feed.unshift(`[Player] 🛌 Goodnight... ${msg.reason}`);
	};

	private onSleepFinished = (e: SleepFinishedEvent) => {
		this.feed.unshift(
			`[Player] 🥱 Slept for ${Math.round(e.sleptMinutes / 60)}h`
		);
	};

	private onSleepInterrupted = (e: SleepInterruptedEvent) => {
		this.feed.unshift(`[Player] 🔥 Sleep interrupted (${e.reason})`);
	};

	private requestRender(): void {
		if (this.rafPending) return;
		this.rafPending = true;

		// update array operations from tick only before rendertime
		requestAnimationFrame(() => {
			this.rafPending = false;
			this.render();
		});
	}

	private onInboxReseted = (event: InboxResetedEvent) => {
		this.inboxPanel.fullSync();
	}

	private render(): void {
		if (!this.rootEl || !this.latest) return;

		const model: GameViewModel = {
			day: this.latest.dayIndex ?? 1,
			minuteOfDay: this.latest.minuteOfDay,
			phase: this.latest.phase,
			paused: this.latest.paused,
			speed: this.latest.speed,
			resumeSpeed: this.resumeMultiplier,
			feed: this.feed,
			messages: this.simulation.getMessages().messages,
			products: this.simulation.getProducts().getAll(),
			orders: this.latest.orders,
			payments: this.latest.payments,
			player: this.latest.player,
		};

		// Each panel only updates what changed (internal caching)
		// should revisit if really necessary to throw the whole view model around like candy
		this.headerPanel.render(model);
		this.timelinePanel.render(model);
		this.phasePanel.render(model);
		this.feedPanel.render(model);
		this.teamStatusPanel.render(model);
		this.financePanel.render(model);
		this.seasonPanel.render(model);
	}

	private setupViewEventHandlers(): void {
		// Simulation events
		this.sub(DayPhaseChangedEvent, this.onPhaseChanged);
		this.sub(TimeScaleChangedEvent, this.onTimeScaleChanged);
		this.sub(SimulationTickEvent, this.onTick);
		
		// Player events
		this.sub(GoToSleepEvent, this.onGoToSleep);
		this.sub(SleepFinishedEvent, this.onSleepFinished);
		this.sub(SleepInterruptedEvent, this.onSleepInterrupted);
		
		// Order result events (from OrderMachine)
		this.sub(SalesOrderCreatedEvent, this.onSalesOrderCreated);
		this.sub(OrderUpdatedEvent, this.onOrderUpdated);
		this.sub(OrderShippedEvent, this.onOrderShipped);
		this.sub(OrderClosedEvent, this.onOrderClosed);

		this.sub(InboxResetedEvent, this.onInboxReseted)
	}

	private sub<T>(eventType: EventType<T>, handler: (event: T) => void): void {
		this.events.subscribe(eventType, handler);
		this.register(() => {
			this.events.unsubscribe(eventType, handler);
		});
	}

	async onClose() {
		this.headerPanel.destroy();
		this.timelinePanel.destroy();
		this.phasePanel.destroy();
		this.feedPanel.destroy();
		this.inboxPanel.destroy();
		this.teamStatusPanel.destroy();
		this.financePanel.destroy();
		this.seasonPanel.destroy();

		this.rootEl = undefined;
	}
}
