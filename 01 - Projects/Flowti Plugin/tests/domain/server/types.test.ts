import { describe, it, expectTypeOf } from "vitest";
import type {
	ServerStats, ServerConfig, ActivityEntry,
} from "../../../src/domain/server/types.js";

describe("server domain types", () => {
	it("ServerStats has required readonly fields", () => {
		const stats: ServerStats = {
			uptime: 120,
			connections: 3,
			agentCount: 2,
			storybookProcesses: [{ project: "demo", pid: 1234, url: "http://localhost:6006" }],
		};
		expectTypeOf(stats).toMatchTypeOf<ServerStats>();
		expectTypeOf(stats.uptime).toBeNumber();
		expectTypeOf(stats.connections).toBeNumber();
		expectTypeOf(stats.agentCount).toBeNumber();
		expectTypeOf(stats.storybookProcesses).toBeArray();
	});

	it("ServerStats storybookProcesses items have project, pid, url", () => {
		const proc: ServerStats["storybookProcesses"][number] = {
			project: "app", pid: 42, url: "http://localhost:6006",
		};
		expectTypeOf(proc.project).toBeString();
		expectTypeOf(proc.pid).toBeNumber();
		expectTypeOf(proc.url).toBeString();
	});

	it("ServerConfig has mutable port, logLevel, autoConnect", () => {
		const config: ServerConfig = {
			port: 3000, logLevel: "info", autoConnect: true,
		};
		expectTypeOf(config).toMatchTypeOf<ServerConfig>();
		expectTypeOf(config.port).toBeNumber();
		expectTypeOf(config.logLevel).toBeString();
		expectTypeOf(config.autoConnect).toBeBoolean();
	});

	it("ServerConfig fields are mutable", () => {
		const config: ServerConfig = { port: 3000, logLevel: "info", autoConnect: true };
		config.port = 4000;
		config.logLevel = "debug";
		config.autoConnect = false;
		expectTypeOf(config).toMatchTypeOf<ServerConfig>();
	});

	it("ActivityEntry has required fields", () => {
		const entry: ActivityEntry = {
			id: "act-1",
			timestamp: "2026-03-18T10:00:00Z",
			agentName: "atlas",
			actionType: "speaking",
			text: "Hello world",
			expanded: false,
		};
		expectTypeOf(entry).toMatchTypeOf<ActivityEntry>();
		expectTypeOf(entry.id).toBeString();
		expectTypeOf(entry.timestamp).toBeString();
		expectTypeOf(entry.agentName).toBeString();
		expectTypeOf(entry.actionType).toBeString();
		expectTypeOf(entry.text).toBeString();
		expectTypeOf(entry.expanded).toBeBoolean();
	});
});
