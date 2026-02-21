// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { VaultFolderTriagePanel, NOTE_TYPES } from "../../../src/ui/userHub/VaultFolderTriagePanel";
import type { UserHubComponentDeps, InboxItem } from "../../../src/ui/userHub/types";

function createMockItem(overrides?: Partial<InboxItem>): InboxItem {
	return {
		id: "inbox_test_1",
		type: "action",
		title: "Quick thought",
		description: "Untyped note in inbox: inbox/Quick thought.md",
		sourceEvent: "inbox.vaultFolder.noteDetected",
		sourceHub: "vault-folder",
		timestamp: new Date().toISOString(),
		read: false,
		filePath: "inbox/Quick thought.md",
		...overrides,
	};
}

function createMockDeps(): UserHubComponentDeps {
	return {
		getState: vi.fn() as never,
		setState: vi.fn() as never,
		eventBus: {} as never,
		app: {} as never,
		inboxService: {
			triageVaultFolderItem: vi.fn().mockResolvedValue(undefined),
		} as never,
		sessionService: {} as never,
		userService: {} as never,
		scheduleRender: vi.fn(),
		navigateToEvent: vi.fn(),
		openNewSessionModal: vi.fn(),
		openFile: vi.fn(),
		openSaveTemplateModal: vi.fn(),
		openSessionWorkspace: vi.fn(),
		exportTemplateAsFile: vi.fn(),
		importTemplateFromFile: vi.fn(),
		getSettings: vi.fn() as never,
	};
}

describe("VaultFolderTriagePanel", () => {
	it("should render without error", () => {
		const container = document.createElement("div");
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), createMockItem());
		expect(() => panel.render()).not.toThrow();
	});

	it("should render type dropdown with NOTE_TYPES options", () => {
		const container = document.createElement("div");
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), createMockItem());
		panel.render();

		const select = container.querySelector("select");
		expect(select).not.toBeNull();
		const options = select!.querySelectorAll("option");
		expect(options).toHaveLength(NOTE_TYPES.length);
		for (let i = 0; i < NOTE_TYPES.length; i++) {
			expect(options[i].value).toBe(NOTE_TYPES[i]);
		}
	});

	it("should render description input field", () => {
		const container = document.createElement("div");
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), createMockItem());
		panel.render();

		const inputs = container.querySelectorAll("input[type='text']");
		const descInput = Array.from(inputs).find((i) => (i as HTMLInputElement).placeholder?.includes("description"));
		expect(descInput).not.toBeNull();
	});

	it("should render file path display when filePath is present", () => {
		const container = document.createElement("div");
		const item = createMockItem({ filePath: "inbox/my-note.md" });
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), item);
		panel.render();

		expect(container.textContent).toContain("inbox/my-note.md");
	});

	it("should render Triage button", () => {
		const container = document.createElement("div");
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), createMockItem());
		panel.render();

		const buttons = container.querySelectorAll("button");
		const triageBtn = Array.from(buttons).find((b) => b.textContent?.includes("Triage"));
		expect(triageBtn).not.toBeNull();
	});

	it("should call triageVaultFolderItem on Triage button click", () => {
		const container = document.createElement("div");
		const deps = createMockDeps();
		const item = createMockItem();
		const panel = new VaultFolderTriagePanel(container, deps, item);
		panel.render();

		const buttons = container.querySelectorAll("button");
		const triageBtn = Array.from(buttons).find((b) => b.textContent?.includes("Triage"));
		triageBtn?.click();

		expect(deps.inboxService.triageVaultFolderItem).toHaveBeenCalledWith(
			"inbox_test_1",
			"idea", // first option
			undefined,
		);
	});

	it("should render section heading with 'Triage' text", () => {
		const container = document.createElement("div");
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), createMockItem());
		panel.render();

		const heading = container.querySelector("h4");
		expect(heading?.textContent).toBe("Triage");
	});

	it("should not render file path when filePath is undefined", () => {
		const container = document.createElement("div");
		const item = createMockItem({ filePath: undefined });
		const panel = new VaultFolderTriagePanel(container, createMockDeps(), item);
		panel.render();

		expect(container.textContent).not.toContain("File:");
	});
});
