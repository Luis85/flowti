// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserHubCommands } from "../../../src/ui/userHub/UserHubCommands";
import type { UserHubState, UserHubComponentDeps } from "../../../src/ui/userHub/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { CommandMeta, CommandDomain, ICommandRegistry } from "../../../src/infrastructure/commands/types";
import type { UUID } from "../../../src/utils/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

// ── Helpers ──────────────────────────────────────────────────

function makeMeta(overrides?: Partial<CommandMeta>): CommandMeta {
	return {
		id: "flowti:test-cmd",
		label: "Test Command",
		description: "A test command",
		domain: "hub",
		category: "view",
		icon: "home",
		...overrides,
	};
}

function makeRegistry(commands: CommandMeta[]): ICommandRegistry {
	const grouped = new Map<CommandDomain, CommandMeta[]>();
	for (const cmd of commands) {
		const existing = grouped.get(cmd.domain) ?? [];
		existing.push(cmd);
		grouped.set(cmd.domain, existing);
	}

	return {
		register: vi.fn(),
		registerMany: vi.fn(),
		registerMeta: vi.fn(),
		use: vi.fn(),
		getCommands: vi.fn(() => []),
		getCommand: vi.fn(() => undefined),
		getCommandsMeta: vi.fn(() => commands),
		getCommandsByDomain: vi.fn(() => grouped),
		execute: vi.fn(async () => {}),
		clear: vi.fn(),
	};
}

function makeState(): UserHubState {
	return {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: [],
		sessions: [],
		activeSession: null,
		selectedSession: null,
		settings: { ...DEFAULT_SETTINGS },
		selectedPreferencesCategory: null,
	};
}

