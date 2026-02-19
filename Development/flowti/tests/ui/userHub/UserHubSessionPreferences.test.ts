// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubSessionPreferences } from "../../../src/ui/userHub/UserHubSessionPreferences";
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
		selectedPreferencesCategory: "sessions",
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
		exportTemplateAsFile: vi.fn(),
		importTemplateFromFile: vi.fn(),
		getSettings: () => state.settings,
	};
}

describe("UserHubSessionPreferences", () => {
	let state: UserHubState;
	let deps: UserHubComponentDeps;
	let container: HTMLDivElement;
	let component: UserHubSessionPreferences;

	beforeEach(() => {
		state = makeState();
		deps = makeDeps(state);
		container = document.createElement("div");
		component = new UserHubSessionPreferences(container, deps);
	});

	// ── No Daily Tracking section (moved to UserHubDailyTrackingPreferences) ──

	describe("no daily tracking section", () => {
		it("should not render daily tracking settings", () => {
			component.render();
			expect(container.textContent).not.toContain("Enable daily session");
			expect(container.textContent).not.toContain("Daily note path");
		});
	});

	// ── Activity Filter section ────────────────────────────

	describe("activity filter section", () => {
		it("should render section heading", () => {
			component.render();
			expect(container.textContent).toContain("Activity Log Filter");
		});

		it("should render existing filter entries", () => {
			state.settings = makeSettings({
				sessionActivityFilterGlobal: [".obsidian/", "node_modules/"],
			});
			component.render();

			expect(container.textContent).toContain(".obsidian/");
			expect(container.textContent).toContain("node_modules/");
		});

		it("should emit settings.updateSessionActivityFilter on remove", () => {
			state.settings = makeSettings({
				sessionActivityFilterGlobal: [".obsidian/", "node_modules/"],
			});
			component.render();

			// Find the first remove button (x icon button)
			const removeButtons = container.querySelectorAll("button");
			const removeBtn = Array.from(removeButtons).find((b) => b.title === "Remove");
			expect(removeBtn).toBeTruthy();

			removeBtn!.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"settings.updateSessionActivityFilter",
				expect.objectContaining({
					filter: expect.any(Array),
				}),
			);
		});

		it("should emit settings.updateSessionActivityFilter on add", () => {
			component.render();

			// Find the add input and button
			const inputs = container.querySelectorAll("input[type='text']") as NodeListOf<HTMLInputElement>;
			const addInput = Array.from(inputs).find((i) => i.placeholder.includes(".obsidian"));
			expect(addInput).toBeTruthy();

			addInput!.value = "temp/";

			const addButtons = container.querySelectorAll("button");
			const addBtn = Array.from(addButtons).find((b) => b.title === "Add folder");
			expect(addBtn).toBeTruthy();

			addBtn!.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"settings.updateSessionActivityFilter",
				{ filter: ["temp/"] },
			);
		});
	});

	// ── Custom Session Types section ───────────────────────

	describe("custom session types section", () => {
		it("should render section heading", () => {
			component.render();
			expect(container.textContent).toContain("Custom Session Types");
		});

		it("should list existing custom types", () => {
			state.settings = makeSettings({
				customSessionTypes: {
					"sprint-review": {
						type: "sprint-review",
						label: "Sprint Review",
						icon: "star",
						guidingQuestions: ["What went well?"],
						defaultDuration: 30,
						defaultGoals: [],
					},
				},
			});
			component.render();

			expect(container.textContent).toContain("Sprint Review");
			expect(container.textContent).toContain("30 min");
			expect(container.textContent).toContain("1 questions");
		});

		it("should emit settings.updateCustomSessionTypes on remove", () => {
			state.settings = makeSettings({
				customSessionTypes: {
					"test-type": {
						type: "test-type",
						label: "Test Type",
						icon: "star",
						guidingQuestions: [],
						defaultDuration: 25,
						defaultGoals: [],
					},
				},
			});
			component.render();

			const removeButtons = container.querySelectorAll("button");
			const removeBtn = Array.from(removeButtons).find((b) => b.title === "Remove");
			removeBtn!.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"settings.updateCustomSessionTypes",
				{ types: {} },
			);
		});

		it("should render add form with key, label, duration, and questions fields", () => {
			component.render();

			expect(container.textContent).toContain("Type key");
			expect(container.textContent).toContain("Display label");
			expect(container.textContent).toContain("Duration (min)");
			expect(container.textContent).toContain("Guiding questions");
			expect(container.textContent).toContain("Add Custom Type");
		});
	});

	// ── Custom Output Templates section ────────────────────

	describe("custom output templates section", () => {
		it("should render section heading", () => {
			component.render();
			expect(container.textContent).toContain("Custom Output Templates");
		});

		it("should list existing templates", () => {
			state.settings = makeSettings({
				customOutputTemplates: [{
					type: "custom",
					title: "Sprint Retro",
					description: "Sprint retrospective",
					sections: [{ heading: "Summary", placeholder: "{{overview}}" }],
				}],
			});
			component.render();

			expect(container.textContent).toContain("Sprint Retro");
			expect(container.textContent).toContain("1 sections");
		});

		it("should emit settings.updateCustomOutputTemplates on remove", () => {
			state.settings = makeSettings({
				customOutputTemplates: [{
					type: "custom",
					title: "Test Template",
					description: "test",
					sections: [],
				}],
			});
			component.render();

			const removeButtons = container.querySelectorAll("button");
			const removeBtn = Array.from(removeButtons).find((b) => b.title === "Remove");
			removeBtn!.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"settings.updateCustomOutputTemplates",
				{ templates: [] },
			);
		});

		it("should render add form with title, description, and sections fields", () => {
			component.render();

			expect(container.textContent).toContain("Template title");
			expect(container.textContent).toContain("Description");
			expect(container.textContent).toContain("Sections");
			expect(container.textContent).toContain("Add Output Template");
		});
	});
});
