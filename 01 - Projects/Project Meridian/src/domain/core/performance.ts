export interface SystemTiming {
	name: string;
	durationMs: number;
}

export interface TickPerformance {
	tick: number;
	totalMs: number;
	systems: SystemTiming[];
}

export interface PerformanceTracker {
	/** Whether tracking is enabled */
	readonly enabled: boolean;
	/** Enable/disable tracking */
	setEnabled(enabled: boolean): void;
	/** Start timing a system */
	startSystem(name: string): void;
	/** End timing the current system */
	endSystem(): void;
	/** Complete the tick and record the result */
	completeTick(tick: number): TickPerformance | null;
	/** Get the last N tick performances */
	history(limit?: number): TickPerformance[];
	/** Get average system times over last N ticks */
	averages(ticks?: number): Map<string, number>;
}
