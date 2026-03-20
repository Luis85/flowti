import { describe, it, expectTypeOf } from "vitest";
import type {
	ServerStats, ServerConfig, ActivityEntry,
} from "../../../src/domain/server/types.js";

describe("server domain types", () => {
	it("ServerStats has required readonly fields", () => {
		const stats = {
			uptime: 120,
			connections: 3,
			agentCount: 2,
			storybookProcesses: [{ project: "demo", pid: 1234, url: "http://localhost:6006" }],
		} satisfies ServerStats;
		expectTypeOf(stats).toMatchTypeOf<ServerStats>();
	});

	it("ServerStats storybookProcesses items have project, pid, url", () => {
		const proc = {
			project: "app", pid: 42, url: "http://localhost:6006",
		} satisfies ServerStats["storybookProcesses"][number];
		expectTypeOf(proc).toMatchTypeOf<ServerStats["storybookProcesses"][number]>();
	});

	it("ServerConfig has mutable port, logLevel, autoConnect", () => {
		const config = {
			port: 3000, logLevel: "info", autoConnect: true,
		} satisfies ServerConfig;
		expectTypeOf(config).toMatchTypeOf<ServerConfig>();
	});

	it("ServerConfig fields are mutable", () => {
		const config: ServerConfig = { port: 3000, logLevel: "info", autoConnect: true };
		config.port = 4000;
		config.logLevel = "debug";
		config.autoConnect = false;
		expectTypeOf(config).toMatchTypeOf<ServerConfig>();
	});

	it("ActivityEntry has required fields", () => {
		const entry = {
			id: "act-1",
			timestamp: "2026-03-18T10:00:00Z",
			agentName: "atlas",
			actionType: "speaking",
			text: "Hello world",
			expanded: false,
		} satisfies ActivityEntry;
		expectTypeOf(entry).toMatchTypeOf<ActivityEntry>();
	});
});
