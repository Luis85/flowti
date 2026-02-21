// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubPreferences } from "../../../src/ui/userHub/UserHubPreferences";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { UUID } from "../../../src/utils/types";
import { INBOX_SOURCE_DEFINITIONS } from "../../../src/domain/inbox/types";
import { DEFAULT_SETTINGS, type FlowtiSettings } from "../../../src/domain/settings/settings";

// ── Helpers ──────────────────────────────────────────────────

function makeState(overrides?: Partial<UserHubState>): UserHubState {
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: INBOX_SOURCE_DEFINITIONS.map((s) => s.event),
		sessions: [],
		activeSession: null,
		selectedSession: null,
		settings: { ...DEFAULT_SETTINGS },
		selectedPreferencesCategory: null,
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
		app: {} as never,
		inboxService: {
			markRead: vi.fn(async () => {}),
			dismiss: vi.fn(async () => {}),
			clearAll: vi.fn(async () => {}),
			getItems: vi.fn(() => []),
			getUnreadCount: vi.fn(() => 0),
		} as never,
		sessionService: {
			getSessions: vi.fn(() => []),
			getActiveSession: vi.fn(() => null),
		} as never,
		userService: {
			load: vi.fn(async () => {}),
			hasUser: vi.fn(() => true),
			getUser: vi.fn(() => ({
				id: "user_abc" as UUID,
				name: "Test User",
				createdAt: "2026-02-15T10:00:00Z",
			})),
			createUser: vi.fn(async (name: string) => ({ id: "user_abc" as UUID, name, createdAt: new Date().toISOString() })),
			updateUserName: vi.fn(async () => {}),
		},
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

describe("UserHubPreferences", () => {
	let state: UserHubState;
	let deps: UserHubComponentDeps;
	let masterEl: HTMLDivElement;
	let detailEl: HTMLDivElement;
	let prefs: UserHubPreferences;

	beforeEach(() => {
		state = makeState();
		deps = makeDeps(state);
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		prefs = new UserHubPreferences(masterEl, detailEl, deps);
	});

	// ── Master panel: categories ──────────────────────────

	describe("master panel - categories", () => {
		it("should render 4 category rows", () => {
			prefs.renderMaster();

			expect(masterEl.textContent).toContain("Profile");
			expect(masterEl.textContent).toContain("Inbox");
			expect(masterEl.textContent).toContain("Sessions");
			expect(masterEl.textContent).toContain("Nudges");
		});

		it("should render category descriptions", () => {
			prefs.renderMaster();

			expect(masterEl.textContent).toContain("Display name and identity");
			expect(masterEl.textContent).toContain("Notification source toggles");
			expect(masterEl.textContent).toContain("Activity filter, types, templates");
			expect(masterEl.textContent).toContain("Time-based session start reminders");
		});

		it("should highlight selected category", () => {
			state.selectedPreferencesCategory = "inbox";
			prefs.renderMaster();

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			// Inbox is the second row (index 1)
			expect(rows[1].classList.contains("ft-catalog-row-active")).toBe(true);
			expect(rows[0].classList.contains("ft-catalog-row-active")).toBe(false);
		});

		it("should update state and schedule render on category click", () => {
			prefs.renderMaster();

			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			(rows[0] as HTMLElement).click();

			expect(deps.setState).toHaveBeenCalledWith({ selectedPreferencesCategory: "profile" });
			expect(deps.scheduleRender).toHaveBeenCalled();
		});
	});

	// ── Detail panel: empty state ─────────────────────────

	describe("detail panel - empty state", () => {
		it("should render help text when no category selected", () => {
			prefs.renderDetail();

			expect(detailEl.textContent).toContain("Preferences");
			expect(detailEl.textContent).toContain("Select a category");
		});
	});

	// ── Detail panel: profile ─────────────────────────────

	describe("detail panel - profile", () => {
		beforeEach(() => {
			state.selectedPreferencesCategory = "profile";
		});

		it("should render user name input", () => {
			prefs.renderDetail();

			const input = detailEl.querySelector("input[type='text']") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.value).toBe("Test User");
		});

		it("should render user ID", () => {
			prefs.renderDetail();

			expect(detailEl.textContent).toContain("user_abc");
		});

		it("should show warning when no user configured", () => {
			(deps.userService.getUser as ReturnType<typeof vi.fn>).mockReturnValue(null);
			prefs.renderDetail();

			expect(detailEl.textContent).toContain("No user profile configured");
			expect(detailEl.querySelector("input[type='text']")).toBeNull();
		});

		it("should call updateUserName on name change", () => {
			prefs.renderDetail();

			const input = detailEl.querySelector("input[type='text']") as HTMLInputElement;
			input.value = "New Name";
			input.dispatchEvent(new Event("change"));

			expect(deps.userService.updateUserName).toHaveBeenCalledWith("New Name");
		});

		it("should not call updateUserName for empty names", () => {
			prefs.renderDetail();

			const input = detailEl.querySelector("input[type='text']") as HTMLInputElement;
			input.value = "   ";
			input.dispatchEvent(new Event("change"));

			expect(deps.userService.updateUserName).not.toHaveBeenCalled();
		});
	});

	// ── Detail panel: inbox ───────────────────────────────

	describe("detail panel - inbox", () => {
		beforeEach(() => {
			state.selectedPreferencesCategory = "inbox";
		});

		it("should render all inbox source checkboxes", () => {
			prefs.renderDetail();

			const checkboxes = detailEl.querySelectorAll("input[type='checkbox']");
			expect(checkboxes).toHaveLength(INBOX_SOURCE_DEFINITIONS.length);
		});

		it("should render source labels", () => {
			prefs.renderDetail();

			for (const src of INBOX_SOURCE_DEFINITIONS) {
				expect(detailEl.textContent).toContain(src.label);
				expect(detailEl.textContent).toContain(src.desc);
			}
		});

		it("should check enabled sources", () => {
			prefs.renderDetail();

			const checkboxes = Array.from(detailEl.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[];
			for (const checkbox of checkboxes) {
				expect(checkbox.checked).toBe(true);
			}
		});

		it("should uncheck disabled sources", () => {
			state.inboxEnabledSources = ["subscription.matched"];
			prefs.renderDetail();

			const checkboxes = detailEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			const checkedCount = Array.from(checkboxes).filter((c) => c.checked).length;
			expect(checkedCount).toBe(1);
		});

		it("should emit settings.updateInboxEnabledSources on toggle", () => {
			prefs.renderDetail();

			const checkboxes = detailEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			checkboxes[0].checked = false;
			checkboxes[0].dispatchEvent(new Event("change"));

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"settings.updateInboxEnabledSources",
				expect.objectContaining({ sources: expect.any(Array) }),
			);
		});

		it("should update local state on toggle", () => {
			prefs.renderDetail();

			const checkboxes = detailEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			checkboxes[0].checked = false;
			checkboxes[0].dispatchEvent(new Event("change"));

			expect(deps.setState).toHaveBeenCalledWith({
				inboxEnabledSources: expect.not.arrayContaining([INBOX_SOURCE_DEFINITIONS[0].event]),
			});
		});
	});

	// ── Detail panel: sessions ────────────────────────────

	describe("detail panel - sessions", () => {
		it("should delegate to UserHubSessionPreferences", () => {
			state.selectedPreferencesCategory = "sessions";
			prefs.renderDetail();

			// Verify that session preferences sections are rendered (no Daily Tracking)
			expect(detailEl.textContent).toContain("Activity Log Filter");
			expect(detailEl.textContent).toContain("Custom Session Types");
			expect(detailEl.textContent).toContain("Custom Output Templates");
			expect(detailEl.textContent).not.toContain("Enable daily session");
		});
	});

	// ── Detail panel: nudges ─────────────────────────────

	describe("detail panel - nudges", () => {
		it("should delegate to UserHubNudgePreferences", () => {
			state.selectedPreferencesCategory = "nudges";
			prefs.renderDetail();

			expect(detailEl.textContent).toContain("Session Nudges");
			expect(detailEl.textContent).toContain("Time-based reminders");
		});
	});
});
