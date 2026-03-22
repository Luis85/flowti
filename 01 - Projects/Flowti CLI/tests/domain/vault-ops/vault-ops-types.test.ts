import { describe, it, expect } from "vitest";
import type {
	VaultOpsDeps,
	VaultOpRequest,
	VaultReadRequest,
	VaultSearchRequest,
	VaultTagRequest,
	VaultCreateRequest,
	VaultEditRequest,
	VaultMoveRequest,
	VaultLinkRequest,
	AnyVaultOpRequest,
	VaultOpOutcome,
	VaultOpResult,
	FolderEntry,
	TagEntry,
	RecentChange,
	VaultContext,
	VaultScope,
	FileIndexEntry,
	VaultContextCache,
	VaultEvent,
} from "../../../src/domain/vault-ops/vault-ops-types.js";

describe("vault-ops-types", () => {
	describe("VaultOpsDeps", () => {
		it("accepts valid deps structure", () => {
			const deps: VaultOpsDeps = {
				disk: {
					existsSync: () => true,
					readFileSync: () => "",
					writeFileSync: () => undefined,
					mkdirSync: () => undefined,
					renameSync: () => undefined,
					readdirSync: () => [],
					statSync: () => ({ mtimeMs: 0 }),
					rmSync: () => undefined,
					copyFileSync: () => undefined,
				},
				clock: { iso: () => "2026-03-22T00:00:00Z" },
				paths: {
					join: (...segs: string[]) => segs.join("/"),
					dirname: () => "",
					basename: () => "",
					relative: () => "",
				},
				vaultRoot: "/vault",
			};
			expect(deps.vaultRoot).toBe("/vault");
			expect(deps.disk.existsSync("/test")).toBe(true);
			expect(deps.clock.iso()).toBe("2026-03-22T00:00:00Z");
		});
	});

	describe("request types", () => {
		it("VaultReadRequest accepts valid request", () => {
			const req: VaultReadRequest = {
				operation: "vault-read",
				agentName: "archivist",
				path: "00 - Inbox/note.md",
			};
			expect(req.operation).toBe("vault-read");
			expect(req.agentName).toBe("archivist");
			expect(req.path).toBe("00 - Inbox/note.md");
		});

		it("VaultSearchRequest accepts query with tags", () => {
			const req: VaultSearchRequest = {
				operation: "vault-search",
				agentName: "scout",
				query: { tags: ["project", "active"] },
			};
			expect(req.operation).toBe("vault-search");
			expect(req.query.tags).toEqual(["project", "active"]);
		});

		it("VaultSearchRequest accepts query with folder", () => {
			const req: VaultSearchRequest = {
				operation: "vault-search",
				agentName: "scout",
				query: { folder: "01 - Projects" },
			};
			expect(req.query.folder).toBe("01 - Projects");
		});

		it("VaultSearchRequest accepts query with pattern", () => {
			const req: VaultSearchRequest = {
				operation: "vault-search",
				agentName: "scout",
				query: { pattern: "meeting.*notes" },
			};
			expect(req.query.pattern).toBe("meeting.*notes");
		});

		it("VaultTagRequest accepts add and remove tags", () => {
			const req: VaultTagRequest = {
				operation: "vault-tag",
				agentName: "tagger",
				path: "note.md",
				addTags: ["reviewed"],
				removeTags: ["inbox"],
			};
			expect(req.operation).toBe("vault-tag");
			expect(req.addTags).toEqual(["reviewed"]);
			expect(req.removeTags).toEqual(["inbox"]);
		});

		it("VaultTagRequest works with only addTags", () => {
			const req: VaultTagRequest = {
				operation: "vault-tag",
				agentName: "tagger",
				path: "note.md",
				addTags: ["new-tag"],
			};
			expect(req.addTags).toEqual(["new-tag"]);
			expect(req.removeTags).toBeUndefined();
		});

		it("VaultCreateRequest accepts frontmatter and body", () => {
			const req: VaultCreateRequest = {
				operation: "vault-create",
				agentName: "creator",
				path: "new-note.md",
				frontmatter: { title: "Hello", tags: ["draft"] },
				body: "# Hello\n\nContent here.",
			};
			expect(req.operation).toBe("vault-create");
			expect(req.frontmatter).toEqual({ title: "Hello", tags: ["draft"] });
			expect(req.body).toBe("# Hello\n\nContent here.");
		});

		it("VaultCreateRequest works without optional fields", () => {
			const req: VaultCreateRequest = {
				operation: "vault-create",
				agentName: "creator",
				path: "bare-note.md",
			};
			expect(req.frontmatter).toBeUndefined();
			expect(req.body).toBeUndefined();
		});

		it("VaultEditRequest accepts path and content", () => {
			const req: VaultEditRequest = {
				operation: "vault-edit",
				agentName: "editor",
				path: "existing.md",
				content: "Updated content",
			};
			expect(req.operation).toBe("vault-edit");
			expect(req.content).toBe("Updated content");
		});

		it("VaultMoveRequest accepts fromPath and toPath", () => {
			const req: VaultMoveRequest = {
				operation: "vault-move",
				agentName: "organizer",
				fromPath: "00 - Inbox/note.md",
				toPath: "01 - Projects/note.md",
			};
			expect(req.operation).toBe("vault-move");
			expect(req.fromPath).toBe("00 - Inbox/note.md");
			expect(req.toPath).toBe("01 - Projects/note.md");
		});

		it("VaultLinkRequest accepts add and remove links", () => {
			const req: VaultLinkRequest = {
				operation: "vault-link",
				agentName: "linker",
				path: "note.md",
				addLinks: ["related-note.md"],
				removeLinks: ["old-link.md"],
			};
			expect(req.operation).toBe("vault-link");
			expect(req.addLinks).toEqual(["related-note.md"]);
			expect(req.removeLinks).toEqual(["old-link.md"]);
		});

		it("VaultLinkRequest works with only addLinks", () => {
			const req: VaultLinkRequest = {
				operation: "vault-link",
				agentName: "linker",
				path: "note.md",
				addLinks: ["new-link.md"],
			};
			expect(req.addLinks).toEqual(["new-link.md"]);
			expect(req.removeLinks).toBeUndefined();
		});

		it("VaultOpRequest accepts optional taskId", () => {
			const req: VaultReadRequest = {
				operation: "vault-read",
				agentName: "reader",
				taskId: "task-42",
				path: "note.md",
			};
			expect(req.taskId).toBe("task-42");
		});

		it("AnyVaultOpRequest accepts all 7 request types", () => {
			const requests: AnyVaultOpRequest[] = [
				{ operation: "vault-read", agentName: "a", path: "p" },
				{ operation: "vault-search", agentName: "a", query: {} },
				{ operation: "vault-tag", agentName: "a", path: "p" },
				{ operation: "vault-create", agentName: "a", path: "p" },
				{ operation: "vault-edit", agentName: "a", path: "p", content: "c" },
				{ operation: "vault-move", agentName: "a", fromPath: "f", toPath: "t" },
				{ operation: "vault-link", agentName: "a", path: "p" },
			];
			expect(requests).toHaveLength(7);
		});
	});

	describe("result types", () => {
		it("VaultOpOutcome includes all valid values", () => {
			const outcomes: VaultOpOutcome[] = ["executed", "staged", "queued", "denied", "failed"];
			expect(outcomes).toHaveLength(5);
		});

		it("VaultOpResult accepts executed result", () => {
			const result: VaultOpResult = {
				outcome: "executed",
				operation: "vault-read",
				agentName: "reader",
				data: { content: "file content" },
			};
			expect(result.outcome).toBe("executed");
			expect(result.operation).toBe("vault-read");
			expect(result.data).toEqual({ content: "file content" });
		});

		it("VaultOpResult accepts staged result with stagingId", () => {
			const result: VaultOpResult = {
				outcome: "staged",
				operation: "vault-edit",
				agentName: "editor",
				taskId: "task-1",
				stagingId: "staging-abc",
			};
			expect(result.outcome).toBe("staged");
			expect(result.stagingId).toBe("staging-abc");
			expect(result.taskId).toBe("task-1");
		});

		it("VaultOpResult accepts denied result with reason", () => {
			const result: VaultOpResult = {
				outcome: "denied",
				operation: "vault-move",
				agentName: "mover",
				reason: "Insufficient trust level",
			};
			expect(result.outcome).toBe("denied");
			expect(result.reason).toBe("Insufficient trust level");
		});

		it("VaultOpResult accepts minimal result", () => {
			const result: VaultOpResult = {
				outcome: "queued",
				operation: "vault-create",
				agentName: "creator",
			};
			expect(result.taskId).toBeUndefined();
			expect(result.data).toBeUndefined();
			expect(result.stagingId).toBeUndefined();
			expect(result.reason).toBeUndefined();
		});
	});

	describe("context types", () => {
		it("FolderEntry accepts valid entry", () => {
			const entry: FolderEntry = { path: "01 - Projects", noteCount: 42 };
			expect(entry.path).toBe("01 - Projects");
			expect(entry.noteCount).toBe(42);
		});

		it("TagEntry accepts valid entry", () => {
			const entry: TagEntry = { tag: "project", count: 15 };
			expect(entry.tag).toBe("project");
			expect(entry.count).toBe(15);
		});

		it("RecentChange accepts all action types", () => {
			const actions: RecentChange["action"][] = ["created", "modified", "deleted", "moved"];
			expect(actions).toHaveLength(4);
		});

		it("RecentChange accepts valid change", () => {
			const change: RecentChange = {
				path: "00 - Inbox/note.md",
				action: "created",
				at: "2026-03-22T10:00:00Z",
			};
			expect(change.path).toBe("00 - Inbox/note.md");
			expect(change.action).toBe("created");
			expect(change.at).toBe("2026-03-22T10:00:00Z");
		});

		it("VaultContext accepts valid context", () => {
			const ctx: VaultContext = {
				folderMap: [{ path: "01 - Projects", noteCount: 10 }],
				tagIndex: [{ tag: "active", count: 5 }],
				recentChanges: [{ path: "note.md", action: "modified", at: "2026-03-22T10:00:00Z" }],
			};
			expect(ctx.folderMap).toHaveLength(1);
			expect(ctx.tagIndex).toHaveLength(1);
			expect(ctx.recentChanges).toHaveLength(1);
		});

		it("VaultContext accepts empty collections", () => {
			const ctx: VaultContext = {
				folderMap: [],
				tagIndex: [],
				recentChanges: [],
			};
			expect(ctx.folderMap).toHaveLength(0);
			expect(ctx.tagIndex).toHaveLength(0);
			expect(ctx.recentChanges).toHaveLength(0);
		});

		it("VaultScope accepts optional folders and tags", () => {
			const full: VaultScope = {
				folders: ["01 - Projects", "02 - Areas"],
				tags: ["active"],
			};
			expect(full.folders).toHaveLength(2);
			expect(full.tags).toHaveLength(1);
		});

		it("VaultScope accepts empty scope", () => {
			const empty: VaultScope = {};
			expect(empty.folders).toBeUndefined();
			expect(empty.tags).toBeUndefined();
		});
	});

	describe("cache types", () => {
		it("FileIndexEntry accepts valid entry", () => {
			const entry: FileIndexEntry = {
				path: "01 - Projects/note.md",
				mtimeMs: 1711100000000,
				tags: ["project", "active"],
			};
			expect(entry.path).toBe("01 - Projects/note.md");
			expect(entry.mtimeMs).toBe(1711100000000);
			expect(entry.tags).toEqual(["project", "active"]);
		});

		it("FileIndexEntry accepts empty tags", () => {
			const entry: FileIndexEntry = {
				path: "untagged.md",
				mtimeMs: 0,
				tags: [],
			};
			expect(entry.tags).toHaveLength(0);
		});

		it("VaultContextCache accepts valid cache", () => {
			const cache: VaultContextCache = {
				version: 1,
				builtAt: "2026-03-22T10:00:00Z",
				folderMap: [{ path: "01 - Projects", noteCount: 3 }],
				tagIndex: [{ tag: "active", count: 2 }],
				fileIndex: [
					{ path: "note-a.md", mtimeMs: 1711100000000, tags: ["active"] },
					{ path: "note-b.md", mtimeMs: 1711100001000, tags: [] },
				],
			};
			expect(cache.version).toBe(1);
			expect(cache.builtAt).toBe("2026-03-22T10:00:00Z");
			expect(cache.folderMap).toHaveLength(1);
			expect(cache.tagIndex).toHaveLength(1);
			expect(cache.fileIndex).toHaveLength(2);
		});

		it("VaultContextCache accepts empty collections", () => {
			const cache: VaultContextCache = {
				version: 1,
				builtAt: "2026-03-22T00:00:00Z",
				folderMap: [],
				tagIndex: [],
				fileIndex: [],
			};
			expect(cache.folderMap).toHaveLength(0);
			expect(cache.fileIndex).toHaveLength(0);
		});
	});

	describe("event types", () => {
		it("VaultEvent accepts valid event", () => {
			const event: VaultEvent = {
				folder: "00 - Inbox",
				type: "vault-create",
				path: "00 - Inbox/new-note.md",
				at: "2026-03-22T10:00:00Z",
			};
			expect(event.folder).toBe("00 - Inbox");
			expect(event.type).toBe("vault-create");
			expect(event.path).toBe("00 - Inbox/new-note.md");
			expect(event.at).toBe("2026-03-22T10:00:00Z");
		});

		it("VaultEvent type field accepts all vault operations", () => {
			const ops: VaultEvent["type"][] = [
				"vault-read", "vault-search", "vault-tag",
				"vault-create", "vault-edit", "vault-move", "vault-link",
			];
			expect(ops).toHaveLength(7);
		});
	});
});
