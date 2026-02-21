/**
 * Signal domain service — manages external data source connections.
 *
 * Provides CRUD for signal configurations and persists state via TypedStorage.
 * Sync orchestration (fetch → map → create notes) will be added in Inc 5.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type { SignalConfig, SignalState } from "./types";

export interface SignalServiceOptions {
	storage: ITypedStorage<SignalState>;
	eventBus?: IEventBus;
}

/** Input for creating a new signal — system-managed fields are omitted. */
export type SignalConfigInput = Omit<
	SignalConfig,
	"id" | "lastSync" | "lastSyncItemCount" | "status"
>;

function createDefaultState(): SignalState {
	return { signals: [] };
}

function generateId(): string {
	return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class SignalService {
	private state: SignalState = createDefaultState();
	private storage: ITypedStorage<SignalState>;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	constructor(options: SignalServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
	}

	// ── Lifecycle ────────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
		}
		await this.eventBus?.emit("signal.loaded", {
			signalCount: this.state.signals.length,
		});
	}

	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	// ── Queries ──────────────────────────────────────────────

	getSignals(): SignalConfig[] {
		return [...this.state.signals];
	}

	getSignal(id: string): SignalConfig | undefined {
		return this.state.signals.find((s) => s.id === id);
	}

	// ── Commands ─────────────────────────────────────────────

	async configure(input: SignalConfigInput): Promise<SignalConfig> {
		const config: SignalConfig = {
			...input,
			id: generateId(),
			lastSync: null,
			lastSyncItemCount: 0,
			status: "disconnected",
		};

		this.state.signals.push(config);
		await this.saveState();

		await this.eventBus?.emit("signal.configured", {
			signalId: config.id,
			name: config.name,
			type: config.type,
			project: config.project,
		});

		return config;
	}

	async update(
		id: string,
		partial: Partial<Omit<SignalConfig, "id">>,
	): Promise<SignalConfig | undefined> {
		const idx = this.state.signals.findIndex((s) => s.id === id);
		if (idx === -1) return undefined;

		const updated = { ...this.state.signals[idx], ...partial };
		this.state.signals[idx] = updated;
		await this.saveState();

		await this.eventBus?.emit("signal.configured", {
			signalId: updated.id,
			name: updated.name,
			type: updated.type,
			project: updated.project,
		});

		return updated;
	}

	async remove(id: string): Promise<boolean> {
		const signal = this.state.signals.find((s) => s.id === id);
		if (!signal) return false;

		this.state.signals = this.state.signals.filter((s) => s.id !== id);
		await this.saveState();

		await this.eventBus?.emit("signal.removed", {
			signalId: id,
			name: signal.name,
		});

		return true;
	}

	// ── Private ──────────────────────────────────────────────

	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}
}
