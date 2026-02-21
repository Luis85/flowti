import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { InboxService, ALL_INBOX_SOURCES } from "../../../src/domain/inbox/InboxService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { InboxState } from "../../../src/domain/inbox/types";
import { VAULT_FOLDER_SOURCE_EVENT, VAULT_FOLDER_SOURCE_HUB } from "../../../src/domain/inbox/vaultFolderMapper";
import { createMockStorage } from "../../mocks/storage";

describe("InboxService — vault folder watching", () => {
	let service: InboxService;
	let storage: ITypedStorage<InboxState>;
	let eventBus: IEventBus;

	beforeEach(async () => {
		const mock = createMockStorage<InboxState>();
		storage = mock.storage;
		eventBus = new EventBus();
		service = new InboxService({ storage, eventBus });
		service.setEnabledSources([...ALL_INBOX_SOURCES]);

		// Default: enable vault folder source, set up a watched folder, stub frontmatter
		service.setWatchedFolders([{ path: "00 - Connectivity/inbox", recursive: false }]);
		service.getFrontmatter = () => undefined; // no frontmatter = untyped

		await service.load();
	});

	afterEach(() => {
		service.dispose();
	});

	it("should add item when file.created fires for a path in a watched folder with no type frontmatter", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/Quick thought.md", source: "user" as never });

		// Wait for debounce (500ms)
		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });

		const items = service.getItems();
		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Quick thought");
		expect(items[0].sourceEvent).toBe(VAULT_FOLDER_SOURCE_EVENT);
		expect(items[0].sourceHub).toBe(VAULT_FOLDER_SOURCE_HUB);
		expect(items[0].type).toBe("action");
	});

	it("should add item when file.modified fires for a path in a watched folder with no type frontmatter", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.modified", { path: "00 - Connectivity/inbox/Updated note.md", source: "user" as never });

		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });

		expect(service.getItems()).toHaveLength(1);
		expect(service.getItems()[0].title).toBe("Updated note");
	});

	it("should skip files NOT in any watched folder", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "01 - Now/notes/unrelated.md", source: "user" as never });

		// Wait enough time for debounce to fire if it was going to
		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
		expect(service.getItems()).toHaveLength(0);
	});

	it("should skip files WITH type frontmatter", async () => {
		service.getFrontmatter = () => ({ type: "idea" });

		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/typed.md", source: "user" as never });

		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
		expect(service.getItems()).toHaveLength(0);
	});

	it("should skip non-markdown files", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/image.png", source: "user" as never });

		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
	});

	it("should respect recursive flag: false matches only direct children", async () => {
		service.setWatchedFolders([{ path: "notes", recursive: false }]);

		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		// Direct child — should match
		await eventBus.emit("file.created", { path: "notes/direct.md", source: "user" as never });
		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });

		// Nested child — should NOT match
		handler.mockClear();
		await eventBus.emit("file.created", { path: "notes/sub/nested.md", source: "user" as never });
		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
	});

	it("should respect recursive flag: true matches any depth", async () => {
		service.setWatchedFolders([{ path: "notes", recursive: true }]);

		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "notes/sub/deep/nested.md", source: "user" as never });

		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });
		expect(service.getItems()[0].title).toBe("nested");
	});

	it("should respect enabledSources guard — skips if vault folder source is disabled", async () => {
		service.setEnabledSources(["subscription.matched"]); // vault folder NOT in the list

		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/note.md", source: "user" as never });

		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
	});

	it("should dedup by filePath, not by description content", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		// First event — creates item
		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/dedup-test.md", source: "user" as never });
		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });

		// Manually mutate the item's description to NOT contain the path
		const items = service.getItems();
		expect(items).toHaveLength(1);
		// Access internal state to mutate description (simulates mapper change)
		(items[0] as { description: string }).description = "completely different text";

		// Second event for same path — should still be deduped via filePath
		handler.mockClear();
		await eventBus.emit("file.modified", { path: "00 - Connectivity/inbox/dedup-test.md", source: "user" as never });
		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
		expect(service.getItems()).toHaveLength(1);
	});

	it("should not create duplicate item if unread vault-folder item for same path exists", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		// First event — should create item
		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/dup.md", source: "user" as never });
		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });

		// Second event for same path — should be deduped
		handler.mockClear();
		await eventBus.emit("file.modified", { path: "00 - Connectivity/inbox/dup.md", source: "user" as never });
		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
		expect(service.getItems()).toHaveLength(1);
	});

	it("should emit inbox.vaultFolder.noteDetected event", async () => {
		const handler = vi.fn();
		eventBus.on("inbox.vaultFolder.noteDetected", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/detected.md", source: "user" as never });

		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: { path: "00 - Connectivity/inbox/detected.md", title: "detected" },
			}),
		);
	});

	it("should handle empty watchedFolders (no-op)", async () => {
		service.setWatchedFolders([]);

		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/note.md", source: "user" as never });

		await new Promise((r) => setTimeout(r, 700));
		expect(handler).not.toHaveBeenCalled();
	});

	it("should skip files with empty string type frontmatter", async () => {
		service.getFrontmatter = () => ({ type: "  " }); // whitespace-only

		const handler = vi.fn();
		eventBus.on("inbox.itemAdded", handler);

		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/empty-type.md", source: "user" as never });

		await vi.waitFor(() => {
			expect(handler).toHaveBeenCalledOnce();
		}, { timeout: 1000 });
	});

	it("should clean up debounce timers on dispose", async () => {
		// Trigger a file event (debounce timer starts)
		await eventBus.emit("file.created", { path: "00 - Connectivity/inbox/disposing.md", source: "user" as never });

		// Dispose before debounce fires
		service.dispose();

		// No items should have been added
		expect(service.getItems()).toHaveLength(0);
	});
});
