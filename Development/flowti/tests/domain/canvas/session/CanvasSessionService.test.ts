import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	CanvasSessionService,
	generateCanvasSessionSummary,
} from "../../../../src/domain/canvas/session/CanvasSessionService";
import type { IFileSystemClient } from "../../../../src/infrastructure/filesystem/types";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import type { CanvasSessionState } from "../../../../src/domain/canvas/session/types";
import { createMockFileSystemStub } from "../../../mocks/filesystem";

// ── Mock helpers ───────────────────────────────────────────────────

type EmitFn = (type: string, payload: unknown) => Promise<void>;
type OnFn = (type: string, handler: (e: { payload: unknown }) => void) => () => void;

function createMockEventBus(): IEventBus & {
	_emitted: Array<{ type: string; payload: unknown }>;
	_handlers: Map<string, ((e: { payload: unknown }) => void)[]>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	const handlers = new Map<string, ((e: { payload: unknown }) => void)[]>();

	const emit: EmitFn = async (type, payload) => {
		emitted.push({ type, payload });
		// Auto-respond to session.create with session.created
		if (type === "session.create") {
			const p = payload as { title: string };
			const sessionCreatedHandlers = handlers.get("session.created") ?? [];
			for (const h of sessionCreatedHandlers) {
				h({ payload: { session: { id: "sess-auto-1", title: p.title } } });
			}
		}
	};

	const on: OnFn = (type, handler) => {
		if (!handlers.has(type)) handlers.set(type, []);
		handlers.get(type)!.push(handler);
		return () => {
			const list = handlers.get(type);
			if (list) {
				const idx = list.indexOf(handler);
				if (idx >= 0) list.splice(idx, 1);
			}
		};
	};

	return {
		emit: vi.fn(emit),
		on: vi.fn(on),
		_emitted: emitted,
		_handlers: handlers,
	} as unknown as ReturnType<typeof createMockEventBus>;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("CanvasSessionService", () => {
	let service: CanvasSessionService;
	let fileSystem: IFileSystemClient;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(() => {
		fileSystem = createMockFileSystemStub();
		eventBus = createMockEventBus();
		service = new CanvasSessionService({
			eventBus,
			fileSystem,
			sessionFolder: "sessions/canvas",
		});
	});

	describe("startSession()", () => {
		it("creates a canvas file from the template", async () => {
			const result = await service.startSession({
				templateId: "domain-design",
				goal: "Map the actors",
				durationMinutes: 15,
			});

			expect(fileSystem.createFile).toHaveBeenCalledOnce();
			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Domain Design.canvas");
			expect(path.startsWith("sessions/canvas/")).toBe(true);
			const parsed = JSON.parse(content);
			expect(parsed.nodes.length).toBeGreaterThan(0);
			expect(result.canvasPath).toBe(path);
		});

		it("creates a session via event", async () => {
			await service.startSession({
				templateId: "retrospective",
				goal: "Cycle retro",
				durationMinutes: 10,
			});

			const createEvent = eventBus._emitted.find((e) => e.type === "session.create");
			expect(createEvent).toBeDefined();
			expect((createEvent!.payload as Record<string, unknown>).type).toBe("canvas-session");
		});

		it("emits canvas.session.started event", async () => {
			await service.startSession({
				templateId: "brainstorm",
				goal: "Ideas for v2",
				durationMinutes: 0,
			});

			const event = eventBus._emitted.find((e) => e.type === "canvas.session.started");
			expect(event).toBeDefined();
			expect((event!.payload as Record<string, unknown>).goal).toBe("Ideas for v2");
		});

		it("links canvas file to session", async () => {
			await service.startSession({
				templateId: "flow-design",
				goal: "Onboarding flow",
				durationMinutes: 20,
			});

			const linkEvent = eventBus._emitted.find((e) => e.type === "session.canvasFile.set");
			expect(linkEvent).toBeDefined();
			expect((linkEvent!.payload as Record<string, unknown>).sessionId).toBe("sess-auto-1");
		});

		it("starts the monitor with phases from template groups", async () => {
			await service.startSession({
				templateId: "domain-design",
				goal: "DDD session",
				durationMinutes: 15,
			});

			const snapshot = service.monitor.getSnapshot();
			expect(snapshot).not.toBeNull();
			expect(snapshot!.phases.length).toBeGreaterThan(0);
			expect(snapshot!.phases[0].label).toBeTruthy();
		});

		it("throws for unknown template", async () => {
			await expect(
				service.startSession({
					templateId: "nonexistent",
					goal: "test",
					durationMinutes: 0,
				}),
			).rejects.toThrow("Unknown canvas template: nonexistent");
		});

		it("returns sessionId and canvasPath", async () => {
			const result = await service.startSession({
				templateId: "sprint-planning",
				goal: "Sprint 12",
				durationMinutes: 30,
			});

			expect(result.sessionId).toBe("sess-auto-1");
			expect(result.canvasPath).toContain("Sprint Planning.canvas");
		});
	});

	describe("completeSession()", () => {
		it("emits canvas.session.completed event", async () => {
			await service.startSession({
				templateId: "retrospective",
				goal: "Retro",
				durationMinutes: 10,
			});
			service.monitor.recordNodeAdded("Card 1");

			const summary = await service.completeSession();

			expect(summary).toBeTruthy();
			const event = eventBus._emitted.find((e) => e.type === "canvas.session.completed");
			expect(event).toBeDefined();
			expect((event!.payload as Record<string, unknown>).nodesAdded).toBe(1);
		});

		it("returns null when no active session", async () => {
			const result = await service.completeSession();
			expect(result).toBeNull();
		});

		it("completes the linked session via event", async () => {
			await service.startSession({
				templateId: "brainstorm",
				goal: "Ideas",
				durationMinutes: 0,
			});

			await service.completeSession();

			const completeEvent = eventBus._emitted.find((e) => e.type === "session.complete");
			expect(completeEvent).toBeDefined();
		});
	});

	describe("dispose()", () => {
		it("clears the monitor", async () => {
			await service.startSession({
				templateId: "domain-design",
				goal: "Test",
				durationMinutes: 0,
			});
			service.dispose();
			expect(service.monitor.isActive()).toBe(false);
		});
	});
});

describe("generateCanvasSessionSummary()", () => {
	function makeState(overrides?: Partial<CanvasSessionState>): CanvasSessionState {
		return {
			sessionId: "sess-1",
			goal: "Domain modelling",
			templateId: "domain-design",
			templateName: "Domain Design",
			canvasPath: "sessions/canvas/DD.canvas",
			stats: { nodesAdded: 5, nodesModified: 2, edgesAdded: 3 },
			activities: [
				{ timestamp: "2026-03-01T10:30:00Z", action: "node-added", detail: "Added Actor" },
				{ timestamp: "2026-03-01T10:25:00Z", action: "session-started", detail: "Started" },
			],
			phases: [
				{ id: "actors", label: "Actors", visited: true },
				{ id: "events", label: "Events", visited: true },
				{ id: "services", label: "Services", visited: false },
			],
			activePhaseIndex: 1,
			...overrides,
		};
	}

	it("generates frontmatter with session metadata", () => {
		const md = generateCanvasSessionSummary(makeState());
		expect(md).toContain("type: CanvasSessionSummary");
		expect(md).toContain('session: "sess-1"');
		expect(md).toContain('template: "Domain Design"');
		expect(md).toContain('goal: "Domain modelling"');
	});

	it("includes stats table", () => {
		const md = generateCanvasSessionSummary(makeState());
		expect(md).toContain("| Nodes added | 5 |");
		expect(md).toContain("| Edges added | 3 |");
	});

	it("includes phase checklist", () => {
		const md = generateCanvasSessionSummary(makeState());
		expect(md).toContain("- [x] Actors");
		expect(md).toContain("- [x] Events");
		expect(md).toContain("- [ ] Services");
	});

	it("includes activity log in chronological order", () => {
		const md = generateCanvasSessionSummary(makeState());
		expect(md).toContain("## Activity log");
		// Oldest first (reversed from newest-first internal order)
		const startedIdx = md.indexOf("Started");
		const actorIdx = md.indexOf("Added Actor");
		expect(startedIdx).toBeLessThan(actorIdx);
	});

	it("handles empty phases", () => {
		const md = generateCanvasSessionSummary(makeState({ phases: [] }));
		expect(md).not.toContain("## Phases");
	});

	it("escapes quotes in frontmatter", () => {
		const md = generateCanvasSessionSummary(makeState({ goal: 'Goal with "quotes"' }));
		expect(md).toContain('goal: "Goal with \\"quotes\\""');
	});

	it("links to canvas via wikilink", () => {
		const md = generateCanvasSessionSummary(makeState());
		expect(md).toContain("[[sessions/canvas/DD]]");
	});
});
