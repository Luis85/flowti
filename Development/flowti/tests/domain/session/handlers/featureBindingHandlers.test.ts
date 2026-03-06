/**
 * Tests for session feature binding handlers — bind/unbind sessions to features.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState } from "../../../../src/domain/session/types";
import { handleFeatureBind, handleFeatureUnbind } from "../../../../src/domain/session/handlers/featureBindingHandlers";
import { handleCreate, handleStart } from "../../../../src/domain/session/handlers/lifecycleHandlers";
import { transitionToCompleted } from "../../../../src/domain/session/handlers/closureHandlers";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session-1",
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
		notesFile: null,
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		featureName: null,
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
		...overrides,
	};
}

function createMockContext(sessions: Session[] = []): SessionHandlerContext & { emitted: [string, unknown][] } {
	const state: SessionState = { sessions, activeSessionId: null };
	const emitted: [string, unknown][] = [];
	return {
		eventBus: { emit: (type: string, payload: unknown) => { emitted.push([type, payload]); } } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
		fileSystem: {
			createFile: vi.fn().mockResolvedValue(undefined),
			readFile: vi.fn().mockResolvedValue(""),
			updateFile: vi.fn().mockResolvedValue(undefined),
			fileExists: vi.fn().mockResolvedValue(true),
		} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
		globalActivityFilter: [],
		customSessionTypes: {},
		noteSyncTimers: new Map(),
		lastSyncedContent: new Map(),
		reverseSyncTimers: new Map(),
		lastOverloadReasons: new Map(),
		findSession: (id: string) => state.sessions.find(s => s.id === id),
		getState: () => state,
		saveState: vi.fn().mockResolvedValue(undefined),
		scheduleSyncNotesFile: vi.fn(),
		checkCognitiveOverload: vi.fn(),
		startTimer: vi.fn(),
		stopTimer: vi.fn(),
		emitted,
	};
}

describe("featureBindingHandlers", () => {
	describe("handleFeatureBind", () => {
		it("binds a feature to a prepared session", async () => {
			const session = makeSession();
			const ctx = createMockContext([session]);

			await handleFeatureBind(ctx, "session-1", "Process Management");

			expect(session.featureName).toBe("Process Management");
			expect(ctx.saveState).toHaveBeenCalled();
			expect(ctx.emitted).toContainEqual(["session.feature.bound", { sessionId: "session-1", featureName: "Process Management" }]);
		});

		it("binds a feature to a running session", async () => {
			const session = makeSession({ status: "running", startedAt: new Date().toISOString() });
			const ctx = createMockContext([session]);

			await handleFeatureBind(ctx, "session-1", "Analytics v2");

			expect(session.featureName).toBe("Analytics v2");
		});

		it("replaces existing feature binding", async () => {
			const session = makeSession({ featureName: "Old Feature" });
			const ctx = createMockContext([session]);

			await handleFeatureBind(ctx, "session-1", "New Feature");

			expect(session.featureName).toBe("New Feature");
		});

		it("rejects binding on completed session", async () => {
			const session = makeSession({ status: "completed" });
			const ctx = createMockContext([session]);

			await handleFeatureBind(ctx, "session-1", "Feature X");

			expect(session.featureName).toBeNull();
			expect(ctx.saveState).not.toHaveBeenCalled();
		});

		it("rejects binding on archived session", async () => {
			const session = makeSession({ status: "archived" });
			const ctx = createMockContext([session]);

			await handleFeatureBind(ctx, "session-1", "Feature X");

			expect(session.featureName).toBeNull();
		});

		it("no-ops for missing session", async () => {
			const ctx = createMockContext([]);

			await handleFeatureBind(ctx, "nonexistent", "Feature X");

			expect(ctx.saveState).not.toHaveBeenCalled();
		});
	});

	describe("handleFeatureUnbind", () => {
		it("unbinds a feature from a session", async () => {
			const session = makeSession({ featureName: "Process Management" });
			const ctx = createMockContext([session]);

			await handleFeatureUnbind(ctx, "session-1");

			expect(session.featureName).toBeNull();
			expect(ctx.emitted).toContainEqual(["session.feature.unbound", { sessionId: "session-1", featureName: "Process Management" }]);
		});

		it("no-ops when no feature is bound", async () => {
			const session = makeSession();
			const ctx = createMockContext([session]);

			await handleFeatureUnbind(ctx, "session-1");

			expect(ctx.saveState).not.toHaveBeenCalled();
		});

		it("no-ops for missing session", async () => {
			const ctx = createMockContext([]);

			await handleFeatureUnbind(ctx, "nonexistent");

			expect(ctx.saveState).not.toHaveBeenCalled();
		});
	});

	describe("cross-domain events", () => {
		it("handleCreate sets featureName from payload", async () => {
			const ctx = createMockContext([]);

			const session = await handleCreate(ctx, {
				type: "event-storming",
				title: "Feature Work",
				durationMinutes: 25,
				featureName: "Process Management",
			});

			expect(session.featureName).toBe("Process Management");
		});

		it("handleCreate defaults featureName to null", async () => {
			const ctx = createMockContext([]);

			const session = await handleCreate(ctx, {
				type: "event-storming",
				title: "No Feature",
				durationMinutes: 25,
			});

			expect(session.featureName).toBeNull();
		});

		it("handleStart emits feature.session.started when feature bound", async () => {
			const session = makeSession({ featureName: "Process Management" });
			const ctx = createMockContext([session]);

			await handleStart(ctx, "session-1");

			const featureEvent = ctx.emitted.find(([type]) => type === "feature.session.started");
			expect(featureEvent).toBeDefined();
			expect(featureEvent![1]).toMatchObject({ featureName: "Process Management" });
		});

		it("handleStart does not emit feature event when no feature bound", async () => {
			const session = makeSession();
			const ctx = createMockContext([session]);

			await handleStart(ctx, "session-1");

			const featureEvent = ctx.emitted.find(([type]) => type === "feature.session.started");
			expect(featureEvent).toBeUndefined();
		});

		it("transitionToCompleted emits feature.session.ended when feature bound", async () => {
			const session = makeSession({
				status: "reviewing",
				featureName: "Process Management",
				elapsedBeforePauseMs: 300000,
				artifacts: [{ path: "src/foo.ts", action: "modified", timestamp: "2026-03-06T10:00:00Z" }],
			});
			const ctx = createMockContext([session]);

			await transitionToCompleted(ctx, session);

			const featureEvent = ctx.emitted.find(([type]) => type === "feature.session.ended");
			expect(featureEvent).toBeDefined();
			expect(featureEvent![1]).toMatchObject({
				featureName: "Process Management",
				duration: 300000,
				filesChanged: 1,
			});
		});

		it("transitionToCompleted does not emit feature event when no feature bound", async () => {
			const session = makeSession({ status: "reviewing" });
			const ctx = createMockContext([session]);

			await transitionToCompleted(ctx, session);

			const featureEvent = ctx.emitted.find(([type]) => type === "feature.session.ended");
			expect(featureEvent).toBeUndefined();
		});
	});
});
