import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBridge } from "../../../src/infrastructure/events/EventBridge";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { LoggerService } from "../../../src/infrastructure/logger/LoggerService";
import { TFile, TFolder, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { ILogger } from "../../../src/infrastructure/logger/types";
import type { RequestId } from "../../../src/infrastructure/events/events";

/** Generic listener store used by all mock event sources. */
type ListenerStore = Record<string, ((...args: unknown[]) => void)[]>;

function createListenerStore(): {
	store: ListenerStore;
	on: ReturnType<typeof vi.fn>;
	trigger: (event: string, ...args: unknown[]) => void;
} {
	const store: ListenerStore = {};
	return {
		store,
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
			if (!store[event]) store[event] = [];
			store[event].push(cb);
			return { id: `ref-${event}` };
		}),
		trigger(event: string, ...args: unknown[]) {
			for (const cb of store[event] ?? []) {
				cb(...args);
			}
		},
	};
}

/**
 * Creates a mock Obsidian App with vault, fileManager, metadataCache, and workspace.
 */
function createMockApp() {
	const vault = createListenerStore();
	const workspace = createListenerStore();
	const metadataCache = createListenerStore();

	return {
		vault: {
			create: vi.fn().mockResolvedValue(undefined),
			read: vi.fn().mockResolvedValue("file content"),
			modify: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			createFolder: vi.fn().mockResolvedValue(undefined),
			getAbstractFileByPath: vi.fn().mockReturnValue(null),
			on: vault.on,
		},
		fileManager: {
			renameFile: vi.fn().mockResolvedValue(undefined),
			trashFile: vi.fn().mockResolvedValue(undefined),
			processFrontMatter: vi.fn().mockImplementation(
				async (_file: TFile, cb: (fm: Record<string, unknown>) => void) => {
					const fm: Record<string, unknown> = {};
					cb(fm);
				}
			),
		},
		metadataCache: {
			getFileCache: vi.fn().mockReturnValue({ frontmatter: {} }),
			on: metadataCache.on,
		},
		workspace: {
			on: workspace.on,
		},
		_triggerVaultEvent: vault.trigger,
		_triggerWorkspaceEvent: workspace.trigger,
		_triggerMetadataCacheEvent: metadataCache.trigger,
	};
}

function createTFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
	file.extension = path.split(".").pop() ?? "";
	return file;
}

function createTFolder(path: string): TFolder {
	const folder = new TFolder();
	folder.path = path;
	return folder;
}

