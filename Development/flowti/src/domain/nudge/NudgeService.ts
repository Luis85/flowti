/**
 * Nudge domain service.
 *
 * Evaluates nudge configurations on a 60s interval against the current
 * local time, emitting `nudge.triggered` when a match is found.
 * Dismissed nudges are tracked per-day with midnight rollover.
 *
 * No dependency on SessionService — the "Start" action is handled
 * externally by listening to `nudge.triggered` and emitting `session.create`.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type { NudgeConfig, NudgeId, NudgeState } from "./types";
import { DEFAULT_NUDGE_CONFIGS, NUDGE_EVAL_INTERVAL_MS } from "./types";

/** Configuration options for the NudgeService. */
export interface NudgeServiceOptions {
	storage: ITypedStorage<NudgeState>;
	eventBus?: IEventBus;
	/** Override for current time (testing). Returns [hours, minutes]. */
	getNow?: () => [number, number];
	/** Override for current date string (testing). Returns YYYY-MM-DD. */
	getToday?: () => string;
	/** Returns true if a session of the given type is currently active. */
	isSessionTypeActive?: (sessionType: string) => boolean;
}

function createDefaultState(): NudgeState {
	return {
		configs: [...DEFAULT_NUDGE_CONFIGS],
		dismissedToday: [],
		lastRolloverDate: new Date().toISOString().slice(0, 10),
	};
}

export class NudgeService {
	private state: NudgeState = createDefaultState();
	private storage: ITypedStorage<NudgeState>;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private getNow: () => [number, number];
	private getToday: () => string;
	isSessionTypeActive: (sessionType: string) => boolean;

	constructor(options: NudgeServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.getNow = options.getNow ?? (() => {
			const now = new Date();
			return [now.getHours(), now.getMinutes()];
		});
		this.getToday = options.getToday ?? (() => new Date().toISOString().slice(0, 10));
		this.isSessionTypeActive = options.isSessionTypeActive ?? (() => false);

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("nudge.configure", (event) => {
					void this.handleConfigure(event.payload.config);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("nudge.remove", (event) => {
					void this.handleRemove(event.payload.id);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("nudge.dismiss", (event) => {
					void this.handleDismiss(event.payload.id);
				}),
			);
		}
	}

	/** Load persisted state from storage. Must be called before start(). */
	async load(): Promise<void> {
		const stored = await this.storage.load();
		if (stored) {
			this.state = stored;
		} else {
			this.state = createDefaultState();
			this.state.lastRolloverDate = this.getToday();
			await this.saveState();
		}
		await this.eventBus?.emit("nudge.loaded", { configs: [...this.state.configs] });
	}

	/** Start the evaluation interval. */
	start(): void {
		if (this.intervalId) return;
		this.intervalId = setInterval(() => {
			void this.evaluate();
		}, NUDGE_EVAL_INTERVAL_MS);
	}

	/** Stop the evaluation interval. */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/** Run a single evaluation cycle (public for testing). */
	async evaluate(): Promise<void> {
		this.checkMidnightRollover();

		const [hours, minutes] = this.getNow();
		const currentTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

		for (const config of this.state.configs) {
			if (!config.enabled) continue;
			if (config.time !== currentTime) continue;
			if (this.state.dismissedToday.includes(config.id)) continue;
			if (this.isSessionTypeActive(config.sessionType)) continue;

			// Emit first, then persist dismiss (prevents lost nudge if handler fails)
			await this.eventBus?.emit("nudge.triggered", { config: { ...config } });
			this.state.dismissedToday.push(config.id);
			await this.saveState();
		}
	}

	/** Dismiss a nudge for today. */
	private async handleDismiss(id: NudgeId): Promise<void> {
		if (!this.state.dismissedToday.includes(id)) {
			this.state.dismissedToday.push(id);
			await this.saveState();
		}
		await this.eventBus?.emit("nudge.dismissed", { id });
	}

	/** Add or update a nudge configuration. */
	private async handleConfigure(config: NudgeConfig): Promise<void> {
		const idx = this.state.configs.findIndex((c) => c.id === config.id);
		if (idx >= 0) {
			this.state.configs[idx] = config;
		} else {
			this.state.configs.push(config);
		}
		await this.saveState();
		await this.eventBus?.emit("nudge.configured", { config: { ...config } });
	}

	/** Remove a nudge configuration. */
	private async handleRemove(id: NudgeId): Promise<void> {
		this.state.configs = this.state.configs.filter((c) => c.id !== id);
		this.state.dismissedToday = this.state.dismissedToday.filter((d) => d !== id);
		await this.saveState();
		await this.eventBus?.emit("nudge.removed", { id });
	}

	/** Clear dismissed set when date changes. */
	private checkMidnightRollover(): void {
		const today = this.getToday();
		if (today !== this.state.lastRolloverDate) {
			this.state.dismissedToday = [];
			this.state.lastRolloverDate = today;
		}
	}

	// ── Queries ───────────────────────────────────────────────

	getConfigs(): NudgeConfig[] {
		return [...this.state.configs];
	}

	getConfigById(id: NudgeId): NudgeConfig | undefined {
		return this.state.configs.find((c) => c.id === id);
	}

	isDismissedToday(id: NudgeId): boolean {
		return this.state.dismissedToday.includes(id);
	}

	// ── Internal ──────────────────────────────────────────────

	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}

	dispose(): void {
		this.stop();
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}
}
