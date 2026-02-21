import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { InboxService, ALL_INBOX_SOURCES } from "../../../src/domain/inbox/InboxService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { InboxState } from "../../../src/domain/inbox/types";
import { VAULT_FOLDER_SOURCE_HUB } from "../../../src/domain/inbox/vaultFolderMapper";
import { createMockStorage } from "../../mocks/storage";

describe("InboxService — vault folder triage", () => {
	let service: InboxService;
	let storage: ITypedStorage<InboxState>;
	let eventBus: IEventBus;
	let updateFmSpy: (path: string, data: Record<string, unknown>) => Promise<void>;
	let moveFileSpy: (path: string, newPath: string) => Promise<string>;

	beforeEach(async () => {
		const mock = createMockStorage<InboxState>();
		storage = mock.storage;
		eventBus = new EventBus();
		service = new InboxService({ storage, eventBus });
		service.setEnabledSources([...ALL_INBOX_SOURCES]);

		// Setup watched folders with one primary and one secondary
		service.setWatchedFolders([
			{ path: "00 - Connectivity/inbox", recursive: false, isPrimary: true },
			{ path: "notes/scratch", recursive: true, isPrimary: false },
		]);
		service.setTriageTargetFolder("01 - Now/notes");
		service.getFrontmatter = () => undefined; // no frontmatter = untyped

		updateFmSpy = vi.fn<(path: string, data: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined);
		moveFileSpy = vi.fn<(path: string, newPath: string) => Promise<string>>().mockResolvedValue("moved/path.md");
		service.updateFileFrontmatter = updateFmSpy;
		service.moveFile = moveFileSpy;

		await service.load();

		// Seed a vault folder item from primary folder
		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/idea.md", source: "user" as never });
		await vi.waitFor(() => {
			expect(service.getItems()).toHaveLength(1);
		}, { timeout: 1000 });
	});

	afterEach(() => {
		service.dispose();
	});

	it("should apply frontmatter with type via updateFileFrontmatter", async () => {
		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "idea");

		expect(updateFmSpy).toHaveBeenCalledWith("00 - Connectivity/inbox/idea.md", { type: "idea" });
	});

	it("should include description in frontmatter when provided", async () => {
		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "Bug", "Fix the rendering issue");

		expect(updateFmSpy).toHaveBeenCalledWith("00 - Connectivity/inbox/idea.md", {
			type: "Bug",
			description: "Fix the rendering issue",
		});
	});

	it("should omit description from frontmatter when empty", async () => {
		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "reference", "");

		expect(updateFmSpy).toHaveBeenCalledWith("00 - Connectivity/inbox/idea.md", { type: "reference" });
	});

	it("should move file to target folder when source is primary folder", async () => {
		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "idea");

		expect(moveFileSpy).toHaveBeenCalledWith(
			"00 - Connectivity/inbox/idea.md",
			"01 - Now/notes/idea.md",
		);
	});

	it("should NOT move file when source is secondary (non-primary) folder", async () => {
		// Create item from secondary folder
		await eventBus.emit("file.created", { path: "notes/scratch/thought.md", source: "user" as never });
		await vi.waitFor(() => {
			expect(service.getItems()).toHaveLength(2);
		}, { timeout: 1000 });

		const secondaryItem = service.getItems().find((i) => i.title === "thought");
		expect(secondaryItem).toBeDefined();
		await service.triageVaultFolderItem(secondaryItem!.id, "task");

		// updateFileFrontmatter should be called (frontmatter applied in-place)
		expect(updateFmSpy).toHaveBeenCalledWith("notes/scratch/thought.md", { type: "task" });
		// moveFile should NOT be called for secondary folders
		expect(moveFileSpy).not.toHaveBeenCalled();
	});

	it("should NOT move file when target folder is empty", async () => {
		service.setTriageTargetFolder("");
		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "idea");

		expect(updateFmSpy).toHaveBeenCalled();
		expect(moveFileSpy).not.toHaveBeenCalled();
	});

	it("should dismiss inbox item after triage", async () => {
		const item = service.getItems()[0];
		expect(service.getItems()).toHaveLength(1);

		await service.triageVaultFolderItem(item.id, "idea");

		expect(service.getItems()).toHaveLength(0);
	});

	it("should emit inbox.vaultFolder.noteTriaged with correct payload (moved)", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.vaultFolder.noteTriaged", handler);

		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "idea");

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: {
					path: "00 - Connectivity/inbox/idea.md",
					type: "idea",
					moved: true,
					targetPath: "01 - Now/notes/idea.md",
				},
			}),
		);
	});

	it("should emit inbox.vaultFolder.noteTriaged with moved=false for secondary folders", async () => {
		await eventBus.emit("file.created", { path: "notes/scratch/note.md", source: "user" as never });
		await vi.waitFor(() => {
			expect(service.getItems()).toHaveLength(2);
		}, { timeout: 1000 });

		const handler = vi.fn();
		eventBus.on("inbox.vaultFolder.noteTriaged", handler);

		const secondaryItem = service.getItems().find((i) => i.title === "note");
		await service.triageVaultFolderItem(secondaryItem!.id, "question");

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: {
					path: "notes/scratch/note.md",
					type: "question",
					moved: false,
					targetPath: undefined,
				},
			}),
		);
	});

	it("should return early if item does not exist", async () => {
		await service.triageVaultFolderItem("non-existent-id", "idea");
		expect(updateFmSpy).not.toHaveBeenCalled();
	});

	it("should trim whitespace-only description", async () => {
		const item = service.getItems()[0];
		await service.triageVaultFolderItem(item.id, "idea", "   ");

		expect(updateFmSpy).toHaveBeenCalledWith("00 - Connectivity/inbox/idea.md", { type: "idea" });
	});
});
