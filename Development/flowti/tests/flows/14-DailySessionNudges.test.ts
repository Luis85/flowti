/**
 * Flow 14: Daily Session Nudges
 *
 * Tests the nudge-to-session workflow end-to-end:
 * Configure nudge → time matches → nudge.triggered → listener creates session →
 * session starts → nudge skips while active → dismiss → midnight rollover.
 *
 * Covers: Three Amigos OBS-2 (FR-08c nudge flow integration test gap).
 *
 * Event sequence (happy path):
 *   nudge.configure → nudge.configured →
 *   (time match) → nudge.triggered →
 *   (external listener) → session.create → session.created →
 *   session.start → session.started →
 *   (nudge skips — session type active) →
 *   session.complete → session.completed →
 *   nudge.dismiss → nudge.dismissed →
 *   (midnight rollover) → dismissed set cleared
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SessionService } from "../../src/domain/session/SessionService";
import { NudgeService } from "../../src/domain/nudge/NudgeService";
import type { SessionState } from "../../src/domain/session/types";
import type { NudgeState, NudgeConfig } from "../../src/domain/nudge/types";
import { createMockStorage, collectEvents } from "./testHelpers";
import { createMockFileSystem } from "../mocks/filesystem";

async function flush(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("Flow 14: Daily Session Nudges", () => {
	let eventBus: IEventBus;
	let sessionService: SessionService;
	let nudgeService: NudgeService;
	let sessionStorage: ReturnType<typeof createMockStorage<SessionState>>;
	let nudgeStorage: ReturnType<typeof createMockStorage<NudgeState>>;
	let fileSystem: ReturnType<typeof createMockFileSystem>;
	let currentTime: [number, number];
	let currentDate: string;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-18T08:00:00.000Z"));
		eventBus = new EventBus();
		sessionStorage = createMockStorage<SessionState>();
		nudgeStorage = createMockStorage<NudgeState>();
		fileSystem = createMockFileSystem();
		currentTime = [8, 0];
		currentDate = "2026-02-18";

		sessionService = new SessionService({
			storage: sessionStorage.storage,
			eventBus,
			fileSystem,
		});

		nudgeService = new NudgeService({
			storage: nudgeStorage.storage,
			eventBus,
			getNow: () => currentTime,
			getToday: () => currentDate,
			isSessionTypeActive: (type) => {
				const active = sessionService.getActiveSession();
				if (active && active.type === type) return true;
				const daily = sessionService.getDailySession();
				if (daily && daily.type === type) return true;
				return false;
			},
		});

		// Wire nudge.triggered → session.create (simulates main.ts wiring)
		eventBus.on("nudge.triggered", (event) => {
			const config = event.payload.config;
			if (config.sessionType === "daily-tracking") {
				void eventBus.emit("session.daily.start", {});
			} else {
				void eventBus.emit("session.create", {
					type: config.sessionType,
					title: config.title,
					durationMinutes: config.durationMinutes,
				});
			}
		});
	});

	afterEach(() => {
		nudgeService.dispose();
		sessionService.dispose();
		vi.useRealTimers();
	});

	// ── Nudge triggers session creation ──────────────────────

	it("triggers a nudge at configured time and creates a session", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		const events = collectEvents(eventBus, "*");

		// Configure a nudge for 09:00
		await eventBus.emit("nudge.configure", {
			config: {
				id: "morning-docs",
				time: "09:00",
				sessionType: "documentation",
				title: "Morning Documentation",
				durationMinutes: 50,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// Set time to 09:00 and evaluate
		currentTime = [9, 0];
		await nudgeService.evaluate();
		await flush();

		// Verify nudge was triggered
		expect(events).toContain("nudge.triggered");

		// Verify session was created from nudge config
		expect(events).toContain("session.created");
		const sessions = sessionService.getSessions();
		expect(sessions).toHaveLength(1);
		expect(sessions[0].title).toBe("Morning Documentation");
		expect(sessions[0].type).toBe("documentation");
		expect(sessions[0].durationMinutes).toBe(50);
	});

	it("triggers a daily-tracking nudge and starts daily session", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		// Configure a daily nudge
		await eventBus.emit("nudge.configure", {
			config: {
				id: "daily-morning",
				time: "09:00",
				sessionType: "daily-tracking",
				title: "Start Daily Tracking",
				durationMinutes: 0,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// Trigger at 09:00
		currentTime = [9, 0];
		await nudgeService.evaluate();
		await flush();

		// Daily session should be started
		const daily = sessionService.getDailySession();
		expect(daily).not.toBeNull();
		expect(daily!.type).toBe("daily-tracking");
		expect(daily!.status).toBe("active");
	});

	// ── Nudge skips when session type active ─────────────────

	it("skips nudge when session of same type is already active", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		// Configure nudge for documentation sessions
		await eventBus.emit("nudge.configure", {
			config: {
				id: "docs-nudge",
				time: "09:00",
				sessionType: "documentation",
				title: "Docs Nudge",
				durationMinutes: 25,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// Create and start a documentation session manually
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Already Working",
			durationMinutes: 25,
		});
		await flush();
		const sessions = sessionService.getSessions();
		await eventBus.emit("session.start", { sessionId: sessions[0].id });
		await flush();

		// Set time to 09:00 and evaluate — nudge should be skipped
		currentTime = [9, 0];
		const triggeredHandler = vi.fn();
		eventBus.on("nudge.triggered", triggeredHandler);
		await nudgeService.evaluate();
		await flush();

		expect(triggeredHandler).not.toHaveBeenCalled();
	});

	// ── Dismiss nudge ────────────────────────────────────────

	it("dismisses a nudge for the rest of the day", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		// Configure an enabled nudge
		await eventBus.emit("nudge.configure", {
			config: {
				id: "dismiss-test",
				time: "09:00",
				sessionType: "documentation",
				title: "Dismiss Me",
				durationMinutes: 25,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// Dismiss it
		await eventBus.emit("nudge.dismiss", { id: "dismiss-test" });
		await flush();

		expect(nudgeService.isDismissedToday("dismiss-test")).toBe(true);

		// Evaluate at 09:00 — should not trigger
		currentTime = [9, 0];
		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);
		await nudgeService.evaluate();
		await flush();

		expect(handler).not.toHaveBeenCalled();
	});

	// ── Midnight rollover ────────────────────────────────────

	it("clears dismissed nudges after midnight rollover", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		// Configure nudge
		await eventBus.emit("nudge.configure", {
			config: {
				id: "rollover-test",
				time: "09:00",
				sessionType: "documentation",
				title: "Rollover Test",
				durationMinutes: 25,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// Trigger at 09:00 (auto-dismisses after triggering)
		currentTime = [9, 0];
		await nudgeService.evaluate();
		await flush();
		expect(nudgeService.isDismissedToday("rollover-test")).toBe(true);

		// Advance to next day
		currentDate = "2026-02-19";
		currentTime = [9, 0];
		await nudgeService.evaluate();
		await flush();

		// Should have fired again after midnight rollover
		const handler = vi.fn();
		// Check dismissed is cleared (rollover happened during evaluate)
		// The evaluate call above should have triggered again since date changed
		const sessions = sessionService.getSessions();
		expect(sessions.length).toBeGreaterThanOrEqual(2);
	});

	// ── Auto-dismiss after trigger ───────────────────────────

	it("auto-dismisses a nudge after triggering to prevent re-trigger", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		await eventBus.emit("nudge.configure", {
			config: {
				id: "auto-dismiss",
				time: "09:00",
				sessionType: "documentation",
				title: "Auto Dismiss",
				durationMinutes: 25,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// First evaluation at 09:00 — triggers
		currentTime = [9, 0];
		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);
		await nudgeService.evaluate();
		await flush();
		expect(handler).toHaveBeenCalledTimes(1);

		// Second evaluation at 09:00 — should NOT trigger (auto-dismissed)
		await nudgeService.evaluate();
		await flush();
		expect(handler).toHaveBeenCalledTimes(1); // still 1
	});

	// ── Disabled nudge does not trigger ──────────────────────

	it("does not trigger a disabled nudge", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		await eventBus.emit("nudge.configure", {
			config: {
				id: "disabled-nudge",
				time: "09:00",
				sessionType: "documentation",
				title: "Disabled",
				durationMinutes: 25,
				enabled: false,
			} as NudgeConfig,
		});
		await flush();

		currentTime = [9, 0];
		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);
		await nudgeService.evaluate();
		await flush();

		expect(handler).not.toHaveBeenCalled();
	});

	// ── Full end-to-end flow ─────────────────────────────────

	it("full flow: configure → trigger → create session → start → complete → next day trigger", async () => {
		await sessionService.load();
		await nudgeService.load();
		await flush();

		const events = collectEvents(eventBus, "*");

		// 1. Configure a nudge
		await eventBus.emit("nudge.configure", {
			config: {
				id: "e2e-nudge",
				time: "09:00",
				sessionType: "documentation",
				title: "Morning Docs",
				durationMinutes: 25,
				enabled: true,
			} as NudgeConfig,
		});
		await flush();

		// 2. Time reaches 09:00 — nudge fires, session created
		currentTime = [9, 0];
		await nudgeService.evaluate();
		await flush();

		expect(events).toContain("nudge.triggered");
		expect(events).toContain("session.created");
		const session = sessionService.getSessions()[0];
		expect(session.title).toBe("Morning Docs");

		// 3. Start the session
		await eventBus.emit("session.start", { sessionId: session.id });
		await flush();
		expect(sessionService.getActiveSession()?.id).toBe(session.id);

		// 4. Complete the session
		vi.advanceTimersByTime(5000);
		await eventBus.emit("session.complete", { sessionId: session.id });
		await flush();
		expect(sessionService.getActiveSession()).toBeNull();

		// 5. Same time same day — auto-dismissed, no re-trigger
		const triggeredHandler = vi.fn();
		eventBus.on("nudge.triggered", triggeredHandler);
		await nudgeService.evaluate();
		await flush();
		expect(triggeredHandler).not.toHaveBeenCalled();

		// 6. Next day at 09:00 — nudge fires again
		currentDate = "2026-02-19";
		await nudgeService.evaluate();
		await flush();
		expect(triggeredHandler).toHaveBeenCalledOnce();

		// 7. New session created from nudge
		const allSessions = sessionService.getSessions();
		expect(allSessions).toHaveLength(2);
		expect(allSessions[1].title).toBe("Morning Docs");
	});
});
