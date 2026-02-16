// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubPreferences } from "../../../src/ui/userHub/UserHubPreferences";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { UUID } from "../../../src/utils/types";
import { INBOX_SOURCE_DEFINITIONS } from "../../../src/domain/inbox/types";

// ── Helpers ──────────────────────────────────────────────────

function makeState(overrides?: Partial<UserHubState>): UserHubState {
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: INBOX_SOURCE_DEFINITIONS.map((s) => s.event),
		sessions: [],
		activeSession: null,
		selectedSession: null,
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

	// ── renderMaster: Profile section ──────────────────────

	describe("profile section", () => {
		it("should render user name input", () => {
			prefs.renderMaster();

			const input = masterEl.querySelector("input[type='text']") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.value).toBe("Test User");
		});

		it("should render user ID", () => {
			prefs.renderMaster();

			expect(masterEl.textContent).toContain("user_abc");
		});

		it("should show warning when no user configured", () => {
			(deps.userService.getUser as ReturnType<typeof vi.fn>).mockReturnValue(null);
			prefs.renderMaster();

			expect(masterEl.textContent).toContain("No user profile configured");
			expect(masterEl.querySelector("input[type='text']")).toBeNull();
		});

		it("should call updateUserName on name change", () => {
			prefs.renderMaster();

			const input = masterEl.querySelector("input[type='text']") as HTMLInputElement;
			input.value = "New Name";
			input.dispatchEvent(new Event("change"));

			expect(deps.userService.updateUserName).toHaveBeenCalledWith("New Name");
		});

		it("should not call updateUserName for empty names", () => {
			prefs.renderMaster();

			const input = masterEl.querySelector("input[type='text']") as HTMLInputElement;
			input.value = "   ";
			input.dispatchEvent(new Event("change"));

			expect(deps.userService.updateUserName).not.toHaveBeenCalled();
		});
	});

	// ── renderMaster: Inbox sources section ────────────────

	describe("inbox sources section", () => {
		it("should render all inbox source checkboxes", () => {
			prefs.renderMaster();

			const checkboxes = masterEl.querySelectorAll("input[type='checkbox']");
			expect(checkboxes).toHaveLength(INBOX_SOURCE_DEFINITIONS.length);
		});

		it("should render source labels", () => {
			prefs.renderMaster();

			for (const src of INBOX_SOURCE_DEFINITIONS) {
				expect(masterEl.textContent).toContain(src.label);
				expect(masterEl.textContent).toContain(src.desc);
			}
		});

		it("should check enabled sources", () => {
			prefs.renderMaster();

			const checkboxes = Array.from(masterEl.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[];
			// All sources are enabled in default state
			for (const checkbox of checkboxes) {
				expect(checkbox.checked).toBe(true);
			}
		});

		it("should uncheck disabled sources", () => {
			state.inboxEnabledSources = ["subscription.matched"];
			prefs.renderMaster();

			const checkboxes = masterEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			const checkedCount = Array.from(checkboxes).filter((c) => c.checked).length;
			expect(checkedCount).toBe(1);
		});

		it("should emit settings.updateInboxEnabledSources on toggle", () => {
			prefs.renderMaster();

			const checkboxes = masterEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			// Uncheck the first checkbox
			checkboxes[0].checked = false;
			checkboxes[0].dispatchEvent(new Event("change"));

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"settings.updateInboxEnabledSources",
				expect.objectContaining({ sources: expect.any(Array) }),
			);
		});

		it("should update local state on toggle", () => {
			prefs.renderMaster();

			const checkboxes = masterEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
			// Uncheck the first checkbox
			checkboxes[0].checked = false;
			checkboxes[0].dispatchEvent(new Event("change"));

			expect(deps.setState).toHaveBeenCalledWith({
				inboxEnabledSources: expect.not.arrayContaining([INBOX_SOURCE_DEFINITIONS[0].event]),
			});
		});
	});

	// ── renderDetail ───────────────────────────────────────

	describe("renderDetail", () => {
		it("should render preferences heading", () => {
			prefs.renderDetail();

			expect(detailEl.textContent).toContain("Preferences");
		});

		it("should render help text", () => {
			prefs.renderDetail();

			expect(detailEl.textContent).toContain("Changes are saved automatically");
		});
	});
});
