// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionEnergyIndicator } from "../../../src/ui/session/SessionEnergyIndicator";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session } from "../../../src/domain/session/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "running",
		durationMinutes: 25,
		createdAt: new Date().toISOString(),
		startedAt: new Date().toISOString(),
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
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
		...overrides,
	};
}

function makeDeps(session: Session): { deps: SessionPanelDeps; eventBus: EventBus } {
	const eventBus = new EventBus();
	return {
		deps: {
			eventBus,
			getSession: () => session,
			app: {} as never,
			openFile: vi.fn(),
			revealFolder: vi.fn(),
			updateActivityFilter: vi.fn(),
		},
		eventBus,
	};
}

describe("SessionEnergyIndicator", () => {
	it("renders section with Energy label", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const section = container.querySelector(".ft-session-energy");
		expect(section).toBeTruthy();
		expect(section!.textContent).toContain("Energy");
	});

	it("renders 5 energy dots", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dots = container.querySelectorAll(".ft-energy-dot");
		expect(dots.length).toBe(5);
	});

	it("highlights active dots matching energy level", () => {
		const session = makeSession({ energy: 3 });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const activeDots = container.querySelectorAll(".ft-energy-active");
		expect(activeDots.length).toBe(3);
	});

	it("shows no active dots when energy is null", () => {
		const session = makeSession({ energy: null });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const activeDots = container.querySelectorAll(".ft-energy-active");
		expect(activeDots.length).toBe(0);
	});

	it("shows label text for set energy", () => {
		const session = makeSession({ energy: 4 });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const label = container.querySelector(".ft-energy-label");
		expect(label).toBeTruthy();
		expect(label!.textContent).toContain("Good");
		expect(label!.textContent).toContain("4/5");
	});

	it("shows 'Not set' when energy is null", () => {
		const session = makeSession({ energy: null });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const label = container.querySelector(".ft-energy-label");
		expect(label!.textContent).toBe("Not set");
	});

	it("emits session.energy.set when dot is clicked in running session", () => {
		const session = makeSession({ status: "running" });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dots = container.querySelectorAll(".ft-energy-dot");
		(dots[2] as HTMLElement).click(); // click level 3

		expect(emitSpy).toHaveBeenCalledWith("session.energy.set", {
			sessionId: "session-1",
			level: 3,
		});
	});

	it("emits session.energy.set when dot is clicked in paused session", () => {
		const session = makeSession({ status: "paused" });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dots = container.querySelectorAll(".ft-energy-dot");
		(dots[4] as HTMLElement).click(); // click level 5

		expect(emitSpy).toHaveBeenCalledWith("session.energy.set", {
			sessionId: "session-1",
			level: 5,
		});
	});

	it("does not emit on click for completed session", () => {
		const session = makeSession({ status: "completed", energy: 3 });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dots = container.querySelectorAll(".ft-energy-dot");
		(dots[0] as HTMLElement).click();

		expect(emitSpy).not.toHaveBeenCalled();
	});

	it("does not emit on click for archived session", () => {
		const session = makeSession({ status: "archived", energy: 2 });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dots = container.querySelectorAll(".ft-energy-dot");
		(dots[0] as HTMLElement).click();

		expect(emitSpy).not.toHaveBeenCalled();
	});

	it("refreshEnergy updates dots and label", () => {
		const session = makeSession({ energy: 2 });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		expect(container.querySelectorAll(".ft-energy-active").length).toBe(2);
		expect(container.querySelector(".ft-energy-label")!.textContent).toContain("Low");

		// Simulate energy change
		session.energy = 5;
		panel.refreshEnergy();

		expect(container.querySelectorAll(".ft-energy-active").length).toBe(5);
		expect(container.querySelector(".ft-energy-label")!.textContent).toContain("Energized");
	});

	it("renders all 5 energy levels with correct tooltips", () => {
		const session = makeSession({ energy: 5 });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dots = container.querySelectorAll(".ft-energy-dot");
		expect((dots[0] as HTMLElement).title).toContain("Drained");
		expect((dots[1] as HTMLElement).title).toContain("Low");
		expect((dots[2] as HTMLElement).title).toContain("Moderate");
		expect((dots[3] as HTMLElement).title).toContain("Good");
		expect((dots[4] as HTMLElement).title).toContain("Energized");
	});

	it("dots have cursor pointer for editable states", () => {
		const session = makeSession({ status: "running" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dot = container.querySelector(".ft-energy-dot") as HTMLElement;
		expect(dot.style.cursor).toBe("pointer");
	});

	it("dots have default cursor for read-only states", () => {
		const session = makeSession({ status: "completed" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionEnergyIndicator(container, deps);
		panel.render();

		const dot = container.querySelector(".ft-energy-dot") as HTMLElement;
		expect(dot.style.cursor).toBe("default");
	});
});
