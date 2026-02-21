// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubNudgePreferences } from "../../../src/ui/userHub/UserHubNudgePreferences";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { NudgeConfig } from "../../../src/domain/nudge/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";
import { INBOX_SOURCE_DEFINITIONS } from "../../../src/domain/inbox/types";

// ── Helpers ──────────────────────────────────────────────────

function makeConfig(overrides?: Partial<NudgeConfig>): NudgeConfig {
	return {
		id: "test-nudge",
		time: "09:00",
		sessionType: "documentation",
		title: "Test Nudge",
		durationMinutes: 25,
		enabled: true,
		...overrides,
	};
}

function makeState(overrides?: Partial<UserHubState>): UserHubState {
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: INBOX_SOURCE_DEFINITIONS.map((s) => s.event),
		sessions: [],
		activeSession: null,
		selectedSession: null,
		settings: { ...DEFAULT_SETTINGS },
		selectedPreferencesCategory: "nudges",
		...overrides,
	};
}

function makeDeps(
	state: UserHubState,
	configs: NudgeConfig[] = [],
): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: vi.fn((partial) => Object.assign(state, partial)),
		eventBus: {
			emit: vi.fn(async () => {}),
			on: vi.fn(() => () => {}),
		} as unknown as IEventBus,
		app: {} as never,
		inboxService: {} as never,
		sessionService: {} as never,
		nudgeService: {
			getConfigs: vi.fn(() => configs),
			getConfigById: vi.fn((id: string) => configs.find((c) => c.id === id)),
		} as never,
		userService: {} as never,
		scheduleRender: vi.fn(),
		navigateToEvent: vi.fn(),
		openNewSessionModal: vi.fn(),
		openSaveTemplateModal: vi.fn(),
		openFile: vi.fn(),
		openSessionWorkspace: vi.fn(),
		exportTemplateAsFile: vi.fn(),
		importTemplateFromFile: vi.fn(),
		getSettings: () => state.settings,
	};
}

describe("UserHubNudgePreferences", () => {
	let state: UserHubState;
	let container: HTMLDivElement;

	beforeEach(() => {
		state = makeState();
		container = document.createElement("div");
	});

	describe("empty state", () => {
		it("renders header and description", () => {
			const deps = makeDeps(state);
			new UserHubNudgePreferences(container, deps).render();

			expect(container.textContent).toContain("Session Nudges");
			expect(container.textContent).toContain("Time-based reminders");
		});

		it("shows 'no nudges configured' when no configs", () => {
			const deps = makeDeps(state);
			new UserHubNudgePreferences(container, deps).render();

			expect(container.textContent).toContain("No nudges configured");
		});
	});

	describe("nudge list", () => {
		it("renders existing nudge configs", () => {
			const configs = [
				makeConfig({ id: "n1", title: "Morning Review", time: "09:00" }),
				makeConfig({ id: "n2", title: "Afternoon Focus", time: "14:00", enabled: false }),
			];
			const deps = makeDeps(state, configs);
			new UserHubNudgePreferences(container, deps).render();

			expect(container.textContent).toContain("Morning Review");
			expect(container.textContent).toContain("09:00");
			expect(container.textContent).toContain("Afternoon Focus");
			expect(container.textContent).toContain("14:00");
		});

		it("renders enable toggle for each nudge", () => {
			const configs = [
				makeConfig({ id: "n1", enabled: true }),
				makeConfig({ id: "n2", enabled: false }),
			];
			const deps = makeDeps(state, configs);
			new UserHubNudgePreferences(container, deps).render();

			const toggles = container.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			expect(toggles[0].checked).toBe(true);
			expect(toggles[1].checked).toBe(false);
		});

		it("emits nudge.configure on toggle change", () => {
			const config = makeConfig({ id: "n1", enabled: true });
			const deps = makeDeps(state, [config]);
			new UserHubNudgePreferences(container, deps).render();

			const toggle = container.querySelector("input[type='checkbox']") as HTMLInputElement;
			toggle.checked = false;
			toggle.dispatchEvent(new Event("change"));

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"nudge.configure",
				expect.objectContaining({
					config: expect.objectContaining({ id: "n1", enabled: false }),
				}),
			);
		});

		it("emits nudge.remove on delete click", () => {
			const config = makeConfig({ id: "n1", title: "Test" });
			const deps = makeDeps(state, [config]);
			new UserHubNudgePreferences(container, deps).render();

			const deleteBtn = container.querySelector("button[title='Remove nudge']") as HTMLButtonElement;
			expect(deleteBtn).toBeTruthy();
			deleteBtn.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"nudge.remove",
				{ id: "n1" },
			);
		});

		it("shows session type and duration in metadata", () => {
			const config = makeConfig({
				id: "n1",
				sessionType: "documentation",
				durationMinutes: 25,
			});
			const deps = makeDeps(state, [config]);
			new UserHubNudgePreferences(container, deps).render();

			expect(container.textContent).toContain("Documentation");
			expect(container.textContent).toContain("25 min");
		});
	});

	describe("add form", () => {
		it("renders add form fields", () => {
			const deps = makeDeps(state);
			new UserHubNudgePreferences(container, deps).render();

			expect(container.textContent).toContain("Title");
			expect(container.textContent).toContain("Time (HH:MM)");
			expect(container.textContent).toContain("Session type");
			expect(container.textContent).toContain("Duration (min)");
			expect(container.textContent).toContain("Add Nudge");
		});

		it("renders session type dropdown without daily-tracking", () => {
			const deps = makeDeps(state);
			new UserHubNudgePreferences(container, deps).render();

			const select = container.querySelector("select") as HTMLSelectElement;
			expect(select).toBeTruthy();
			const options = Array.from(select.options).map((o) => o.value);
			expect(options).toContain("documentation");
			expect(options).not.toContain("daily-tracking");
		});

		it("emits nudge.configure on add button click with valid input", () => {
			const deps = makeDeps(state);
			new UserHubNudgePreferences(container, deps).render();

			// Fill in form
			const inputs = container.querySelectorAll("input[type='text']") as NodeListOf<HTMLInputElement>;
			// Title input
			inputs[0].value = "New Nudge";
			inputs[0].dispatchEvent(new Event("input"));

			// Click add
			const addBtn = container.querySelector("button.mod-cta") as HTMLButtonElement;
			addBtn.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"nudge.configure",
				expect.objectContaining({
					config: expect.objectContaining({
						title: "New Nudge",
						time: "09:00",
						enabled: true,
					}),
				}),
			);
		});

		it("does not emit on add when title is empty", () => {
			const deps = makeDeps(state);
			new UserHubNudgePreferences(container, deps).render();

			// Click add without filling title
			const addBtn = container.querySelector("button.mod-cta") as HTMLButtonElement;
			addBtn.click();

			expect(deps.eventBus.emit).not.toHaveBeenCalled();
		});
	});
});
