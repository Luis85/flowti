/**
 * git-url.ts — Pure domain: normalize git URLs from any host.
 *
 * Handles GitHub, GitLab, Bitbucket, Azure DevOps, and generic URLs.
 * Strips UI-only paths (tree, blob, branches) and query params.
 */

export function normalizeGitUrl(raw: string): string {
	const url = raw.trim();
	if (!url) return "";

	// SSH URLs — pass through
	if (url.startsWith("git@")) return url;

	let parsed: URL;
	try { parsed = new URL(url); } catch { return url; }

	// Strip query params
	parsed.search = "";
	parsed.hash = "";

	const host = parsed.hostname.toLowerCase();

	// Azure DevOps — legacy visualstudio.com conversion
	const vsMatch = host.match(/^(.+)\.visualstudio\.com$/);
	if (vsMatch) {
		const org = vsMatch[1];
		const pathParts = parsed.pathname.split("/").filter(Boolean);
		if (pathParts.length >= 3 && pathParts[1] === "_git") {
			return `https://dev.azure.com/${org}/${pathParts[0]}/_git/${pathParts[2]}`;
		}
	}

	// Azure DevOps — pass through (already clean after query strip)
	if (host === "dev.azure.com") {
		return parsed.toString();
	}

	const path = parsed.pathname;

	// GitHub: strip /tree/..., /blob/..., /branches, etc.
	if (host === "github.com") {
		const repoMatch = path.match(/^\/([^/]+\/[^/]+)/);
		if (repoMatch) {
			const repoPath = repoMatch[1].replace(/\.git$/, "");
			return `https://github.com/${repoPath}.git`;
		}
	}

	// GitLab: strip /-/tree/..., /-/blob/..., etc.
	if (host === "gitlab.com" || host.includes("gitlab")) {
		const repoMatch = path.match(/^\/([^/]+\/[^/]+)/);
		if (repoMatch) {
			const repoPath = repoMatch[1].replace(/\.git$/, "");
			return `${parsed.origin}/${repoPath}.git`;
		}
	}

	// Bitbucket: strip /src/..., /branches, etc.
	if (host === "bitbucket.org") {
		const repoMatch = path.match(/^\/([^/]+\/[^/]+)/);
		if (repoMatch) {
			const repoPath = repoMatch[1].replace(/\.git$/, "");
			return `https://bitbucket.org/${repoPath}.git`;
		}
	}

	// Generic: pass through
	return parsed.toString();
}

export function extractRepoName(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return "";

	// SSH: git@host:user/repo.git
	const sshMatch = trimmed.match(/\/([^/]+?)(?:\.git)?$/);
	if (trimmed.startsWith("git@") && sshMatch) return sshMatch[1];

	// Azure DevOps: .../_git/repo
	const azureMatch = trimmed.match(/\/_git\/([^/?]+)/);
	if (azureMatch) return azureMatch[1];

	// HTTPS: last path segment, strip .git
	try {
		const parsed = new URL(trimmed);
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length >= 2) {
			return segments[1].replace(/\.git$/, "");
		}
	} catch {
		// Fall through
	}

	return "";
}
