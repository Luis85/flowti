export interface ServerStats {
	readonly uptime: number;
	readonly connections: number;
	readonly agentCount: number;
	readonly storybookProcesses: Array<{ project: string; pid: number; url: string }>;
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
	expanded: boolean;
}
