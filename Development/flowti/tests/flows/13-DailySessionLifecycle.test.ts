/**
 * Flow 13: Daily Session Lifecycle
 *
 * Tests the full daily tracking session lifecycle end-to-end:
 * Auto-start → concurrent tracking (daily + focused) → focused complete →
 * daily stop → same-day restart → daily stop again → verify summary.
 *
 * Covers: PBI-SW-007 (Auto-Session & Nudges) — daily lifecycle portion.
 *
 * Event sequence (happy path):
 *   session.daily.start → session.daily.started →
 *   (file events tracked in both sessions concurrently) →
 *   session.complete → session.completed →
 *   session.daily.stop → session.daily.stopped →
 *   session.daily.start (same-day restart) → session.daily.started →
 *   session.daily.stop → session.daily.stopped
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SessionService } from "../../src/domain/session/SessionService";
import type { SessionState } from "../../src/domain/session/types";
import { generateDailySummary } from "../../src/domain/session/helpers";
import { createMockStorage, collectEvents } from "./testHelpers";
import { createMockFileSystem } from "../mocks/filesystem";

/**
 * Flush detached promises from `void` handlers in SessionService.
 * Activity tracking uses `void this.onActivityEvent(...)` which creates
 * fire-and-forget promises. This helper flushes the microtask queue.
 */
