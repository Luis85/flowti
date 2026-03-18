// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/server/flowti-server-stats.js";
import { fixture, cleanup, shadowQueryAll, shadowText } from "../test-utils.js";
import type { ServerStats } from "../../../src/domain/server/types.js";

interface StatsEl extends HTMLElement {
	stats: ServerStats | null;
	updateComplete: Promise<boolean>;
}

function makeStats(overrides: Partial<ServerStats> = {}): ServerStats {
	return {
		uptime: 3_661_000,
		connections: 3,
		agentCount: 5,
		storybookProcesses: [
			{ project: "Flowti CLI", pid: 1234, url: "http://localhost:6006" },
			{ project: "Flowti Plugin", pid: 5678, url: "http://localhost:6007" },
		],
		...overrides,
	};
}

describe("flowti-server-stats", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-server-stats")).toBeDefined();
	});

	it("renders loading state when stats is null", async () => {
		const el = await fixture<StatsEl>("flowti-server-stats", { stats: null });
		const text = shadowText(el);
		expect(text).toContain("Loading");
	});

	it("renders 4 stat cards when stats are provided", async () => {
		const el = await fixture<StatsEl>("flowti-server-stats", { stats: makeStats() });
		const cards = shadowQueryAll(el, ".stat-card");
		expect(cards.length).toBe(4);
	});

	it("displays correct stat values", async () => {
		const el = await fixture<StatsEl>("flowti-server-stats", {
			stats: makeStats({ connections: 7, agentCount: 12 }),
		});

		const values = shadowQueryAll(el, ".stat-card__value").map((v) => v.textContent?.trim());
		expect(values[0]).toBe("7");
		expect(values[1]).toBe("12");
	});

	it("shows storybook process count", async () => {
		const el = await fixture<StatsEl>("flowti-server-stats", {
			stats: makeStats({
				storybookProcesses: [
					{ project: "A", pid: 1, url: "http://localhost:6006" },
					{ project: "B", pid: 2, url: "http://localhost:6007" },
					{ project: "C", pid: 3, url: "http://localhost:6008" },
				],
			}),
		});

		const values = shadowQueryAll(el, ".stat-card__value").map((v) => v.textContent?.trim());
		expect(values[2]).toBe("3");
	});

	it("formats uptime with hours and minutes", async () => {
		const el = await fixture<StatsEl>("flowti-server-stats", {
			stats: makeStats({ uptime: 3_661_000 }),
		});

		const values = shadowQueryAll(el, ".stat-card__value").map((v) => v.textContent?.trim());
		expect(values[3]).toBe("1h 1m");
	});

	it("formats uptime as minutes:seconds when under an hour", async () => {
		const el = await fixture<StatsEl>("flowti-server-stats", {
			stats: makeStats({ uptime: 125_000 }),
		});

		const values = shadowQueryAll(el, ".stat-card__value").map((v) => v.textContent?.trim());
		expect(values[3]).toBe("2:05");
	});
});