function makeDeps(state: UserHubState, registry?: ICommandRegistry): UserHubComponentDeps {
	return {
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		eventBus: {
			emit: vi.fn(async () => {}),
			on: vi.fn(() => () => {}),
		} as unknown as IEventBus,
		app: {} as never,
		inboxService: { getItems: vi.fn(() => []), getUnreadCount: vi.fn(() => 0) } as never,
		sessionService: { getSessions: vi.fn(() => []), getActiveSession: vi.fn(() => null) } as never,
		userService: {
			load: vi.fn(async () => {}),
			hasUser: vi.fn(() => false),
			getUser: vi.fn(() => null),
			createUser: vi.fn(async (name: string) => ({ id: "user_1" as UUID, name, createdAt: new Date().toISOString() })),
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
		commandRegistry: registry,
	};
}

// ── Tests ────────────────────────────────────────────────────

describe("UserHubCommands", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	describe("renderMaster", () => {
		it("should show empty state when no commands registered", () => {
			const registry = makeRegistry([]);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			expect(masterEl.textContent).toContain("No commands registered");
		});

		it("should render all commands grouped by domain", () => {
			const cmds = [
				makeMeta({ id: "flowti:cmd-1", label: "Hub Command", domain: "hub" }),
				makeMeta({ id: "flowti:cmd-2", label: "Capture Idea", domain: "capture" }),
				makeMeta({ id: "flowti:cmd-3", label: "Another Hub", domain: "hub" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			expect(masterEl.textContent).toContain("3 commands");
			expect(masterEl.textContent).toContain("Hub");
			expect(masterEl.textContent).toContain("Capture");
			expect(masterEl.textContent).toContain("Hub Command");
			expect(masterEl.textContent).toContain("Capture Idea");
			expect(masterEl.textContent).toContain("Another Hub");
		});

		it("should show command count in header", () => {
			const cmds = [makeMeta({ id: "cmd:1" }), makeMeta({ id: "cmd:2" })];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			expect(masterEl.textContent).toContain("2 commands");
		});

		it("should filter commands by label", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", label: "Open user hub" }),
				makeMeta({ id: "cmd:2", label: "Add idea" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("idea");

			expect(masterEl.textContent).toContain("1 command");
			expect(masterEl.textContent).toContain("Add idea");
			expect(masterEl.textContent).not.toContain("Open user hub");
		});

		it("should filter commands by description", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", label: "Cmd A", description: "Open the dashboard" }),
				makeMeta({ id: "cmd:2", label: "Cmd B", description: "Capture a bug" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("dashboard");

			expect(masterEl.textContent).toContain("1 command");
			expect(masterEl.textContent).toContain("Cmd A");
		});

		it("should filter commands by domain", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", label: "Cmd A", domain: "train" }),
				makeMeta({ id: "cmd:2", label: "Cmd B", domain: "hub" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("train");

			expect(masterEl.textContent).toContain("1 command");
			expect(masterEl.textContent).toContain("Cmd A");
		});

		it("should show no-match message when filter eliminates all", () => {
			const cmds = [makeMeta({ id: "cmd:1", label: "Test" })];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("zzzzz");

			expect(masterEl.textContent).toContain("No commands match your search");
		});

		it("should show fallback when registry not available", () => {
			const deps = makeDeps(makeState(), undefined);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			expect(masterEl.textContent).toContain("Command registry not available");
		});

		it("should display category badge for each command", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", label: "Cmd A", category: "action" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			expect(masterEl.textContent).toContain("action");
		});
	});

	describe("renderDetail", () => {
		it("should show empty state when no command selected", () => {
			const registry = makeRegistry([makeMeta()]);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderDetail();

			expect(detailEl.textContent).toContain("Select a command to view details");
		});

		it("should show command detail after clicking a command row", () => {
			const cmds = [
				makeMeta({
					id: "flowti:test",
					label: "Test Command",
					description: "Does testing",
					domain: "hub",
					category: "view",
					icon: "home",
				}),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			// Click the command row
			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			expect(rows.length).toBeGreaterThan(0);
			(rows[0] as HTMLElement).click();

			// scheduleRender was called
			expect(deps.scheduleRender).toHaveBeenCalled();

			// Now render detail
			commands.renderDetail();

			expect(detailEl.textContent).toContain("Test Command");
			expect(detailEl.textContent).toContain("Does testing");
			expect(detailEl.textContent).toContain("Hub");
			expect(detailEl.textContent).toContain("view");
			expect(detailEl.textContent).toContain("flowti:test");
		});

		it("should show shortcut when command has one", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", shortcut: "Mod+Shift+P" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			// Select the command
			commands.renderMaster("");
			const rows = masterEl.querySelectorAll(".ft-catalog-row");
			(rows[0] as HTMLElement).click();
			commands.renderDetail();

			expect(detailEl.querySelector("kbd")?.textContent).toBe("Mod+Shift+P");
		});

		it("should emit execute request when Execute button clicked", () => {
			const cmds = [makeMeta({ id: "flowti:exec-me" })];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			// Select and render
			commands.renderMaster("");
			(masterEl.querySelector(".ft-catalog-row") as HTMLElement).click();
			commands.renderDetail();

			// Click execute
			const execBtn = detailEl.querySelector("button");
			expect(execBtn).not.toBeNull();
			execBtn!.click();

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"command.execute.request",
				{ commandId: "flowti:exec-me" },
			);
		});
	});

	describe("domain collapsing", () => {
		it("should collapse a domain group when header clicked", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", label: "Hub Cmd", domain: "hub" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			// Command should be visible
			expect(masterEl.textContent).toContain("Hub Cmd");

			// Click the group header to collapse
			const groupHeaders = masterEl.querySelectorAll(".ft-catalog-group-header");
			expect(groupHeaders.length).toBeGreaterThan(0);
			(groupHeaders[0] as HTMLElement).click();

			// scheduleRender was called
			expect(deps.scheduleRender).toHaveBeenCalled();

			// Re-render with collapsed state
			commands.renderMaster("");

			// Domain header still visible but command rows hidden
			expect(masterEl.textContent).toContain("Hub");
			expect(masterEl.querySelectorAll(".ft-catalog-row")).toHaveLength(0);
		});

		it("should expand collapsed domain when header clicked again", () => {
			const cmds = [
				makeMeta({ id: "cmd:1", label: "Hub Cmd", domain: "hub" }),
			];
			const registry = makeRegistry(cmds);
			const deps = makeDeps(makeState(), registry);
			const commands = new UserHubCommands(masterEl, detailEl, deps);

			commands.renderMaster("");

			// Collapse
			const header = masterEl.querySelector(".ft-catalog-group-header") as HTMLElement;
			header.click();
			commands.renderMaster("");
			expect(masterEl.querySelectorAll(".ft-catalog-row")).toHaveLength(0);

			// Expand
			const header2 = masterEl.querySelector(".ft-catalog-group-header") as HTMLElement;
			header2.click();
			commands.renderMaster("");
			expect(masterEl.querySelectorAll(".ft-catalog-row")).toHaveLength(1);
		});
	});
});