async function flush(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("Flow 13: Daily Session Lifecycle", () => {
	let eventBus: IEventBus;
	let service: SessionService;
	let storage: ReturnType<typeof createMockStorage<SessionState>>;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-18T08:00:00.000Z"));
		eventBus = new EventBus();
		storage = createMockStorage<SessionState>();
		fileSystem = createMockFileSystem();
		service = new SessionService({ storage: storage.storage, eventBus, fileSystem });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	// ── Helper: emit file event + flush ─────────────────────────

	async function fileEvent(type: "file.created" | "file.modified" | "file.deleted", path: string): Promise<void> {
		await eventBus.emit(type, { path, source: "user" } as never);
		await flush();
	}

	// ── Auto-start daily session ──────────────────────────────

	it("starts a daily session and tracks it as active", async () => {
		const events = collectEvents(eventBus, "*");

		await eventBus.emit("session.daily.start", { dailyNotePath: "Daily/{{date:YYYY-MM-DD}}.md" });

		const daily = service.getDailySession();
		expect(daily).toBeTruthy();
		expect(daily!.type).toBe("daily-tracking");
		expect(daily!.status).toBe("active");
		expect(daily!.title).toContain("2026-02-18");
		expect(daily!.notesFile).toBe("Daily/2026-02-18.md");
		expect(events).toContain("session.daily.started");
	});

	it("ignores duplicate daily start when one is already active", async () => {
		await eventBus.emit("session.daily.start", {});
		const first = service.getDailySession();

		await eventBus.emit("session.daily.start", {});
		const second = service.getDailySession();

		expect(first!.id).toBe(second!.id);
		expect(service.getSessions().filter((s) => s.type === "daily-tracking")).toHaveLength(1);
	});

	// ── Concurrent tracking (daily + focused) ─────────────────

	it("tracks file activity in both daily and focused sessions concurrently", async () => {
		// Start daily
		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		// Create and start a focused session
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Write Docs",
			durationMinutes: 25,
		});
		const focusedId = service.getSessions().find((s) => s.type === "documentation")!.id;
		await eventBus.emit("session.start", { sessionId: focusedId });

		// Simulate file events (with flush to ensure detached promises complete)
		vi.setSystemTime(new Date("2026-02-18T08:05:00.000Z"));
		await fileEvent("file.modified", "docs/readme.md");
		vi.setSystemTime(new Date("2026-02-18T08:10:00.000Z"));
		await fileEvent("file.created", "docs/api.md");

		// Both sessions should have tracked activity
		const daily = service.getSessionById(dailyId)!;
		const focused = service.getSessionById(focusedId)!;

		expect(daily.activity.length).toBe(2);
		expect(focused.activity.length).toBe(2);
		expect(daily.activity.map((a) => a.path)).toEqual(["docs/readme.md", "docs/api.md"]);
		expect(focused.activity.map((a) => a.path)).toEqual(["docs/readme.md", "docs/api.md"]);
	});

	it("daily session continues tracking after focused session completes", async () => {
		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		// Create, start, and complete a focused session
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Quick Edit",
			durationMinutes: 10,
		});
		const focusedId = service.getSessions().find((s) => s.type === "documentation")!.id;
		await eventBus.emit("session.start", { sessionId: focusedId });

		vi.setSystemTime(new Date("2026-02-18T08:05:00.000Z"));
		await fileEvent("file.modified", "src/before.ts");

		// Complete focused
		vi.setSystemTime(new Date("2026-02-18T08:10:00.000Z"));
		await eventBus.emit("session.complete", { sessionId: focusedId });
		await flush();

		// More activity after focused ends — only daily should track
		vi.setSystemTime(new Date("2026-02-18T08:15:00.000Z"));
		await fileEvent("file.modified", "src/after.ts");

		const daily = service.getSessionById(dailyId)!;
		expect(daily.activity.length).toBe(2);
		expect(daily.activity.map((a) => a.path)).toEqual(["src/before.ts", "src/after.ts"]);

		const focused = service.getSessionById(focusedId)!;
		expect(focused.activity.length).toBe(1);
		expect(focused.activity[0].path).toBe("src/before.ts");
	});

	// ── Daily stop ────────────────────────────────────────────

	it("stops daily session and emits session.daily.stopped with completed session", async () => {
		const events = collectEvents(eventBus, "*");

		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		// Some activity
		vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
		await fileEvent("file.modified", "notes/meeting.md");

		// Stop daily
		vi.setSystemTime(new Date("2026-02-18T17:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		const daily = service.getSessionById(dailyId)!;
		expect(daily.status).toBe("completed");
		expect(daily.completedAt).toBeTruthy();
		expect(daily.activity).toHaveLength(1);
		expect(service.getDailySession()).toBeNull();
		expect(events).toContain("session.daily.stopped");
	});

	it("accumulates elapsed time correctly on daily stop", async () => {
		vi.setSystemTime(new Date("2026-02-18T08:00:00.000Z"));
		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		// Stop 4 hours later
		vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		const daily = service.getSessionById(dailyId)!;
		const fourHoursMs = 4 * 60 * 60 * 1000;
		expect(daily.elapsedBeforePauseMs).toBe(fourHoursMs);
	});

	// ── Same-day restart ──────────────────────────────────────

	it("restarts the same daily session on same-day start after stop", async () => {
		const events = collectEvents(eventBus, "*");

		// First daily session
		vi.setSystemTime(new Date("2026-02-18T08:00:00.000Z"));
		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		vi.setSystemTime(new Date("2026-02-18T08:30:00.000Z"));
		await fileEvent("file.modified", "morning-work.md");

		// Stop at noon
		vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		expect(service.getDailySession()).toBeNull();

		// Restart same day (simulates re-opening Obsidian)
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		await eventBus.emit("session.daily.start", {});

		const restarted = service.getDailySession();
		expect(restarted).toBeTruthy();
		expect(restarted!.id).toBe(dailyId); // Same session, not a new one
		expect(restarted!.status).toBe("active");
		// Activity from morning should still be there
		expect(restarted!.activity).toHaveLength(1);
		expect(restarted!.activity[0].path).toBe("morning-work.md");

		// Track afternoon activity
		vi.setSystemTime(new Date("2026-02-18T14:30:00.000Z"));
		await fileEvent("file.created", "afternoon-work.md");

		// Stop again in the evening
		vi.setSystemTime(new Date("2026-02-18T18:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		const final = service.getSessionById(dailyId)!;
		expect(final.status).toBe("completed");
		expect(final.activity).toHaveLength(2);
		expect(final.activity.map((a) => a.path)).toEqual(["morning-work.md", "afternoon-work.md"]);

		// Verify event sequence — filter to state events only (not commands)
		const dailyStateEvents = events.filter((e) =>
			e === "session.daily.started" || e === "session.daily.stopped",
		);
		expect(dailyStateEvents).toEqual([
			"session.daily.started",
			"session.daily.stopped",
			"session.daily.started",
			"session.daily.stopped",
		]);
	});

	it("accumulates elapsed time across restart segments", async () => {
		// Morning segment: 08:00 → 12:00 (4 hours)
		vi.setSystemTime(new Date("2026-02-18T08:00:00.000Z"));
		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		// Afternoon segment: 14:00 → 18:00 (4 hours)
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		await eventBus.emit("session.daily.start", {});

		vi.setSystemTime(new Date("2026-02-18T18:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		const daily = service.getSessionById(dailyId)!;
		const eightHoursMs = 8 * 60 * 60 * 1000;
		expect(daily.elapsedBeforePauseMs).toBe(eightHoursMs);
	});

	// ── Daily summary generation ──────────────────────────────

	it("generates grouped daily summary from completed daily session", async () => {
		await eventBus.emit("session.daily.start", {});
		const dailyId = service.getDailySession()!.id;

		// Simulate a day of work
		vi.setSystemTime(new Date("2026-02-18T09:00:00.000Z"));
		await fileEvent("file.modified", "notes/meeting.md");
		vi.setSystemTime(new Date("2026-02-18T09:30:00.000Z"));
		await fileEvent("file.modified", "notes/meeting.md");
		vi.setSystemTime(new Date("2026-02-18T10:00:00.000Z"));
		await fileEvent("file.created", "src/feature.ts");
		vi.setSystemTime(new Date("2026-02-18T11:00:00.000Z"));
		await fileEvent("file.modified", "src/feature.ts");
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		await fileEvent("file.modified", "docs/api.md");

		// Stop
		vi.setSystemTime(new Date("2026-02-18T17:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		const daily = service.getSessionById(dailyId)!;
		const summary = generateDailySummary(daily);

		// Verify summary structure
		expect(summary).toContain("## Daily Activity Summary");
		expect(summary).toContain("**3 files**");
		expect(summary).toContain("**5 events**");

		// Verify file grouping (newest-first)
		expect(summary).toContain("[[docs/api.md|api.md]]");
		expect(summary).toContain("[[src/feature.ts|feature.ts]]");
		expect(summary).toContain("[[notes/meeting.md|meeting.md]]");

		// Verify count badges for multi-event files
		expect(summary).toContain("(×2)"); // meeting.md and feature.ts each have 2 events

		// Verify time section
		expect(summary).toContain("### Time");
	});

	// ── Full lifecycle integration ────────────────────────────

	it("runs the full daily lifecycle: start → concurrent → focused complete → stop → restart → stop", async () => {
		const events = collectEvents(eventBus, "*");

		// 1. Daily auto-start at 8 AM
		vi.setSystemTime(new Date("2026-02-18T08:00:00.000Z"));
		await eventBus.emit("session.daily.start", { dailyNotePath: "Daily/{{date:YYYY-MM-DD}}.md" });
		const dailyId = service.getDailySession()!.id;

		// 2. Some morning file work (daily only)
		vi.setSystemTime(new Date("2026-02-18T08:30:00.000Z"));
		await fileEvent("file.modified", "inbox/todo.md");

		// 3. Start a focused session at 9 AM
		vi.setSystemTime(new Date("2026-02-18T09:00:00.000Z"));
		await eventBus.emit("session.create", {
			type: "domain-design",
			title: "Implement Feature X",
			durationMinutes: 50,
		});
		const focusedId = service.getSessions().find((s) => s.type === "domain-design")!.id;
		await eventBus.emit("session.start", { sessionId: focusedId });

		// 4. Concurrent activity (both sessions track)
		vi.setSystemTime(new Date("2026-02-18T09:15:00.000Z"));
		await fileEvent("file.created", "src/feature-x.ts");
		vi.setSystemTime(new Date("2026-02-18T09:30:00.000Z"));
		await fileEvent("file.modified", "src/feature-x.ts");
		vi.setSystemTime(new Date("2026-02-18T09:45:00.000Z"));
		await fileEvent("file.modified", "tests/feature-x.test.ts");

		// 5. Complete focused session at 9:50
		vi.setSystemTime(new Date("2026-02-18T09:50:00.000Z"));
		await eventBus.emit("session.complete", { sessionId: focusedId });
		await flush();

		// Verify: focused session completed
		const focused = service.getSessionById(focusedId)!;
		expect(focused.status).toBe("completed");
		expect(focused.activity).toHaveLength(3);

		// Verify: daily session still active with all activity
		let daily = service.getSessionById(dailyId)!;
		expect(daily.status).toBe("active");
		expect(daily.activity).toHaveLength(4); // inbox/todo.md + 3 concurrent

		// 6. More activity after focused ended (daily only)
		vi.setSystemTime(new Date("2026-02-18T10:00:00.000Z"));
		await fileEvent("file.modified", "docs/changelog.md");

		// 7. Stop daily at noon
		vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		daily = service.getSessionById(dailyId)!;
		expect(daily.status).toBe("completed");
		expect(daily.activity).toHaveLength(5);

		// 8. Same-day restart at 2 PM
		vi.setSystemTime(new Date("2026-02-18T14:00:00.000Z"));
		await eventBus.emit("session.daily.start", {});

		daily = service.getSessionById(dailyId)!;
		expect(daily.id).toBe(dailyId); // Same session restarted
		expect(daily.status).toBe("active");
		expect(daily.activity).toHaveLength(5); // Morning activity preserved

		// 9. Afternoon activity
		vi.setSystemTime(new Date("2026-02-18T15:00:00.000Z"));
		await fileEvent("file.modified", "docs/changelog.md");

		// 10. Final stop at 6 PM
		vi.setSystemTime(new Date("2026-02-18T18:00:00.000Z"));
		await eventBus.emit("session.daily.stop", {});

		// Final verification
		daily = service.getSessionById(dailyId)!;
		expect(daily.status).toBe("completed");
		expect(daily.activity).toHaveLength(6);
		expect(daily.notesFile).toBe("Daily/2026-02-18.md");

		// Verify daily summary
		const summary = generateDailySummary(daily);
		expect(summary).toContain("## Daily Activity Summary");
		expect(summary).toContain("**4 files**");  // 4 unique files
		expect(summary).toContain("**6 events**"); // 6 total events

		// Verify time accumulation (4h morning + 4h afternoon = 8h)
		const eightHoursMs = 8 * 60 * 60 * 1000;
		expect(daily.elapsedBeforePauseMs).toBe(eightHoursMs);

		// Verify key events in sequence (state events only)
		const dailyStateEvents = events.filter((e) =>
			e === "session.daily.started" || e === "session.daily.stopped",
		);
		expect(dailyStateEvents).toEqual([
			"session.daily.started",
			"session.daily.stopped",
			"session.daily.started",
			"session.daily.stopped",
		]);

		// One daily-tracking session should exist (not duplicated)
		const dailySessions = service.getSessions().filter((s) => s.type === "daily-tracking");
		expect(dailySessions).toHaveLength(1);
	});
});
