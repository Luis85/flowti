import { describe, it, expect } from "vitest";
import {
	vaultRead,
	vaultSearch,
	vaultTag,
	vaultCreate,
	vaultEdit,
	vaultMove,
	vaultLink,
} from "../../../src/domain/vault-ops/vault-ops.js";
import type {
	VaultOpsDeps,
	VaultReadRequest,
	VaultSearchRequest,
	VaultTagRequest,
	VaultCreateRequest,
	VaultEditRequest,
	VaultMoveRequest,
	VaultLinkRequest,
} from "../../../src/domain/vault-ops/vault-ops-types.js";

// ── Test helper ─────────────────────────────────────────────────────

function makeDeps(files: Record<string, string> = {}): VaultOpsDeps {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: (p: string) => p in store,
			readFileSync: (p: string, _enc?: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return store[p];
			},
			writeFileSync: (p: string, content: string) => {
				store[p] = content;
			},
			mkdirSync: () => undefined,
			renameSync: (from: string, to: string) => {
				if (!(from in store)) throw new Error(`ENOENT: ${from}`);
				store[to] = store[from];
				delete store[from];
			},
			readdirSync: (dir: string, _opts?: unknown) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				return Object.keys(store)
					.filter((p) => p.startsWith(prefix))
					.map((p) => ({
						name: p.slice(prefix.length),
						isFile: () => true,
						isDirectory: () => false,
					}));
			},
			statSync: (p: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return { mtimeMs: Date.now() };
			},
			rmSync: (p: string) => {
				delete store[p];
			},
			copyFileSync: (src: string, dest: string) => {
				if (!(src in store)) throw new Error(`ENOENT: ${src}`);
				store[dest] = store[src];
			},
		},
		clock: { iso: () => "2026-03-21T10:00:00Z" },
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (from: string, to: string) =>
				to.startsWith(from + "/") ? to.slice(from.length + 1) : to,
		},
		vaultRoot: "/vault",
	};
}

// ── Request factories ───────────────────────────────────────────────

const agent = "test-agent";

function readReq(path: string): VaultReadRequest {
	return { operation: "vault-read", agentName: agent, path };
}

function searchReq(query: VaultSearchRequest["query"]): VaultSearchRequest {
	return { operation: "vault-search", agentName: agent, query };
}

function tagReq(
	path: string,
	opts: { addTags?: readonly string[]; removeTags?: readonly string[] } = {},
): VaultTagRequest {
	return { operation: "vault-tag", agentName: agent, path, ...opts };
}

function createReq(
	path: string,
	opts: { frontmatter?: Record<string, unknown>; body?: string } = {},
): VaultCreateRequest {
	return { operation: "vault-create", agentName: agent, path, ...opts };
}

function editReq(path: string, content: string): VaultEditRequest {
	return { operation: "vault-edit", agentName: agent, path, content };
}

function moveReq(fromPath: string, toPath: string): VaultMoveRequest {
	return { operation: "vault-move", agentName: agent, fromPath, toPath };
}

function linkReq(
	path: string,
	opts: { addLinks?: readonly string[]; removeLinks?: readonly string[] } = {},
): VaultLinkRequest {
	return { operation: "vault-link", agentName: agent, path, ...opts };
}

// ── vaultRead ───────────────────────────────────────────────────────

describe("vaultRead", () => {
	it("reads file content and frontmatter", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md":
				"---\ntitle: Hello\ntags:\n  - greeting\n---\nBody text here",
		});

		const result = vaultRead(readReq("notes/hello.md"), deps);

		expect(result.frontmatter).toEqual({
			title: "Hello",
			tags: ["greeting"],
		});
		expect(result.content).toBe("\nBody text here");
	});

	it("throws when file does not exist", () => {
		const deps = makeDeps({});

		expect(() => vaultRead(readReq("missing.md"), deps)).toThrow("ENOENT");
	});

	it("returns empty frontmatter for plain text", () => {
		const deps = makeDeps({
			"/vault/plain.md": "Just plain text",
		});

		const result = vaultRead(readReq("plain.md"), deps);

		expect(result.frontmatter).toEqual({});
		expect(result.content).toBe("Just plain text");
	});
});

// ── vaultSearch ─────────────────────────────────────────────────────

