import { describe, it, expect } from "vitest";
import {
	mapVaultFolderNote,
	VAULT_FOLDER_SOURCE_EVENT,
	VAULT_FOLDER_SOURCE_HUB,
} from "../../../src/domain/inbox/vaultFolderMapper";

describe("vaultFolderMapper", () => {
	describe("constants", () => {
		it("should export the correct source event", () => {
			expect(VAULT_FOLDER_SOURCE_EVENT).toBe("inbox.vaultFolder.noteDetected");
		});

		it("should export the correct source hub", () => {
			expect(VAULT_FOLDER_SOURCE_HUB).toBe("vault-folder");
		});
	});

	describe("mapVaultFolderNote", () => {
		it("should return a complete InboxItem", () => {
			const item = mapVaultFolderNote(
				{ path: "00 - Connectivity/inbox/Quick thought.md", title: "Quick thought", folder: "00 - Connectivity/inbox" },
				"inbox_42",
			);

			expect(item.id).toBe("inbox_42");
			expect(item.type).toBe("action");
			expect(item.title).toBe("Quick thought");
			expect(item.description).toContain("00 - Connectivity/inbox/Quick thought.md");
			expect(item.description).toContain("00 - Connectivity/inbox");
			expect(item.sourceEvent).toBe(VAULT_FOLDER_SOURCE_EVENT);
			expect(item.sourceHub).toBe(VAULT_FOLDER_SOURCE_HUB);
			expect(item.read).toBe(false);
		});

		it("should always set type to action (requires classification)", () => {
			const item = mapVaultFolderNote(
				{ path: "inbox/note.md", title: "note", folder: "inbox" },
				"id_1",
			);
			expect(item.type).toBe("action");
		});

		it("should use the provided title", () => {
			const item = mapVaultFolderNote(
				{ path: "inbox/My Great Idea.md", title: "My Great Idea", folder: "inbox" },
				"id_2",
			);
			expect(item.title).toBe("My Great Idea");
		});

		it("should include path in description", () => {
			const item = mapVaultFolderNote(
				{ path: "notes/deep/sub/file.md", title: "file", folder: "notes" },
				"id_3",
			);
			expect(item.description).toBe("Untyped note in notes: notes/deep/sub/file.md");
		});

		it("should include folder in description", () => {
			const item = mapVaultFolderNote(
				{ path: "00 - Connectivity/inbox/test.md", title: "test", folder: "00 - Connectivity/inbox" },
				"id_4",
			);
			expect(item.description).toContain("Untyped note in 00 - Connectivity/inbox:");
		});

		it("should produce an ISO timestamp string", () => {
			const item = mapVaultFolderNote(
				{ path: "inbox/note.md", title: "note", folder: "inbox" },
				"id_5",
			);
			expect(item.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("should always set read to false", () => {
			const item = mapVaultFolderNote(
				{ path: "inbox/note.md", title: "note", folder: "inbox" },
				"id_6",
			);
			expect(item.read).toBe(false);
		});

		it("should use the provided id", () => {
			const item = mapVaultFolderNote(
				{ path: "inbox/note.md", title: "note", folder: "inbox" },
				"custom-id-123",
			);
			expect(item.id).toBe("custom-id-123");
		});

		it("should handle long paths", () => {
			const longPath = "very/deeply/nested/folder/structure/that/goes/on/and/on/file.md";
			const item = mapVaultFolderNote(
				{ path: longPath, title: "file", folder: "very/deeply/nested" },
				"id_7",
			);
			expect(item.description).toContain(longPath);
		});

		it("should handle special characters in title", () => {
			const item = mapVaultFolderNote(
				{ path: "inbox/Note with (parens) & symbols!.md", title: "Note with (parens) & symbols!", folder: "inbox" },
				"id_8",
			);
			expect(item.title).toBe("Note with (parens) & symbols!");
		});
	});
});
