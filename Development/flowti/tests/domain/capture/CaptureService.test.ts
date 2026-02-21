import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { CaptureService } from "../../../src/domain/capture/CaptureService";
import { createMockFileSystem } from "../../mocks/filesystem";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";

describe("CaptureService", () => {
	let service: CaptureService;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		service = new CaptureService({
			eventBus,
			fileSystem,
			getSettings: () => ({ captureFolder: "00 - Connectivity/inbox" }),
		});
	});

	// ── capture ──────────────────────────────────────────────

	describe("capture", () => {
		it("should create a file in the configured capture folder", async () => {
			await service.capture({ title: "My Great Idea", type: "idea" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				"00 - Connectivity/inbox/My Great Idea.md",
				expect.stringContaining("type: Idea"),
				{ createFolders: true },
			);
		});

		it("should include origin: quick-capture in frontmatter", async () => {
			await service.capture({ title: "Test", type: "idea" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("origin: quick-capture"),
				expect.any(Object),
			);
		});

		it("should include created timestamp in frontmatter", async () => {
			await service.capture({ title: "Test", type: "idea" });

			const content = (fileSystem.createFile as ReturnType<typeof import("vitest").vi.fn>).mock.calls[0][1] as string;
			expect(content).toMatch(/created: \d{4}-\d{2}-\d{2}T/);
		});

		it("should include description in frontmatter when provided", async () => {
			await service.capture({ title: "Test", type: "idea", description: "A short description" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining('description: "A short description"'),
				expect.any(Object),
			);
		});

		it("should omit description from frontmatter when not provided", async () => {
			await service.capture({ title: "Test", type: "feedback" });

			const content = (fileSystem.createFile as ReturnType<typeof import("vitest").vi.fn>).mock.calls[0][1] as string;
			expect(content).not.toContain("description:");
		});

		it("should emit capture.idea.created for type idea", async () => {
			const events: Array<{ path: string; title: string }> = [];
			eventBus.on("capture.idea.created", (e) => { events.push(e.payload); });

			await service.capture({ title: "My Idea", type: "idea" });

			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({
				path: "00 - Connectivity/inbox/My Idea.md",
				title: "My Idea",
			});
		});

		it("should emit capture.feedback.created for type feedback", async () => {
			const events: Array<{ path: string; title: string }> = [];
			eventBus.on("capture.feedback.created", (e) => { events.push(e.payload); });

			await service.capture({ title: "My Feedback", type: "feedback" });

			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({
				path: "00 - Connectivity/inbox/My Feedback.md",
				title: "My Feedback",
			});
		});

		it("should not emit type-specific event for non-idea/feedback types", async () => {
			const ideaEvents: unknown[] = [];
			const feedbackEvents: unknown[] = [];
			eventBus.on("capture.idea.created", (e) => { ideaEvents.push(e.payload); });
			eventBus.on("capture.feedback.created", (e) => { feedbackEvents.push(e.payload); });

			await service.capture({ title: "Bug Report", type: "bug" });

			expect(ideaEvents).toHaveLength(0);
			expect(feedbackEvents).toHaveLength(0);
		});

		it("should always emit capture.note.created for all types", async () => {
			const events: Array<{ path: string; title: string; type: string }> = [];
			eventBus.on("capture.note.created", (e) => { events.push(e.payload); });

			await service.capture({ title: "Idea", type: "idea" });
			await service.capture({ title: "Feedback", type: "feedback" });
			await service.capture({ title: "Bug", type: "bug" });
			await service.capture({ title: "Custom", type: "meeting-notes" });

			expect(events).toHaveLength(4);
			expect(events.map((e) => e.type)).toEqual(["idea", "feedback", "bug", "meeting-notes"]);
		});

		it("should return CaptureResult with correct fields", async () => {
			const result = await service.capture({ title: "Test Note", type: "idea" });

			expect(result).toEqual({
				path: "00 - Connectivity/inbox/Test Note.md",
				title: "Test Note",
				type: "idea",
			});
		});

		it("should sanitize file name by removing invalid characters", async () => {
			await service.capture({ title: 'Invalid: chars <in> "title"', type: "idea" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				"00 - Connectivity/inbox/Invalid chars in title.md",
				expect.any(String),
				expect.any(Object),
			);
		});

		it("should use captureFolder from settings getter", async () => {
			service.getSettings = () => ({ captureFolder: "custom/inbox/folder" });

			await service.capture({ title: "Test", type: "idea" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				"custom/inbox/folder/Test.md",
				expect.any(String),
				expect.any(Object),
			);
		});

		it("should throw on empty title after sanitization", async () => {
			await expect(service.capture({ title: ":::***", type: "idea" }))
				.rejects.toThrow("Capture title is empty after sanitization");

			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});

		it("should emit capture.note.created for RAID types", async () => {
			const events: Array<{ path: string; title: string; type: string }> = [];
			eventBus.on("capture.note.created", (e) => { events.push(e.payload); });

			for (const type of ["risk", "assumption", "issue", "decision"]) {
				await service.capture({ title: `Test ${type}`, type });
			}

			expect(events).toHaveLength(4);
			expect(events.map((e) => e.type)).toEqual(["risk", "assumption", "issue", "decision"]);
		});

		it("should create title-cased frontmatter for RAID types", async () => {
			await service.capture({ title: "Security Risk", type: "risk" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("type: Risk"),
				expect.any(Object),
			);
		});

		it("should create learning type with title-cased frontmatter", async () => {
			await service.capture({ title: "TIL about events", type: "learning" });

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				"00 - Connectivity/inbox/TIL about events.md",
				expect.stringContaining("type: Learning"),
				expect.any(Object),
			);
		});

		it("should emit capture.note.created for learning type", async () => {
			const events: Array<{ path: string; title: string; type: string }> = [];
			eventBus.on("capture.note.created", (e) => { events.push(e.payload); });

			await service.capture({ title: "TIL", type: "learning" });

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("learning");
		});
	});
});