describe("vaultSearch", () => {
	it("finds files by tag", () => {
		const deps = makeDeps({
			"/vault/a.md": "---\ntags:\n  - alpha\n---\nContent A",
			"/vault/b.md": "---\ntags:\n  - beta\n---\nContent B",
			"/vault/c.md": "---\ntags:\n  - alpha\n---\nContent C",
		});

		const result = vaultSearch(searchReq({ tags: ["alpha"] }), deps);

		expect(result.matches).toHaveLength(2);
		expect(result.matches.map((m) => m.path).sort()).toEqual([
			"a.md",
			"c.md",
		]);
	});

	it("finds files by folder", () => {
		const deps = makeDeps({
			"/vault/docs/a.md": "---\ntags:\n  - alpha\n---\nA",
			"/vault/notes/b.md": "---\ntags:\n  - beta\n---\nB",
		});

		const result = vaultSearch(searchReq({ folder: "docs" }), deps);

		expect(result.matches).toHaveLength(1);
		expect(result.matches[0].path).toBe("docs/a.md");
	});

	it("returns empty for no matches", () => {
		const deps = makeDeps({
			"/vault/a.md": "---\ntags:\n  - alpha\n---\nContent",
		});

		const result = vaultSearch(
			searchReq({ tags: ["missing-tag"] }),
			deps,
		);

		expect(result.matches).toHaveLength(0);
	});

	it("finds files by pattern", () => {
		const deps = makeDeps({
			"/vault/a.md": "Contains the keyword secret here",
			"/vault/b.md": "No keyword here",
		});

		const result = vaultSearch(searchReq({ pattern: "secret" }), deps);

		expect(result.matches).toHaveLength(1);
		expect(result.matches[0].path).toBe("a.md");
	});
});

// ── vaultTag ────────────────────────────────────────────────────────

describe("vaultTag", () => {
	it("adds tags to existing frontmatter", () => {
		const deps = makeDeps({
			"/vault/note.md": "---\ntags:\n  - existing\n---\nBody",
		});

		const result = vaultTag(
			tagReq("note.md", { addTags: ["new-tag"] }),
			deps,
		);

		expect(result.tags).toEqual(["existing", "new-tag"]);
	});

	it("removes tags", () => {
		const deps = makeDeps({
			"/vault/note.md":
				"---\ntags:\n  - keep\n  - remove-me\n---\nBody",
		});

		const result = vaultTag(
			tagReq("note.md", { removeTags: ["remove-me"] }),
			deps,
		);

		expect(result.tags).toEqual(["keep"]);
	});

	it("creates tags array when none exists", () => {
		const deps = makeDeps({
			"/vault/note.md": "---\ntitle: Hello\n---\nBody",
		});

		const result = vaultTag(
			tagReq("note.md", { addTags: ["brand-new"] }),
			deps,
		);

		expect(result.tags).toEqual(["brand-new"]);
	});

	it("throws when file does not exist", () => {
		const deps = makeDeps({});

		expect(() =>
			vaultTag(tagReq("missing.md", { addTags: ["tag"] }), deps),
		).toThrow("ENOENT");
	});

	it("deduplicates tags on add", () => {
		const deps = makeDeps({
			"/vault/note.md": "---\ntags:\n  - existing\n---\nBody",
		});

		const result = vaultTag(
			tagReq("note.md", { addTags: ["existing", "new"] }),
			deps,
		);

		expect(result.tags).toEqual(["existing", "new"]);
	});
});

// ── vaultCreate ─────────────────────────────────────────────────────

describe("vaultCreate", () => {
	it("creates file with frontmatter and body", () => {
		const deps = makeDeps({});

		const result = vaultCreate(
			createReq("new/note.md", {
				frontmatter: { title: "New Note", tags: ["created"] },
				body: "Hello world",
			}),
			deps,
		);

		expect(result.path).toBe("new/note.md");

		const written = deps.disk.readFileSync(
			"/vault/new/note.md",
			"utf-8",
		);
		expect(written).toContain("title: New Note");
		expect(written).toContain("Hello world");
	});

	it("throws when file already exists", () => {
		const deps = makeDeps({
			"/vault/existing.md": "content",
		});

		expect(() =>
			vaultCreate(
				createReq("existing.md", { body: "new content" }),
				deps,
			),
		).toThrow("File already exists");
	});

	it("creates file with body only", () => {
		const deps = makeDeps({});

		const result = vaultCreate(
			createReq("plain.md", { body: "Plain body content" }),
			deps,
		);

		expect(result.path).toBe("plain.md");

		const written = deps.disk.readFileSync("/vault/plain.md", "utf-8");
		expect(written).toBe("Plain body content");
	});

	it("creates file with no body and no frontmatter", () => {
		const deps = makeDeps({});

		const result = vaultCreate(createReq("empty.md"), deps);

		expect(result.path).toBe("empty.md");

		const written = deps.disk.readFileSync("/vault/empty.md", "utf-8");
		expect(written).toBe("");
	});
});

