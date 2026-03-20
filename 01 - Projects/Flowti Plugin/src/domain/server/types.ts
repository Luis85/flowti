/**
 * Shared types for optional server / agent orchestration features.
 * Used by tests and any UI that surfaces server stats or activity.
 */

export interface ServerStats {
	readonly uptime: number;
	readonly connections: number;
	readonly agentCount: number;
	readonly storybookProcesses: readonly {
		readonly project: string;
		readonly pid: number;
		readonly url: string;
	}[];
}

export interface ServerConfig {
	port: number;
	logLevel: string;
	autoConnect: boolean;
}

export interface ActivityEntry {
	readonly id: string;
	readonly timestamp: string;
	readonly agentName: string;
	readonly actionType: string;
	readonly text: string;
	readonly expanded: boolean;
}
