import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { Session, SessionState } from "../../../src/domain/session/types";
import { SESSION_NOTES_SYNC_DELAY_MS } from "../../../src/domain/session/types";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session_test-1",
		type: "event-storming",
		title: "Test Session",
		status: "prepared",
		durationMinutes: 25,
		createdAt: "2026-02-16T10:00:00.000Z",
		startedAt: null,
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: null,
		timeline: [],
		goals: [],
		links: [],
		notesFile: "03 - Resources/Sessions/Test Session (abc123).md",
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
		...overrides,
	};
}

const NOTE_PATH = "03 - Resources/Sessions/Test Session (abc123).md";
const EXISTING_NOTE = `---
session-id: session_test-1
---
# Test Session

Some user content here.

## Session Summary
### Goals
`;

describe("SessionService — note sync", () => {
	let service: SessionService;
	let storage: ITypedStorage<SessionState>;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const mock = createMockStorage<SessionState>();
		storage = mock.storage;
		eventBus = new EventBus();
		fileSystem = createMockFileSystem({ [NOTE_PATH]: EXISTING_NOTE });
		service = new SessionService({ storage, eventBus, fileSystem });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	async function seedRunningSession(): Promise<void> {
		await eventBus.emit("session.create", { type: "event-storming", title: "Test Session", durationMinutes: 25 });
		const sessions = service.getSessions();
		// Patch notesFile + status for our test session
		const session = sessions[0];
		session.notesFile = NOTE_PATH;
		session.status = "running";
		session.startedAt = "2026-02-16T10:00:00.000Z";
	}

	it("syncs after goal add (debounced)", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.goal.add", { sessionId, text: "Write tests" });

		// Should NOT have synced yet (debounce not elapsed)
		expect(fileSystem.updateFile).not.toHaveBeenCalled();

		// Advance past debounce
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.readFile).toHaveBeenCalledWith(NOTE_PATH);
		expect(fileSystem.updateFile).toHaveBeenCalled();
	});

	it("coalesces multiple rapid changes into single sync", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.goal.add", { sessionId, text: "Goal A" });
		await eventBus.emit("session.goal.add", { sessionId, text: "Goal B" });
		await eventBus.emit("session.goal.add", { sessionId, text: "Goal C" });

		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// Only one updateFile call despite 3 goal adds
		expect(fileSystem.updateFile).toHaveBeenCalledTimes(1);
	});

	it("skips sync if note file does not exist", async () => {
		await seedRunningSession();
		const session = service.getSessions()[0];
		session.notesFile = "nonexistent/path.md";

		await eventBus.emit("session.goal.add", { sessionId: session.id, text: "test" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.updateFile).not.toHaveBeenCalled();
	});

	it("skips sync if session has no notesFile", async () => {
		await seedRunningSession();
		const session = service.getSessions()[0];
		session.notesFile = null;

		await eventBus.emit("session.goal.add", { sessionId: session.id, text: "test" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.updateFile).not.toHaveBeenCalled();
	});

	it("emits session.notes.synced on success", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;
		const spy = vi.fn();
		eventBus.on("session.notes.synced", (event) => spy(event.payload));

		await eventBus.emit("session.goal.add", { sessionId, text: "test" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sessionId, path: NOTE_PATH }));
	});

	it("emits session.notes.syncFailed on file error", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;
		(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("disk full"));
		const spy = vi.fn();
		eventBus.on("session.notes.syncFailed", (event) => spy(event.payload));

		await eventBus.emit("session.goal.add", { sessionId, text: "test" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sessionId, error: "disk full" }));
	});

	it("clears timers on dispose", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.goal.add", { sessionId, text: "test" });

		// Timer should be pending but not yet fired
		expect(fileSystem.updateFile).not.toHaveBeenCalled();

		service.dispose();

		// Verify no pending timers remain after dispose
		expect(vi.getTimerCount()).toBe(0);
	});

	it("syncs after task add", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await service.addTask(sessionId, "Build feature");
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.updateFile).toHaveBeenCalled();
	});

	it("syncs after decision record", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.decision.record", { sessionId, title: "Use DDD" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.updateFile).toHaveBeenCalled();
	});

	it("syncs after context bind", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.context.bind", { sessionId, path: "src/main.ts", type: "file" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.updateFile).toHaveBeenCalled();
	});

	it("syncs after notes update", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.notes.update", { sessionId, notes: "Updated notes" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(fileSystem.updateFile).toHaveBeenCalled();
	});

	it("merged content preserves user content above marker", async () => {
		await seedRunningSession();
		const sessionId = service.getSessions()[0].id;

		await eventBus.emit("session.goal.add", { sessionId, text: "Write tests" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		const writeCall = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0];
		const content = writeCall[1] as string;
		expect(content).toContain("Some user content here.");
		expect(content).toContain("## Session Summary");
		expect(content).toContain("Write tests");
	});
});