// ── vaultEdit ───────────────────────────────────────────────────────

describe("vaultEdit", () => {
	it("replaces body while preserving frontmatter", () => {
		const deps = makeDeps({
			"/vault/note.md":
				"---\ntitle: Keep Me\n---\nOld body content",
		});

		const result = vaultEdit(editReq("note.md", "Brand new body"), deps);

		expect(result.path).toBe("note.md");

		const written = deps.disk.readFileSync("/vault/note.md", "utf-8");
		expect(written).toContain("title: Keep Me");
		expect(written).toContain("Brand new body");
		expect(written).not.toContain("Old body content");
	});

	it("throws when file does not exist", () => {
		const deps = makeDeps({});

		expect(() =>
			vaultEdit(editReq("missing.md", "test"), deps),
		).toThrow("ENOENT");
	});

	it("writes content directly for files without frontmatter", () => {
		const deps = makeDeps({
			"/vault/plain.md": "Old plain content",
		});

		vaultEdit(editReq("plain.md", "New plain content"), deps);

		const written = deps.disk.readFileSync("/vault/plain.md", "utf-8");
		expect(written).toBe("New plain content");
	});
});

// ── vaultMove ───────────────────────────────────────────────────────

describe("vaultMove", () => {
	it("moves file to new location", () => {
		const deps = makeDeps({
			"/vault/old/note.md": "content here",
		});

		const result = vaultMove(
			moveReq("old/note.md", "new/note.md"),
			deps,
		);

		expect(result.fromPath).toBe("old/note.md");
		expect(result.toPath).toBe("new/note.md");
		expect(deps.disk.existsSync("/vault/new/note.md")).toBe(true);
		expect(deps.disk.existsSync("/vault/old/note.md")).toBe(false);
	});

	it("throws when source does not exist", () => {
		const deps = makeDeps({});

		expect(() =>
			vaultMove(moveReq("missing.md", "dest.md"), deps),
		).toThrow("ENOENT");
	});

	it("throws when target already exists", () => {
		const deps = makeDeps({
			"/vault/source.md": "source",
			"/vault/target.md": "target",
		});

		expect(() =>
			vaultMove(moveReq("source.md", "target.md"), deps),
		).toThrow("already exists");
	});
});

// ── vaultLink ───────────────────────────────────────────────────────

describe("vaultLink", () => {
	it("adds wikilinks to Related section", () => {
		const deps = makeDeps({
			"/vault/note.md": "Some content here",
		});

		const result = vaultLink(
			linkReq("note.md", { addLinks: ["Target A", "Target B"] }),
			deps,
		);

		expect(result.path).toBe("note.md");
		expect(result.links).toContain("Target A");
		expect(result.links).toContain("Target B");

		const written = deps.disk.readFileSync("/vault/note.md", "utf-8");
		expect(written).toContain("## Related");
		expect(written).toContain("- [[Target A]]");
		expect(written).toContain("- [[Target B]]");
	});

	it("removes wikilinks from content", () => {
		const deps = makeDeps({
			"/vault/note.md":
				"See [[Remove Me]] and [[Keep Me]] for details",
		});

		const result = vaultLink(
			linkReq("note.md", { removeLinks: ["Remove Me"] }),
			deps,
		);

		expect(result.links).toContain("Keep Me");
		expect(result.links).not.toContain("Remove Me");

		const written = deps.disk.readFileSync("/vault/note.md", "utf-8");
		expect(written).not.toContain("[[Remove Me]]");
		expect(written).toContain("[[Keep Me]]");
	});

	it("throws when file does not exist", () => {
		const deps = makeDeps({});

		expect(() =>
			vaultLink(linkReq("missing.md", { addLinks: ["Target"] }), deps),
		).toThrow("ENOENT");
	});

	it("appends to existing Related section", () => {
		const deps = makeDeps({
			"/vault/note.md":
				"Content\n\n## Related\n- [[Existing Link]]",
		});

		const result = vaultLink(
			linkReq("note.md", { addLinks: ["New Link"] }),
			deps,
		);

		expect(result.links).toContain("Existing Link");
		expect(result.links).toContain("New Link");
	});

	it("handles links with special regex characters", () => {
		const deps = makeDeps({
			"/vault/note.md": "See [[File (v2.0)]] here",
		});

		const result = vaultLink(
			linkReq("note.md", { removeLinks: ["File (v2.0)"] }),
			deps,
		);

		expect(result.links).not.toContain("File (v2.0)");
	});
});
