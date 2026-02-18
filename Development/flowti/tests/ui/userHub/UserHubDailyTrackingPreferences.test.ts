// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubDailyTrackingPreferences } from "../../../src/ui/userHub/UserHubDailyTrackingPreferences";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { DEFAULT_SETTINGS, type FlowtiSettings } from "../../../src/domain/settings/settings";

// ── Helpers ──────────────────────────────────────────────────

function makeSettings(overrides?: Partial<FlowtiSettings>): FlowtiSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

function makeState(overrides?: Partial<UserHubState>): UserHubState {
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: [],
		sessions: [],
		activeSession: null,
		selectedSession: null,
		settings: makeSettings(),
		selectedPreferencesCategory: "daily-tracking",
		...overrides,
	};
}

function makeDeps(state: UserHubState): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: vi.fn((partial) => Object.assign(state, partial)),
		eventBus: {
			emit: vi.fn(async () => {}),
		} as unknown as IEventBus,
		inboxService: {} as never,
		sessionService: {} as never,
		userService: {} as never,
		scheduleRender: vi.fn(),
		navigateToEvent: vi.fn(),
		openNewSessionModal: vi.fn(),
		openSaveTemplateModal: vi.fn(),
		openFile: vi.fn(),
		openSessionWorkspace: vi.fn(),
		getSettings: () => state.settings,
	};
}

describe("UserHubDailyTrackingPreferences", () => {
	let state: UserHubState;
	let deps: UserHubComponentDeps;
	let container: HTMLDivElement;
	let component: UserHubDailyTrackingPreferences;

	beforeEach(() => {
		state = makeState();
		deps = makeDeps(state);
		container = document.createElement("div");
		component = new UserHubDailyTrackingPreferences(container, deps);
	});

	it("should render enableDailySession toggle", () => {
		component.render();
		expect(container.textContent).toContain("Daily Tracking");
		expect(container.textContent).toContain("Enable daily session");
		const toggle = container.querySelector("input[type='checkbox']") as HTMLInputElement;
		expect(toggle).toBeTruthy();
		expect(toggle.checked).toBe(false);
	});

	it("should render toggle as checked when enabled", () => {
		state.settings = makeSettings({ enableDailySession: true });
		component.render();
		const toggle = container.querySelector("input[type='checkbox']") as HTMLInputElement;
		expect(toggle.checked).toBe(true);
	});

	it("should render dailyNotePath text input", () => {
		component.render();
		expect(container.textContent).toContain("Daily note path");
		const inputs = container.querySelectorAll("input[type='text']") as NodeListOf<HTMLInputElement>;
		const pathInput = Array.from(inputs).find((i) => i.placeholder.includes("Daily Notes"));
		expect(pathInput).toBeTruthy();
	});

	it("should emit settings.updateDailySession on toggle", () => {
		component.render();
		const toggle = container.querySelector("input[type='checkbox']") as HTMLInputElement;
		toggle.checked = true;
		toggle.dispatchEvent(new Event("change"));

		expect(deps.eventBus.emit).toHaveBeenCalledWith(
			"settings.updateDailySession",
			expect.objectContaining({
				enableDailySession: true,
				dailyNotePath: expect.any(String),
			}),
		);
	});

	it("should emit settings.updateDailySession on path change", () => {
		component.render();
		const inputs = container.querySelectorAll("input[type='text']") as NodeListOf<HTMLInputElement>;
		const pathInput = Array.from(inputs).find((i) => i.placeholder.includes("Daily Notes"))!;
		pathInput.value = "Journal/daily.md";
		pathInput.dispatchEvent(new Event("change"));

		expect(deps.eventBus.emit).toHaveBeenCalledWith(
			"settings.updateDailySession",
			expect.objectContaining({
				enableDailySession: false,
				dailyNotePath: "Journal/daily.md",
			}),
		);
	});
});