describe("SessionService — reverse sync (note file → session)", () => {
	let service: SessionService;
	let storage: ITypedStorage<SessionState>;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
		const mock = createMockStorage<SessionState>();
		storage = mock.storage;
		eventBus = new EventBus();
		fileSystem = createMockFileSystem({ [NOTE_PATH]: EXISTING_NOTE });
		service = new SessionService({ storage, eventBus, fileSystem });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	async function seedRunningSessionWithGoals(): Promise<string> {
		await eventBus.emit("session.create", { type: "event-storming", title: "Test Session", durationMinutes: 25 });
		const session = service.getSessions()[0];
		session.notesFile = NOTE_PATH;
		session.status = "running";
		session.startedAt = "2026-02-16T10:00:00.000Z";
		// Add a goal and a task
		await eventBus.emit("session.goal.add", { sessionId: session.id, text: "Write tests" });
		await service.addTask(session.id, "Build feature");
		// Drain forward sync timers
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);
		// Clear mocks from forward sync
		vi.mocked(fileSystem.readFile).mockClear();
		vi.mocked(fileSystem.updateFile).mockClear();
		return session.id;
	}

	it("triggers reverse sync on file.modified for a session note", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const session = service.getSessions().find(s => s.id === sessionId)!;

		// Prepare file content with toggled goal
		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [x] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		// Emit file.modified
		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// Goal should have been toggled
		expect(session.goals[0].completed).toBe(true);
	});

	it("suppresses reverse sync when file content matches last synced content", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const spy = vi.fn();
		eventBus.on("session.notes.reverseSynced", (event) => spy(event.payload));

		// readFile returns what forward sync wrote — content-based suppression should skip
		// (seedRunningSessionWithGoals already ran forward sync, which stored content in lastSyncedContent;
		//  readFile mock still returns the same content that was written)
		const calls = vi.mocked(fileSystem.updateFile).mock.calls;
		const lastWritten = calls.length > 0 ? (calls[calls.length - 1][1] as string) : undefined;
		if (lastWritten) vi.mocked(fileSystem.readFile).mockResolvedValue(lastWritten);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// Should NOT have triggered reverse sync — content matches
		expect(spy).not.toHaveBeenCalled();
	});

	it("debounces multiple file.modified events", async () => {
		const sessionId = await seedRunningSessionWithGoals();

		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [x] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// readFile called only once (debounced)
		expect(fileSystem.readFile).toHaveBeenCalledTimes(1);
	});

	it("applies task toggles back to session", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const session = service.getSessions().find(s => s.id === sessionId)!;

		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Write tests", "",
			"### Execution Plan", "- [x] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(session.executionTasks[0].completed).toBe(true);
	});

	it("applies notes text update back to session", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const session = service.getSessions().find(s => s.id === sessionId)!;

		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "",
			"### Session Notes", "User typed this in the note file.",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(session.notes).toBe("User typed this in the note file.");
	});

	it("emits session.notes.reverseSynced with changes list", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const spy = vi.fn();
		eventBus.on("session.notes.reverseSynced", (event) => spy(event.payload));

		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [x] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(spy).toHaveBeenCalledWith(expect.objectContaining({
			sessionId,
			path: NOTE_PATH,
			changes: expect.arrayContaining(['goal "Write tests" checked']),
		}));
	});

	it("does NOT forward-sync after reverse sync for simple toggles", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		vi.mocked(fileSystem.updateFile).mockClear();

		// Only a checkbox toggle — no structural change
		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [x] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// No forward sync — note already reflects the correct state
		expect(fileSystem.updateFile).not.toHaveBeenCalled();
	});

	it("forward-syncs after reverse sync when new items are added", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		vi.mocked(fileSystem.updateFile).mockClear();

		// New goal added in note file — structural change needs normalization
		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Write tests", "- [ ] New goal from note", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// Forward sync should have written the normalized note
		expect(fileSystem.updateFile).toHaveBeenCalled();
	});

	it("reverse syncs for any session status (including completed)", async () => {
		await eventBus.emit("session.create", { type: "event-storming", title: "Test Session", durationMinutes: 25 });
		const session = service.getSessions()[0];
		session.notesFile = NOTE_PATH;
		session.status = "completed";

		const modifiedContent = [
			"---", "session-id: " + session.id, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Added after completion", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(session.goals).toHaveLength(1);
		expect(session.goals[0].text).toBe("Added after completion");
	});

	it("no-op when parsed content matches session state", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const spy = vi.fn();
		eventBus.on("session.notes.reverseSynced", (event) => spy(event.payload));

		// Content that matches current session state (goal unchecked, task unchecked)
		const unchangedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(unchangedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		// No reverseSynced event because nothing changed
		expect(spy).not.toHaveBeenCalled();
	});

	it("clears reverse sync timers on dispose", async () => {
		await seedRunningSessionWithGoals();

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });

		// Timer is pending
		service.dispose();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("creates new goals added in the note file", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const session = service.getSessions().find(s => s.id === sessionId)!;

		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Write tests", "- [ ] Deploy to prod", "- [x] Review PR", "",
			"### Execution Plan", "- [ ] Build feature", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(session.goals).toHaveLength(3);
		expect(session.goals[1].text).toBe("Deploy to prod");
		expect(session.goals[1].completed).toBe(false);
		expect(session.goals[2].text).toBe("Review PR");
		expect(session.goals[2].completed).toBe(true);
	});

	it("creates new tasks added in the note file", async () => {
		const sessionId = await seedRunningSessionWithGoals();
		const session = service.getSessions().find(s => s.id === sessionId)!;

		const modifiedContent = [
			"---", "session-id: " + sessionId, "---",
			"# Test Session", "", "## Session Summary", "",
			"### Goals", "- [ ] Write tests", "",
			"### Execution Plan", "- [ ] Build feature", "- [ ] Write docs", "- [x] Run linter", "",
		].join("\n");
		vi.mocked(fileSystem.readFile).mockResolvedValue(modifiedContent);

		await eventBus.emit("file.modified", { path: NOTE_PATH, source: "user" });
		await vi.advanceTimersByTimeAsync(SESSION_NOTES_SYNC_DELAY_MS + 100);

		expect(session.executionTasks).toHaveLength(3);
		expect(session.executionTasks[1].label).toBe("Write docs");
		expect(session.executionTasks[1].completed).toBe(false);
		expect(session.executionTasks[2].label).toBe("Run linter");
		expect(session.executionTasks[2].completed).toBe(true);
		expect(session.executionTasks[2].order).toBe(2);
	});
});