describe("EventBridge", () => {
	let eventBus: IEventBus;
	let logger: ILogger;
	let mockApp: ReturnType<typeof createMockApp>;
	let bridge: EventBridge;
	let registeredEvents: unknown[];

	beforeEach(() => {
		eventBus = new EventBus();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});

		logger = new LoggerService({ eventBus, debugMode: false });
		mockApp = createMockApp();
		registeredEvents = [];

		bridge = new EventBridge({
			app: mockApp as never,
			eventBus,
			logger,
			registerEvent: (ref) => registeredEvents.push(ref),
		});
		bridge.register();
		bridge.registerVaultListeners();

		// Open the cache-resolved gate so vault events are emitted in tests
		mockApp._triggerMetadataCacheEvent("resolved");
	});

	// ─────────────────────────────────────────────────────────────
	// File System Handlers
	// ─────────────────────────────────────────────────────────────

	describe("file.create", () => {
		it("should create a file and emit success response", async () => {
			const handler = vi.fn();
			eventBus.on("file.create.response", handler);

			await eventBus.emit("file.create.request", {
				requestId: "req-1" as RequestId,
				path: "notes/test.md",
				content: "# Hello",
			});

			expect(mockApp.vault.create).toHaveBeenCalledWith("notes/test.md", "# Hello");
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						requestId: "req-1",
						success: true,
						path: "notes/test.md",
					}),
				})
			);
		});

		it("should create parent folders when requested", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			await eventBus.emit("file.create.request", {
				requestId: "req-2" as RequestId,
				path: "deep/folder/test.md",
				content: "",
				createFolders: true,
			});

			expect(mockApp.vault.createFolder).toHaveBeenCalledWith("deep/folder");
		});

		it("should emit error response on failure", async () => {
			mockApp.vault.create.mockRejectedValue(new Error("File exists"));
			const handler = vi.fn();
			eventBus.on("file.create.response", handler);

			await eventBus.emit("file.create.request", {
				requestId: "req-3" as RequestId,
				path: "test.md",
				content: "",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						requestId: "req-3",
						success: false,
						error: expect.objectContaining({
							code: "FILE_CREATE_FAILED",
							message: "File exists",
						}),
					}),
				})
			);
		});
	});

	describe("file.read", () => {
		it("should read a file and emit content in response", async () => {
			const tFile = createTFile("notes/test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);
			mockApp.vault.read.mockResolvedValue("# Content");

			const handler = vi.fn();
			eventBus.on("file.read.response", handler);

			await eventBus.emit("file.read.request", {
				requestId: "req-4" as RequestId,
				path: "notes/test.md",
			});

			expect(mockApp.vault.read).toHaveBeenCalledWith(tFile);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: true,
						content: "# Content",
					}),
				})
			);
		});

		it("should emit error when file not found", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const handler = vi.fn();
			eventBus.on("file.read.response", handler);

			await eventBus.emit("file.read.request", {
				requestId: "req-5" as RequestId,
				path: "missing.md",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: false,
						error: expect.objectContaining({
							code: "FILE_READ_FAILED",
						}),
					}),
				})
			);
		});
	});

	describe("file.update", () => {
		it("should update file content", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("file.update.response", handler);

			await eventBus.emit("file.update.request", {
				requestId: "req-6" as RequestId,
				path: "test.md",
				content: "updated",
			});

			expect(mockApp.vault.modify).toHaveBeenCalledWith(tFile, "updated");
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ success: true }),
				})
			);
		});

		it("should emit error when file not found", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const handler = vi.fn();
			eventBus.on("file.update.response", handler);

			await eventBus.emit("file.update.request", {
				requestId: "req-7" as RequestId,
				path: "missing.md",
				content: "x",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: false,
						error: expect.objectContaining({ code: "FILE_UPDATE_FAILED" }),
					}),
				})
			);
		});
	});

	describe("file.delete", () => {
		it("should delete a file", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("file.delete.response", handler);

			await eventBus.emit("file.delete.request", {
				requestId: "req-8" as RequestId,
				path: "test.md",
			});

			expect(mockApp.fileManager.trashFile).toHaveBeenCalledWith(tFile);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ success: true }),
				})
			);
		});

		it("should emit error when file not found", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const handler = vi.fn();
			eventBus.on("file.delete.response", handler);

			await eventBus.emit("file.delete.request", {
				requestId: "req-9" as RequestId,
				path: "missing.md",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: false,
						error: expect.objectContaining({ code: "FILE_DELETE_FAILED" }),
					}),
				})
			);
		});
	});

	describe("file.move", () => {
		it("should move a file", async () => {
			const tFile = createTFile("old/test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("file.move.response", handler);

			await eventBus.emit("file.move.request", {
				requestId: "req-10" as RequestId,
				path: "old/test.md",
				newPath: "new/test.md",
			});

			expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(tFile, "new/test.md");
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: true,
						newPath: "new/test.md",
					}),
				})
			);
		});

		it("should emit error when file not found", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const handler = vi.fn();
			eventBus.on("file.move.response", handler);

			await eventBus.emit("file.move.request", {
				requestId: "req-11" as RequestId,
				path: "missing.md",
				newPath: "new.md",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: false,
						error: expect.objectContaining({ code: "FILE_MOVE_FAILED" }),
					}),
				})
			);
		});
	});

	describe("file.rename", () => {
		it("should rename a file", async () => {
			const tFile = createTFile("folder/old.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("file.rename.response", handler);

			await eventBus.emit("file.rename.request", {
				requestId: "req-12" as RequestId,
				path: "folder/old.md",
				newName: "new.md",
			});

			expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(tFile, "folder/new.md");
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: true,
						newPath: "folder/new.md",
					}),
				})
			);
		});

		it("should handle root-level rename without folder prefix", async () => {
			const tFile = createTFile("old.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("file.rename.response", handler);

			await eventBus.emit("file.rename.request", {
				requestId: "req-13" as RequestId,
				path: "old.md",
				newName: "new.md",
			});

			expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(tFile, "new.md");
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Frontmatter Handlers
	// ─────────────────────────────────────────────────────────────

	describe("frontmatter.get", () => {
		it("should return frontmatter data", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { title: "Test", tags: ["a"] },
			});

			const handler = vi.fn();
			eventBus.on("frontmatter.get.response", handler);

			await eventBus.emit("frontmatter.get.request", {
				requestId: "req-14" as RequestId,
				path: "test.md",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: true,
						data: { title: "Test", tags: ["a"] },
					}),
				})
			);
		});

		it("should emit error when file not found", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const handler = vi.fn();
			eventBus.on("frontmatter.get.response", handler);

			await eventBus.emit("frontmatter.get.request", {
				requestId: "req-15" as RequestId,
				path: "missing.md",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						success: false,
						error: expect.objectContaining({ code: "FRONTMATTER_GET_FAILED" }),
					}),
				})
			);
		});
	});

	describe("frontmatter.update", () => {
		it("should merge frontmatter data", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("frontmatter.update.response", handler);

			await eventBus.emit("frontmatter.update.request", {
				requestId: "req-16" as RequestId,
				path: "test.md",
				data: { status: "done" },
			});

			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ success: true }),
				})
			);
		});

		it("should return merged frontmatter from callback, not stale cache", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			// Simulate existing frontmatter that gets merged
			const existingFm: Record<string, unknown> = { title: "Original", tags: ["a"] };
			mockApp.fileManager.processFrontMatter.mockImplementation(
				async (_file: TFile, cb: (fm: Record<string, unknown>) => void) => {
					cb(existingFm);
				}
			);

			// Cache returns stale data (pre-update)
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { title: "Stale" },
			});

			const handler = vi.fn();
			eventBus.on("frontmatter.update.response", handler);

			await eventBus.emit("frontmatter.update.request", {
				requestId: "req-fm-stale" as RequestId,
				path: "test.md",
				data: { status: "done" },
			});

			const responseData = handler.mock.calls[0][0].payload.data;
			// Should contain merged data, not stale cache
			expect(responseData.status).toBe("done");
			expect(responseData.title).toBe("Original");
			expect(responseData).not.toHaveProperty("title", "Stale");
		});
	});

	describe("frontmatter.set", () => {
		it("should replace entire frontmatter", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const handler = vi.fn();
			eventBus.on("frontmatter.set.response", handler);

			await eventBus.emit("frontmatter.set.request", {
				requestId: "req-17" as RequestId,
				path: "test.md",
				data: { title: "New" },
			});

			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ success: true }),
				})
			);
		});

		it("should clear existing keys before setting", async () => {
			const tFile = createTFile("test.md");
			mockApp.vault.getAbstractFileByPath.mockReturnValue(tFile);

			const capturedFm: Record<string, unknown> = { old: "value", keep: true };
			mockApp.fileManager.processFrontMatter.mockImplementation(
				async (_file: TFile, cb: (fm: Record<string, unknown>) => void) => {
					cb(capturedFm);
				}
			);

			await eventBus.emit("frontmatter.set.request", {
				requestId: "req-18" as RequestId,
				path: "test.md",
				data: { title: "New" },
			});

			// Old keys should be deleted, new keys set
			expect(capturedFm).toEqual({ title: "New" });
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Vault Listeners
	// ─────────────────────────────────────────────────────────────

	describe("two-phase registration", () => {
		it("register() alone should NOT register any Obsidian EventRefs", () => {
			const freshEvents: unknown[] = [];
			const freshBridge = new EventBridge({
				app: mockApp as never,
				eventBus,
				logger,
				registerEvent: (ref) => freshEvents.push(ref),
			});
			freshBridge.register();
			expect(freshEvents).toHaveLength(0);
		});

		it("registerVaultListeners() should register all Obsidian event listeners", () => {
			// 4 vault + 3 workspace + 2 metadataCache = 9
			expect(registeredEvents).toHaveLength(9);
		});
	});

	describe("vault listeners", () => {

		it("should emit file.created on vault create", async () => {
			const handler = vi.fn();
			eventBus.on("file.created", handler);

			const tFile = createTFile("new-file.md");
			mockApp._triggerVaultEvent("create", tFile);

			// Wait for async event emission
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { path: "new-file.md", source: "obsidian" },
				})
			);
		});

		it("should emit file.modified on vault modify", async () => {
			const handler = vi.fn();
			eventBus.on("file.modified", handler);

			const tFile = createTFile("modified.md");
			mockApp._triggerVaultEvent("modify", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { path: "modified.md", source: "obsidian" },
				})
			);
		});

		it("should emit file.deleted on vault delete", async () => {
			const handler = vi.fn();
			eventBus.on("file.deleted", handler);

			const tFile = createTFile("deleted.md");
			mockApp._triggerVaultEvent("delete", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { path: "deleted.md", source: "obsidian" },
				})
			);
		});

		it("should emit file.renamed on vault rename", async () => {
			const handler = vi.fn();
			eventBus.on("file.renamed", handler);

			const tFile = createTFile("new-name.md");
			mockApp._triggerVaultEvent("rename", tFile, "old-name.md");

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						path: "new-name.md",
						oldPath: "old-name.md",
						newPath: "new-name.md",
						source: "obsidian",
					},
				})
			);
		});

		it("should ignore non-TFile and non-TFolder vault events", async () => {
			const fileHandler = vi.fn();
			const folderHandler = vi.fn();
			eventBus.on("file.created", fileHandler);
			eventBus.on("folder.created", folderHandler);

			// Trigger with a plain object (neither TFile nor TFolder)
			mockApp._triggerVaultEvent("create", { path: "unknown" });

			await new Promise((r) => setTimeout(r, 10));

			expect(fileHandler).not.toHaveBeenCalled();
			expect(folderHandler).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Folder Notification Listeners
	// ─────────────────────────────────────────────────────────────

	describe("folder listeners", () => {
		it("should emit folder.created on vault create with TFolder", async () => {
			const handler = vi.fn();
			eventBus.on("folder.created", handler);

			const folder = createTFolder("notes/subfolder");
			mockApp._triggerVaultEvent("create", folder);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { path: "notes/subfolder", source: "obsidian" },
				})
			);
		});

		it("should emit folder.deleted on vault delete with TFolder", async () => {
			const handler = vi.fn();
			eventBus.on("folder.deleted", handler);

			const folder = createTFolder("notes/old-folder");
			mockApp._triggerVaultEvent("delete", folder);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { path: "notes/old-folder", source: "obsidian" },
				})
			);
		});

		it("should emit folder.renamed on vault rename with TFolder", async () => {
			const handler = vi.fn();
			eventBus.on("folder.renamed", handler);

			const folder = createTFolder("notes/new-name");
			mockApp._triggerVaultEvent("rename", folder, "notes/old-name");

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						oldPath: "notes/old-name",
						newPath: "notes/new-name",
						source: "obsidian",
					},
				})
			);
		});

		it("should not emit folder.modified on vault modify with TFolder", async () => {
			const handler = vi.fn();
			eventBus.on("file.modified", handler);

			const folder = createTFolder("notes/subfolder");
			mockApp._triggerVaultEvent("modify", folder);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Event-File Triggered
	// ─────────────────────────────────────────────────────────────

	describe("event.file.triggered", () => {
		it("should emit on modify when file has type=event and name", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "config.updated" },
			});

			const tFile = createTFile("events/config.md");
			mockApp._triggerVaultEvent("modify", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						eventName: "config.updated",
						path: "events/config.md",
						action: "modified",
					},
				})
			);
		});

		it("should emit on rename when file has type=event and name", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "task.moved" },
			});

			const tFile = createTFile("events/task-v2.md");
			mockApp._triggerVaultEvent("rename", tFile, "events/task.md");

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						eventName: "task.moved",
						path: "events/task-v2.md",
						action: "renamed",
					},
				})
			);
		});

		it("should not emit when frontmatter type is not 'Event'", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "note", name: "some.event" },
			});

			const tFile = createTFile("notes/regular.md");
			mockApp._triggerVaultEvent("modify", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should derive eventName from basename when name is missing", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event" },
			});

			const tFile = createTFile("events/Deployment Started.md");
			mockApp._triggerVaultEvent("modify", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						eventName: "deployment.started",
						path: "events/Deployment Started.md",
						action: "modified",
					},
				})
			);
		});

		it("should not emit when no cache exists", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue(null);

			const tFile = createTFile("events/deleted.md");
			mockApp._triggerVaultEvent("delete", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should emit via metadata.changed after vault create (deferred detection)", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			// Cache empty on create (real Obsidian behavior)
			mockApp.metadataCache.getFileCache.mockReturnValue(null);

			const tFile = createTFile("events/deploy.md");
			mockApp._triggerVaultEvent("create", tFile);
			await new Promise((r) => setTimeout(r, 10));

			// Not yet — cache was empty
			expect(handler).not.toHaveBeenCalled();

			// Now metadata cache fires with frontmatter populated
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "deployment.started" },
			});
			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						eventName: "deployment.started",
						path: "events/deploy.md",
						action: "created",
					},
				})
			);
		});

		it("should NOT emit via metadata.changed without prior vault create", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "config.updated" },
			});

			// metadata.changed fires without a preceding vault create
			const tFile = createTFile("events/config.md");
			mockApp._triggerMetadataCacheEvent("changed", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should NOT emit via metadata.changed when created file is not an event file", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			// vault create fires first (cache empty)
			mockApp.metadataCache.getFileCache.mockReturnValue(null);
			const tFile = createTFile("notes/regular.md");
			mockApp._triggerVaultEvent("create", tFile);

			// metadata.changed fires — but file is not type "Event"
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "note", title: "Regular note" },
			});
			mockApp._triggerMetadataCacheEvent("changed", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should emit on delete when cache is still available", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "backup.removed" },
			});

			const tFile = createTFile("events/backup.md");
			mockApp._triggerVaultEvent("delete", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						eventName: "backup.removed",
						path: "events/backup.md",
						action: "deleted",
					},
				})
			);
		});

		it("should derive eventName from basename on deferred create", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue(null);
			const tFile = createTFile("events/Build Completed.md");
			mockApp._triggerVaultEvent("create", tFile);
			await new Promise((r) => setTimeout(r, 10));

			// metadata.changed — no explicit name in frontmatter
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event" },
			});
			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						eventName: "build.completed",
						path: "events/Build Completed.md",
						action: "created",
					},
				})
			);
		});

		it("should consume pending path (one-shot) — second metadata.changed does not re-emit", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue(null);
			const tFile = createTFile("events/deploy.md");
			mockApp._triggerVaultEvent("create", tFile);

			// First metadata.changed → consumes pending path
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "deploy.started" },
			});
			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledTimes(1);

			// Second metadata.changed for same file — no pending path, should not emit
			handler.mockClear();
			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should not emit when type is lowercase 'event'", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "event", name: "deploy.started" },
			});

			const tFile = createTFile("events/deploy.md");
			mockApp._triggerVaultEvent("modify", tFile);

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should handle full lifecycle: create then modify", async () => {
			const handler = vi.fn();
			eventBus.on("event.file.triggered", handler);

			// Step 1: vault create (cache empty)
			mockApp.metadataCache.getFileCache.mockReturnValue(null);
			const tFile = createTFile("events/pipeline.md");
			mockApp._triggerVaultEvent("create", tFile);
			await new Promise((r) => setTimeout(r, 10));

			// Step 2: metadata.changed → deferred "created"
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { type: "Event", name: "pipeline.started" },
			});
			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ action: "created" }),
				})
			);

			// Step 3: vault modify → direct "modified"
			handler.mockClear();
			mockApp._triggerVaultEvent("modify", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ action: "modified" }),
				})
			);
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Workspace Listeners
	// ─────────────────────────────────────────────────────────────

	describe("workspace listeners", () => {
		it("should emit workspace.leaf-changed with file when leaf has a file view", async () => {
			const handler = vi.fn();
			eventBus.on("workspace.leaf-changed", handler);

			const tFile = createTFile("notes/active.md");
			const leaf = new WorkspaceLeaf();
			(leaf.view as unknown as { file: TFile }).file = tFile;

			mockApp._triggerWorkspaceEvent("active-leaf-change", leaf);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						file: {
							path: "notes/active.md",
							basename: "active",
							extension: "md",
						},
					},
				})
			);
		});

		it("should emit workspace.leaf-changed with null when leaf is null", async () => {
			const handler = vi.fn();
			eventBus.on("workspace.leaf-changed", handler);

			mockApp._triggerWorkspaceEvent("active-leaf-change", null);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { file: null },
				})
			);
		});

		it("should emit workspace.leaf-changed with null when leaf view has no file", async () => {
			const handler = vi.fn();
			eventBus.on("workspace.leaf-changed", handler);

			const leaf = new WorkspaceLeaf();
			(leaf.view as unknown as { file: TFile | null }).file = null;

			mockApp._triggerWorkspaceEvent("active-leaf-change", leaf);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { file: null },
				})
			);
		});

		it("should emit workspace.file-opened with file info", async () => {
			const handler = vi.fn();
			eventBus.on("workspace.file-opened", handler);

			const tFile = createTFile("notes/opened.md");
			mockApp._triggerWorkspaceEvent("file-open", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						file: {
							path: "notes/opened.md",
							basename: "opened",
							extension: "md",
						},
					},
				})
			);
		});

		it("should emit workspace.file-opened with null when no file", async () => {
			const handler = vi.fn();
			eventBus.on("workspace.file-opened", handler);

			mockApp._triggerWorkspaceEvent("file-open", null);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { file: null },
				})
			);
		});

		it("should emit workspace.layout-changed", async () => {
			const handler = vi.fn();
			eventBus.on("workspace.layout-changed", handler);

			mockApp._triggerWorkspaceEvent("layout-change");
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledOnce();
		});
	});

	// ─────────────────────────────────────────────────────────────
	// MetadataCache Listeners
	// ─────────────────────────────────────────────────────────────

	describe("metadata listeners", () => {
		it("should emit metadata.changed with frontmatter", async () => {
			const handler = vi.fn();
			eventBus.on("metadata.changed", handler);

			const tFile = createTFile("notes/meta.md");
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: { title: "Hello", tags: ["test"] },
			});

			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						path: "notes/meta.md",
						frontmatter: { title: "Hello", tags: ["test"] },
					},
				})
			);
		});

		it("should emit metadata.changed with undefined frontmatter when no cache", async () => {
			const handler = vi.fn();
			eventBus.on("metadata.changed", handler);

			const tFile = createTFile("notes/no-fm.md");
			mockApp.metadataCache.getFileCache.mockReturnValue(null);

			mockApp._triggerMetadataCacheEvent("changed", tFile);
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: {
						path: "notes/no-fm.md",
						frontmatter: undefined,
					},
				})
			);
		});

		it("should ignore non-TFile metadata changes", async () => {
			const handler = vi.fn();
			eventBus.on("metadata.changed", handler);

			mockApp._triggerMetadataCacheEvent("changed", { path: "folder" });
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).not.toHaveBeenCalled();
		});

		it("should emit metadata.resolved", async () => {
			const handler = vi.fn();
			eventBus.on("metadata.resolved", handler);

			mockApp._triggerMetadataCacheEvent("resolved");
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledOnce();
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Dispose
	// ─────────────────────────────────────────────────────────────

	describe("dispose", () => {
		it("should unsubscribe all EventBus handlers", async () => {
			bridge.dispose();

			const handler = vi.fn();
			eventBus.on("file.create.response", handler);

			await eventBus.emit("file.create.request", {
				requestId: "req-99" as RequestId,
				path: "test.md",
				content: "",
			});

			// The bridge handler should no longer fire, so no response emitted
			expect(handler).not.toHaveBeenCalled();
		});
	});
});
