import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { DashboardStore } from "../store/dashboard-store.js";

/**
 * Lit reactive controller that subscribes to DashboardStore "state-changed"
 * events and triggers host updates. Replaces the manual connectedCallback/
 * disconnectedCallback pattern duplicated across 12+ game UI components.
 *
 * Usage:
 *   private storeCtrl = new StoreController(this, () => this.store);
 *
 * The controller auto-subscribes on hostConnected and unsubscribes on
 * hostDisconnected. If the store reference changes between connections
 * (e.g., property reassignment), it correctly unsubscribes from the old store.
 */
export class StoreController implements ReactiveController {
	private handler = () => this.host.requestUpdate();
	private currentStore: DashboardStore | null = null;

	constructor(
		private host: ReactiveControllerHost,
		private getStore: () => DashboardStore | undefined,
	) {
		host.addController(this);
	}

	hostConnected(): void {
		const store = this.getStore();
		if (store) {
			store.addEventListener("state-changed", this.handler);
			this.currentStore = store;
		}
	}

	hostDisconnected(): void {
		this.currentStore?.removeEventListener("state-changed", this.handler);
		this.currentStore = null;
	}
}
