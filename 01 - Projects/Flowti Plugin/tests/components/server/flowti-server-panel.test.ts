// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils.js";
import type { ActivityEntry, ServerStats, ServerConfig } from "../../../src/domain/server/types.js";

import "../../../src/components/server/flowti-server-panel.js";

interface PanelEl extends HTMLElement {
	running: boolean;
	pid: number;
	port: number;
	uptime: number;
	url: string;
	entries: ActivityEntry[];
	paused: boolean;
	stats: ServerStats | null;
	config: ServerConfig | null;
	updateComplete: Promise<boolean>;
}

function makeEntries(): ActivityEntry[] {
	return [
		{ id: "1", timestamp: "2026-03-18T10:00:00Z", agentName: "Scout", actionType: "scan", text: "Scanned repo", expanded: false },
	];
}

function makeStats(): ServerStats {
	return { uptime: 60_000, connections: 2, agentCount: 3, storybookProcesses: [] };
}

function makeConfig(): ServerConfig {
	return { port: 3000, logLevel: "info", autoConnect: true };
}

describe("flowti-server-panel", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-server-panel")).toBeDefined();
	});

	it("composes all 4 child components", async () => {
		const el = await fixture<PanelEl>("flowti-server-panel", {
			running: true,
			pid: 1234,
			port: 3000,
			uptime: 60,
			url: "http://localhost:3000",
			entries: makeEntries(),
			paused: false,
			stats: makeStats(),
			config: makeConfig(),
		});

		expect(shadowQuery(el, "flowti-server-status")).not.toBeNull();
		expect(shadowQuery(el, "flowti-activity-feed")).not.toBeNull();
		expect(shadowQuery(el, "flowti-server-stats")).not.toBeNull();
		expect(shadowQuery(el, "flowti-server-config")).not.toBeNull();
	});

	it("renders 4 details sections", async () => {
		const el = await fixture<PanelEl>("flowti-server-panel");
		const sections = shadowQueryAll(el, "details");
		expect(sections.length).toBe(4);
	});

	it("has the Status section open by default", async () => {
		const el = await fixture<PanelEl>("flowti-server-panel");
		const sections = shadowQueryAll<HTMLDetailsElement>(el, "details");
		expect(sections[0].open).toBe(true);
		expect(sections[1].open).toBe(false);
		expect(sections[2].open).toBe(false);
		expect(sections[3].open).toBe(false);
	});

	it("passes running and pid props to server-status", async () => {
		const el = await fixture<PanelEl>("flowti-server-panel", {
			running: true,
			pid: 5678,
			port: 4000,
			uptime: 120,
			url: "http://localhost:4000",
		});

		const status = shadowQuery<HTMLElement & { running: boolean; pid: number }>(el, "flowti-server-status");
		expect(status?.running).toBe(true);
		expect(status?.pid).toBe(5678);
	});

	it("passes entries and paused props to activity-feed", async () => {
		const entries = makeEntries();
		const el = await fixture<PanelEl>("flowti-server-panel", {
			entries,
			paused: true,
		});

		const feed = shadowQuery<HTMLElement & { entries: ActivityEntry[]; paused: boolean }>(el, "flowti-activity-feed");
		expect(feed?.entries).toEqual(entries);
		expect(feed?.paused).toBe(true);
	});
});
