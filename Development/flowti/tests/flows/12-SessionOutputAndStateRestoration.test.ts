/**
 * Flow 12: Session Output Artifacts and State Restoration
 *
 * Tests the full output generation and workspace state save/restore lifecycle:
 * Create → start → pause (state saved) → resume (state restored) →
 * complete → generate output (2 types) → verify artifacts + wikilinks.
 *
 * Covers: PBI-SW-006 (State Restoration), PBI-SW-008 (Session Output Artifacts).
 *
 * Event sequence (happy path):
 *   session.create → session.created → session.start → session.started →
 *   session.pause → session.paused → session.state.save → session.state.saved →
 *   session.resume → session.resumed → session.state.restore → session.state.restored →
 *   session.complete → session.completed → session.state.save → session.state.saved →
 *   session.output.generate → session.output.generated (×2)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SessionService } from "../../src/domain/session/SessionService";
import type { SessionState, WorkspaceState } from "../../src/domain/session/types";
import { BUILT_IN_OUTPUT_TEMPLATES } from "../../src/domain/session/helpers";
import { createMockStorage, collectEvents } from "./testHelpers";
import { createMockFileSystem } from "../mocks/filesystem";

describe("Flow 12: Session Output and State Restoration", () => {
	let eventBus: IEventBus;
	let service: SessionService;
	let storage: ReturnType<typeof createMockStorage<SessionState>>;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-18T10:00:00.000Z"));
		eventBus = new EventBus();
		storage = createMockStorage<SessionState>();
		fileSystem = createMockFileSystem();
		service = new SessionService({ storage: storage.storage, eventBus, fileSystem });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	// ── PBI-SW-006: State Restoration ───────────────────────

	it("saves workspace state on pause and restores on resume", async () => {
		const events = collectEvents(eventBus, "*");

		// Create and start a session
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "State Restore Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;
		await eventBus.emit("session.start", { sessionId });

		// Pause — triggers session.state.save
		vi.setSystemTime(new Date("2026-02-18T10:10:00.000Z"));
		await eventBus.emit("session.pause", { sessionId });
		await vi.advanceTimersByTimeAsync(0); // flush microtask

		expect(events).toContain("session.state.save");

		// Simulate view responding with captured state
		const mockState: WorkspaceState = {
			openFiles: ["notes/design.md", "notes/events.md"],
			activeFile: "notes/design.md",
			scrollPositions: {},
		};
		await eventBus.emit("session.state.saved", { sessionId, state: mockState });

		// Verify state persisted on session
		let session = service.getSessionById(sessionId)!;
		expect(session.workspaceState).toEqual(mockState);
		expect(session.workspaceState!.openFiles).toContain("notes/design.md");

		// Resume — triggers session.state.restore with saved state
		vi.setSystemTime(new Date("2026-02-18T10:15:00.000Z"));
		await eventBus.emit("session.resume", { sessionId });
		await vi.advanceTimersByTimeAsync(0); // flush microtask

		expect(events).toContain("session.state.restore");

		session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("running");
	});

	it("skips state restore when no workspace state was captured", async () => {
		const restoreHandler = vi.fn();
		eventBus.on("session.state.restore", restoreHandler);

		// Create, start, pause (no state.saved reply), resume
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "No State Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;
		await eventBus.emit("session.start", { sessionId });
		await eventBus.emit("session.pause", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		// Don't emit session.state.saved — workspaceState stays null
		await eventBus.emit("session.resume", { sessionId });
		await vi.advanceTimersByTimeAsync(0);

		// restore should NOT be emitted since no state to restore
		expect(restoreHandler).not.toHaveBeenCalled();
	});

	it("saves workspace state on complete", async () => {
		const events = collectEvents(eventBus, "*");

		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Complete State Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;
		await eventBus.emit("session.start", { sessionId });

		vi.setSystemTime(new Date("2026-02-18T10:25:00.000Z"));
		await eventBus.emit("session.complete", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		await service.skipClosure(sessionId);
		await vi.advanceTimersByTimeAsync(0);

		expect(events).toContain("session.state.save");
	});

	// ── PBI-SW-008: Output Artifacts ────────────────────────

	it("generates output artifacts for completed sessions using 2 template types", async () => {
		const events = collectEvents(eventBus, "*");

		// Create, start, add some content, complete
		await eventBus.emit("session.create", {
			type: "event-storming",
			title: "Event Discovery Workshop",
			durationMinutes: 50,
			goals: ["Map domain events", "Identify aggregates"],
		});
		const sessionId = service.getSessions()[0].id;
		await eventBus.emit("session.start", { sessionId });

		// Add decisions
		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Use EventBus",
			description: "For decoupled communication",
		});
		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Separate contexts",
		});

		// Complete the session
		vi.setSystemTime(new Date("2026-02-18T10:50:00.000Z"));
		await eventBus.emit("session.complete", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		await service.skipClosure(sessionId);
		await vi.advanceTimersByTimeAsync(0);

		let session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("completed");
		expect(session.outputArtifacts).toEqual([]);

		// Generate review-summary output
		const reviewTemplate = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "review-summary")!;
		await eventBus.emit("session.output.generate", { sessionId, template: reviewTemplate });
		await vi.advanceTimersByTimeAsync(0);

		session = service.getSessionById(sessionId)!;
		expect(session.outputArtifacts.length).toBe(1);
		expect(session.outputArtifacts[0].type).toBe("review-summary");
		expect(session.outputArtifacts[0].path).toContain("Event Discovery Workshop");
		expect(session.outputArtifacts[0].path).toContain("Review Summary");
		expect(events).toContain("session.output.generated");

		// Verify file was created (auto-doc summary + output artifact = 2)
		expect(fileSystem.createFile).toHaveBeenCalledTimes(2);
		const [filePath, fileContent] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[1];
		expect(filePath).toContain("Event Discovery Workshop");
		expect(fileContent).toContain("# Review Summary: Event Discovery Workshop");
		expect(fileContent).toContain("## Goals");
		expect(fileContent).toContain("Map domain events");
		expect(fileContent).toContain("## Decisions");
		expect(fileContent).toContain("Use EventBus");

		// Generate action-items output
		const actionTemplate = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "action-items")!;
		await eventBus.emit("session.output.generate", { sessionId, template: actionTemplate });
		await vi.advanceTimersByTimeAsync(0);

		session = service.getSessionById(sessionId)!;
		expect(session.outputArtifacts.length).toBe(2);
		expect(session.outputArtifacts[1].type).toBe("action-items");

		// Both output files + auto-doc summary = 3
		expect(fileSystem.createFile).toHaveBeenCalledTimes(3);
	});

	it("rejects output generation for active sessions", async () => {
		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Active Reject Test",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;
		await eventBus.emit("session.start", { sessionId });

		const handler = vi.fn();
		eventBus.on("session.output.generated", handler);

		const template = BUILT_IN_OUTPUT_TEMPLATES[0];
		await eventBus.emit("session.output.generate", { sessionId, template });
		await vi.advanceTimersByTimeAsync(0);

		expect(handler).not.toHaveBeenCalled();
	});

	it("appends wikilink to notes file when generating output", async () => {
		// Set up a notes file
		const notesPath = "03 - Resources/Sessions/Workshop Notes.md";
		(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue("# Workshop Notes\n\nSome content");

		await eventBus.emit("session.create", {
			type: "documentation",
			title: "Workshop",
			durationMinutes: 25,
		});
		const sessionId = service.getSessions()[0].id;

		// Set notes file on the session
		await eventBus.emit("session.notesFile.set", { sessionId, path: notesPath });

		// Start and complete
		await eventBus.emit("session.start", { sessionId });
		vi.setSystemTime(new Date("2026-02-18T10:25:00.000Z"));
		await eventBus.emit("session.complete", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		await service.skipClosure(sessionId);
		await vi.advanceTimersByTimeAsync(0);

		// Generate output
		const template = BUILT_IN_OUTPUT_TEMPLATES[0];
		await eventBus.emit("session.output.generate", { sessionId, template });
		await vi.advanceTimersByTimeAsync(0);

		// Verify notes file was read and updated with wikilink
		expect(fileSystem.readFile).toHaveBeenCalledWith(notesPath);
		expect(fileSystem.updateFile).toHaveBeenCalled();
		const updateArgs = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(updateArgs[0]).toBe(notesPath);
		expect(updateArgs[1]).toContain("## Output Artifacts");
		expect(updateArgs[1]).toContain("[[");
	});

	// ── Combined Lifecycle ──────────────────────────────────

	it("full lifecycle: create → start → pause (state saved) → resume (state restored) → complete → generate outputs", async () => {
		const events = collectEvents(eventBus, "*");

		// Create with goals
		await eventBus.emit("session.create", {
			type: "service-design",
			title: "API Design Session",
			durationMinutes: 50,
			goals: ["Define endpoints", "Choose auth strategy"],
		});
		const sessionId = service.getSessions()[0].id;

		// Start
		await eventBus.emit("session.start", { sessionId });
		expect(events).toContain("session.started");

		// Add decisions
		await eventBus.emit("session.decision.record", {
			sessionId,
			title: "Use JWT for auth",
			description: "Stateless tokens for API authentication",
		});

		// Pause — state save triggered
		vi.setSystemTime(new Date("2026-02-18T10:20:00.000Z"));
		await eventBus.emit("session.pause", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		expect(events).toContain("session.state.save");

		// Simulate view capturing workspace state
		const workspaceState: WorkspaceState = {
			openFiles: ["api/auth.ts", "api/routes.ts"],
			activeFile: "api/auth.ts",
			scrollPositions: {},
		};
		await eventBus.emit("session.state.saved", { sessionId, state: workspaceState });

		// Resume — state restore triggered
		vi.setSystemTime(new Date("2026-02-18T10:25:00.000Z"));
		await eventBus.emit("session.resume", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		expect(events).toContain("session.state.restore");

		// Complete
		vi.setSystemTime(new Date("2026-02-18T10:50:00.000Z"));
		await eventBus.emit("session.complete", { sessionId });
		await vi.advanceTimersByTimeAsync(0);
		expect(events).toContain("session.closure.started");
		await service.skipClosure(sessionId);
		await vi.advanceTimersByTimeAsync(0);
		expect(events).toContain("session.completed");

		let session = service.getSessionById(sessionId)!;
		expect(session.status).toBe("completed");
		expect(session.workspaceState).toEqual(workspaceState);
		expect(session.decisions.length).toBe(1);

		// Generate meeting-invite output
		const meetingTemplate = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "meeting-invite")!;
		await eventBus.emit("session.output.generate", { sessionId, template: meetingTemplate });
		await vi.advanceTimersByTimeAsync(0);

		// Generate review-summary output
		const reviewTemplate = BUILT_IN_OUTPUT_TEMPLATES.find((t) => t.type === "review-summary")!;
		await eventBus.emit("session.output.generate", { sessionId, template: reviewTemplate });
		await vi.advanceTimersByTimeAsync(0);

		session = service.getSessionById(sessionId)!;
		expect(session.outputArtifacts.length).toBe(2);
		expect(session.outputArtifacts[0].type).toBe("meeting-invite");
		expect(session.outputArtifacts[1].type).toBe("review-summary");

		// Verify files were created with correct content (auto-doc + 2 outputs = 3)
		expect(fileSystem.createFile).toHaveBeenCalledTimes(3);
		const meetingContent = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[1][1];
		expect(meetingContent).toContain("# Meeting Invite: API Design Session");
		expect(meetingContent).toContain("Use JWT for auth");

		const reviewContent = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[2][1];
		expect(reviewContent).toContain("# Review Summary: API Design Session");
		expect(reviewContent).toContain("Define endpoints");
		expect(reviewContent).toContain("Choose auth strategy");

		// Verify workspace state survived the full lifecycle
		expect(session.workspaceState!.openFiles).toEqual(["api/auth.ts", "api/routes.ts"]);
	});

	// ── Backward Compatibility ──────────────────────────────

	it("loads legacy sessions without workspaceState or outputArtifacts", async () => {
		await storage.storage.save({
			sessions: [{
				id: "legacy-ws-1",
				type: "documentation",
				title: "Legacy Session",
				status: "completed",
				durationMinutes: 25,
				createdAt: "2026-02-01T10:00:00.000Z",
				startedAt: "2026-02-01T10:00:00.000Z",
				pausedAt: null,
				elapsedBeforePauseMs: 0,
				completedAt: "2026-02-01T10:25:00.000Z",
				artifacts: [],
				notes: "",
				focusFile: null,
				timeline: [],
				goals: [],
				links: [],
				notesFile: null,
				canvasFile: null,
				activity: [],
				activityFilter: [],
				contextBindings: [],
				decisions: [],
				// deliberately missing workspaceState and outputArtifacts
			} as never],
			activeSessionId: null,
			savedTemplates: [],
		});

		service.dispose();
		service = new SessionService({ storage: storage.storage, eventBus, fileSystem });
		await service.load();

		const session = service.getSessionById("legacy-ws-1");
		expect(session).toBeDefined();
		expect(session!.workspaceState).toBeNull();
		expect(session!.outputArtifacts).toEqual([]);
	});
});
