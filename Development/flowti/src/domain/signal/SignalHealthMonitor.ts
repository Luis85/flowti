/**
 * SignalHealthMonitor — tracks connection health for signal sources.
 *
 * Performs periodic health checks and maintains status history.
 * Does not own I/O — delegates connection tests to the adapter via events.
 */

export type HealthStatus = "healthy" | "degraded" | "unreachable" | "unknown";

export interface SignalHealthState {
	signalId: string;
	status: HealthStatus;
	lastChecked: string | null;
	lastSuccessful: string | null;
	consecutiveFailures: number;
	errorHistory: HealthError[];
}

export interface HealthError {
	timestamp: string;
	message: string;
}

/** Maximum error history entries per signal. */
const MAX_ERROR_HISTORY = 10;

/** Number of consecutive failures before marking as unreachable. */
const UNREACHABLE_THRESHOLD = 3;

export class SignalHealthMonitor {
	private readonly states = new Map<string, SignalHealthState>();

	/** Get health state for a signal. Returns a default "unknown" state if not tracked. */
	getHealth(signalId: string): SignalHealthState {
		const state = this.states.get(signalId);
		if (!state) return createDefaultState(signalId);
		return { ...state, errorHistory: [...state.errorHistory] };
	}

	/** Get all tracked health states. */
	getAllHealth(): SignalHealthState[] {
		return Array.from(this.states.values());
	}

	/** Record a successful health check. */
	recordSuccess(signalId: string): SignalHealthState {
		const state = this.ensureState(signalId);
		const now = new Date().toISOString();
		state.status = "healthy";
		state.lastChecked = now;
		state.lastSuccessful = now;
		state.consecutiveFailures = 0;
		return { ...state, errorHistory: [...state.errorHistory] };
	}

	/** Record a failed health check. */
	recordFailure(signalId: string, message: string): SignalHealthState {
		const state = this.ensureState(signalId);
		const now = new Date().toISOString();
		state.lastChecked = now;
		state.consecutiveFailures++;
		state.errorHistory.unshift({ timestamp: now, message });
		if (state.errorHistory.length > MAX_ERROR_HISTORY) {
			state.errorHistory.length = MAX_ERROR_HISTORY;
		}
		state.status = state.consecutiveFailures >= UNREACHABLE_THRESHOLD
			? "unreachable"
			: "degraded";
		return { ...state, errorHistory: [...state.errorHistory] };
	}

	/** Remove tracking for a signal. */
	remove(signalId: string): void {
		this.states.delete(signalId);
	}

	/** Clear all health states. */
	dispose(): void {
		this.states.clear();
	}

	private ensureState(signalId: string): SignalHealthState {
		if (!this.states.has(signalId)) {
			this.states.set(signalId, createDefaultState(signalId));
		}
		return this.states.get(signalId)!;
	}
}

function createDefaultState(signalId: string): SignalHealthState {
	return {
		signalId,
		status: "unknown",
		lastChecked: null,
		lastSuccessful: null,
		consecutiveFailures: 0,
		errorHistory: [],
	};
}
