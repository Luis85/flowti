/**
 * vault-ops.ts — Pure vault operation functions.
 *
 * Each function receives a typed request + VaultOpsDeps, returns
 * operation-specific data. No trust/staging awareness — callers
 * decide whether to execute directly or route through trust.
 */

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import type {
	VaultOpsDeps,
	VaultReadRequest,
	VaultSearchRequest,
	VaultTagRequest,
	VaultCreateRequest,
	VaultEditRequest,
	VaultMoveRequest,
	VaultLinkRequest,
} from "./vault-ops-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Operations ──────────────────────────────────────────────────────

export function vaultRead(
	req: VaultReadRequest,
	deps: VaultOpsDeps,
): { content: string; frontmatter: Record<string, unknown> } {
	const absPath = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(absPath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(raw);
	return { content: body, frontmatter };
}

export function vaultSearch(
	req: VaultSearchRequest,
	deps: VaultOpsDeps,
): { matches: Array<{ path: string; tags: string[] }> } {
	const searchRoot = req.query.folder
		? deps.paths.join(deps.vaultRoot, req.query.folder)
		: deps.vaultRoot;

	const entries = deps.disk.readdirSync(searchRoot, {
		withFileTypes: true,
		recursive: true,
	});

	const matches: Array<{ path: string; tags: string[] }> = [];

	for (const entry of entries) {
		const name = typeof entry === "string" ? entry : (entry as { name: string }).name;
		if (!name.endsWith(".md")) continue;

		const absPath = deps.paths.join(searchRoot, name);
		let raw: string;
		try {
			raw = deps.disk.readFileSync(absPath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter } = parseFrontmatter(raw);
		const tags: string[] = Array.isArray(frontmatter["tags"])
			? (frontmatter["tags"] as string[])
			: [];

		const matchesTags = req.query.tags
			? req.query.tags.some((t) => tags.includes(t))
			: true;

		const matchesPattern = req.query.pattern
			? new RegExp(req.query.pattern).test(raw)
			: true;

		if (matchesTags && matchesPattern) {
			const relPath = deps.paths.relative(deps.vaultRoot, absPath);
			matches.push({ path: relPath, tags });
		}
	}

	return { matches };
}

export function vaultTag(
	req: VaultTagRequest,
	deps: VaultOpsDeps,
): { path: string; tags: string[] } {
	const absPath = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(absPath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(raw);

	let tags: string[] = Array.isArray(frontmatter["tags"])
		? [...(frontmatter["tags"] as string[])]
		: [];

	if (req.addTags) {
		for (const tag of req.addTags) {
			if (!tags.includes(tag)) {
				tags.push(tag);
			}
		}
	}

	if (req.removeTags) {
		tags = tags.filter((t) => !req.removeTags!.includes(t));
	}

	const updated = { ...frontmatter, tags };
	const content = serializeFrontmatter(updated, body);
	deps.disk.writeFileSync(absPath, content);

	return { path: req.path, tags };
}

export function vaultCreate(
	req: VaultCreateRequest,
	deps: VaultOpsDeps,
): { path: string } {
	const absPath = deps.paths.join(deps.vaultRoot, req.path);

	if (deps.disk.existsSync(absPath)) {
		throw new Error("File already exists");
	}

	const parentDir = deps.paths.dirname(absPath);
	deps.disk.mkdirSync(parentDir, { recursive: true });

	if (req.frontmatter) {
		const content = serializeFrontmatter(req.frontmatter, req.body ?? "");
		deps.disk.writeFileSync(absPath, content);
	} else {
		deps.disk.writeFileSync(absPath, req.body ?? "");
	}

	return { path: req.path };
}

export function vaultEdit(
	req: VaultEditRequest,
	deps: VaultOpsDeps,
): { path: string } {
	const absPath = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(absPath, "utf-8");
	const { frontmatter, body: _body } = parseFrontmatter(raw);

	const hasFrontmatter = Object.keys(frontmatter).length > 0;
	if (hasFrontmatter) {
		const content = serializeFrontmatter(frontmatter, req.content);
		deps.disk.writeFileSync(absPath, content);
	} else {
		deps.disk.writeFileSync(absPath, req.content);
	}

	return { path: req.path };
}

export function vaultMove(
	req: VaultMoveRequest,
	deps: VaultOpsDeps,
): { fromPath: string; toPath: string } {
	const absSrc = deps.paths.join(deps.vaultRoot, req.fromPath);
	const absDst = deps.paths.join(deps.vaultRoot, req.toPath);

	if (!deps.disk.existsSync(absSrc)) {
		throw new Error(`ENOENT: ${req.fromPath}`);
	}

	if (deps.disk.existsSync(absDst)) {
		throw new Error(`File already exists: ${req.toPath}`);
	}

	const parentDir = deps.paths.dirname(absDst);
	deps.disk.mkdirSync(parentDir, { recursive: true });
	deps.disk.renameSync(absSrc, absDst);

	return { fromPath: req.fromPath, toPath: req.toPath };
}

export function vaultLink(
	req: VaultLinkRequest,
	deps: VaultOpsDeps,
): { path: string; links: string[] } {
	const absPath = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(absPath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(raw);

	let updatedBody = body;

	// Remove links
	if (req.removeLinks) {
		for (const target of req.removeLinks) {
			const pattern = new RegExp(
				`\\[\\[${escapeRegex(target)}\\]\\]`,
				"g",
			);
			updatedBody = updatedBody.replace(pattern, "");
		}
		// Clean up empty list items left behind
		updatedBody = updatedBody.replace(/^- \s*$/gm, "");
		// Clean up consecutive blank lines
		updatedBody = updatedBody.replace(/\n{3,}/g, "\n\n");
	}

	// Add links
	if (req.addLinks && req.addLinks.length > 0) {
		const relatedHeader = "## Related";
		const hasRelated = updatedBody.includes(relatedHeader);

		if (hasRelated) {
			const linksText = req.addLinks
				.map((l) => `- [[${l}]]`)
				.join("\n");
			updatedBody = updatedBody.replace(
				relatedHeader,
				`${relatedHeader}\n${linksText}`,
			);
		} else {
			const linksText = req.addLinks
				.map((l) => `- [[${l}]]`)
				.join("\n");
			updatedBody = `${updatedBody}\n\n## Related\n${linksText}`;
		}
	}

	// Write back
	const hasFrontmatter = Object.keys(frontmatter).length > 0;
	const finalContent = hasFrontmatter
		? serializeFrontmatter(frontmatter, updatedBody)
		: updatedBody;
	deps.disk.writeFileSync(absPath, finalContent);

	// Collect all [[...]] links from in-memory content
	const linkRegex = /\[\[([^\]]+)\]\]/g;
	const links: string[] = [];
	let match = linkRegex.exec(finalContent);
	while (match !== null) {
		links.push(match[1]);
		match = linkRegex.exec(finalContent);
	}

	return { path: req.path, links };
}
