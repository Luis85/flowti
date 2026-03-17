/**
 * SignalDiagnosticsService — orchestrates connection health checks and diagnostics.
 *
 * Coordinates between the SignalAdapter (I/O) and SignalHealthMonitor (pure state)
 * to provide rich diagnostics including latency, API version, and permission scopes.
 * Emits events on health transitions.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { SignalAdapter, TestConnectionResult } from "./adapters/SignalAdapter";
import type { SignalConfig } from "./types";
import { SignalHealthMonitor } from "./SignalHealthMonitor";
import type { SignalHealthState } from "./SignalHealthMonitor";

/** Extended diagnostics returned by a detailed connection test. */
export interface ConnectionDiagnostics extends TestConnectionResult {
	/** Round-trip latency in milliseconds. */
	latencyMs: number;
	/** API version string reported by the service (if available). */
	apiVersion: string | null;
	/** Permission scopes available to the token (if available). */
	scopes: string[];
	/** Timestamp of the check. */
	checkedAt: string;
}

/** Combined health and diagnostics snapshot for a signal. */
export interface SignalDiagnosticsSnapshot {
	health: SignalHealthState;
	lastDiagnostics: ConnectionDiagnostics | null;
}

export interface SignalDiagnosticsServiceOptions {
	adapter: SignalAdapter;
	eventBus: IEventBus;
	monitor?: SignalHealthMonitor;
}

export class SignalDiagnosticsService {
	private readonly adapter: SignalAdapter;
	private readonly eventBus: IEventBus;
	private readonly monitor: SignalHealthMonitor;
	private readonly diagnosticsCache = new Map<string, ConnectionDiagnostics>();

	constructor(options: SignalDiagnosticsServiceOptions) {
		this.adapter = options.adapter;
		this.eventBus = options.eventBus;
		this.monitor = options.monitor ?? new SignalHealthMonitor();
	}

	/** Get the underlying health monitor for direct state access. */
	getMonitor(): SignalHealthMonitor {
		return this.monitor;
	}

	/** Run a health check against a signal's connection. */
	async checkHealth(config: SignalConfig): Promise<ConnectionDiagnostics> {
		const start = Date.now();
		let result: TestConnectionResult;
		try {
			result = await this.adapter.testConnection(config);
		} catch (err: unknown) {
			result = {
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			};
		}
		const latencyMs = Date.now() - start;

		const diagnostics: ConnectionDiagnostics = {
			...result,
			latencyMs,
			apiVersion: null,
			scopes: [],
			checkedAt: new Date().toISOString(),
		};

		this.diagnosticsCache.set(config.id, diagnostics);

		const previousHealth = this.monitor.getHealth(config.id);
		const previousStatus = previousHealth.status;

		const newHealth = result.success
			? this.monitor.recordSuccess(config.id)
			: this.monitor.recordFailure(config.id, result.error ?? "Unknown error");

		void this.eventBus.emit("signal.health.checked", {
			signalId: config.id,
			status: newHealth.status,
			latencyMs,
			success: result.success,
		});

		if (previousStatus !== newHealth.status) {
			void this.eventBus.emit("signal.health.changed", {
				signalId: config.id,
				previousStatus,
				newStatus: newHealth.status,
			});
		}

		return diagnostics;
	}

	/** Get combined health state and last diagnostics for a signal. */
	getDiagnostics(signalId: string): SignalDiagnosticsSnapshot {
		return {
			health: this.monitor.getHealth(signalId),
			lastDiagnostics: this.diagnosticsCache.get(signalId) ?? null,
		};
	}

	/** Record an external success (e.g. from a successful sync). */
	recordSuccess(signalId: string): SignalHealthState {
		return this.monitor.recordSuccess(signalId);
	}

	/** Record an external failure (e.g. from a failed sync). */
	recordFailure(signalId: string, message: string): SignalHealthState {
		return this.monitor.recordFailure(signalId, message);
	}

	/** Remove tracking for a signal. */
	remove(signalId: string): void {
		this.monitor.remove(signalId);
		this.diagnosticsCache.delete(signalId);
	}

	/** Clear all state. */
	dispose(): void {
		this.monitor.dispose();
		this.diagnosticsCache.clear();
	}
}
