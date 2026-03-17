// @vitest-environment happy-dom
import "../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { buildNudgeNotificationFragment } from "../../src/ui/shared/NudgeNotification";
import type { NudgeConfig } from "../../src/domain/nudge/types";
import type { IEventBus } from "../../src/infrastructure/events/types";

function makeConfig(overrides?: Partial<NudgeConfig>): NudgeConfig {
	return {
		id: "test-nudge",
		time: "09:00",
		sessionType: "documentation",
		title: "Morning Review",
		durationMinutes: 25,
		enabled: true,
		...overrides,
	};
}

function makeEventBus(): IEventBus {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

describe("NudgeNotification", () => {
	it("renders nudge title and time with duration", () => {
		const config = makeConfig({ title: "Afternoon Focus", time: "14:00", durationMinutes: 50 });
		const eventBus = makeEventBus();
		const onHide = vi.fn();

		const fragment = buildNudgeNotificationFragment(config, eventBus, onHide);

		// Append to a container for querying
		const container = document.createElement("div");
		container.appendChild(fragment);

		expect(container.textContent).toContain("Afternoon Focus");
		expect(container.textContent).toContain("14:00");
		expect(container.textContent).toContain("50 min");
	});

	it("renders Start and Dismiss buttons", () => {
		const fragment = buildNudgeNotificationFragment(makeConfig(), makeEventBus(), vi.fn());
		const container = document.createElement("div");
		container.appendChild(fragment);

		const buttons = container.querySelectorAll("button");
		const labels = Array.from(buttons).map((b) => b.textContent);
		expect(labels).toContain("Start");
		expect(labels).toContain("Dismiss");
	});

	it("emits session.create when Start button is clicked", () => {
		const config = makeConfig({ sessionType: "documentation", durationMinutes: 30, title: "Morning Review" });
		const eventBus = makeEventBus();
		const onHide = vi.fn();

		const fragment = buildNudgeNotificationFragment(config, eventBus, onHide);
		const container = document.createElement("div");
		container.appendChild(fragment);

		const startBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Start")!;
		startBtn.click();

		expect(eventBus.emit).toHaveBeenCalledWith(
			"session.create",
			expect.objectContaining({
				type: "documentation",
				title: "Morning Review",
				durationMinutes: 30,
			}),
		);
		expect(onHide).toHaveBeenCalled();
	});

	it("emits nudge.dismiss when Dismiss button is clicked", () => {
		const config = makeConfig({ id: "nudge-42" });
		const eventBus = makeEventBus();
		const onHide = vi.fn();

		const fragment = buildNudgeNotificationFragment(config, eventBus, onHide);
		const container = document.createElement("div");
		container.appendChild(fragment);

		const dismissBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Dismiss")!;
		dismissBtn.click();

		expect(eventBus.emit).toHaveBeenCalledWith(
			"nudge.dismiss",
			{ id: "nudge-42" },
		);
		expect(onHide).toHaveBeenCalled();
	});

	it("omits duration text when durationMinutes is 0", () => {
		const config = makeConfig({ durationMinutes: 0 });
		const fragment = buildNudgeNotificationFragment(config, makeEventBus(), vi.fn());
		const container = document.createElement("div");
		container.appendChild(fragment);

		expect(container.textContent).not.toContain("min");
	});
});
