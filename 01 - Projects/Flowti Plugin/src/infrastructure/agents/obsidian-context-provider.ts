/**
 * Obsidian-based IContextProvider — tracks active file, computes content diffs.
 * Uses workspace.on("file-open") and vault.cachedRead() for content.
 */

import type { Workspace, Vault, EventRef } from "obsidian";
import type { IContextProvider, FileContext, FileDiff } from "../../domain/agents/context-provider.js";

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return hash.toString(36);
}

function simpleDiff(prev: string, curr: string): string {
	const prevLines = prev.split("\n");
	const currLines = curr.split("\n");
	const lines: string[] = [];
	const maxLen = Math.max(prevLines.length, currLines.length);
	for (let i = 0; i < maxLen; i++) {
		const p = prevLines[i];
		const c = currLines[i];
		if (p === c) continue;
		if (p !== undefined && c === undefined) lines.push(`-${p}`);
		else if (p === undefined && c !== undefined) lines.push(`+${c}`);
		else if (p !== c) { lines.push(`-${p}`); lines.push(`+${c}`); }
	}
	return lines.join("\n");
}

export class ObsidianContextProvider implements IContextProvider {
	private workspace: Workspace;
	private vault: Vault;
	private currentContext: FileContext | null = null;
	private previousContents = new Map<string, { hash: string; content: string }>();
	private subscribers = new Set<(ctx: FileContext) => void>();
	private eventRefs: EventRef[] = [];
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(workspace: Workspace, vault: Vault) {
		this.workspace = workspace;
		this.vault = vault;

		const fileOpenRef = this.workspace.on("file-open", () => {
			this.debounceRefresh();
		});
		this.eventRefs.push(fileOpenRef);
	}

	getActiveFileContext(): FileContext | null {
		return this.currentContext;
	}

	getDiff(sinceHash: string): FileDiff | null {
		if (!this.currentContext) return null;
		if (this.currentContext.contentHash === sinceHash) return null;

		const prev = this.previousContents.get(sinceHash);
		if (!prev) return null;

		const diff = simpleDiff(prev.content, this.currentContext.content);
		return {
			path: this.currentContext.path,
			previousHash: sinceHash,
			currentHash: this.currentContext.contentHash,
			diff,
		};
	}

	onFileChanged(callback: (ctx: FileContext) => void): () => void {
		this.subscribers.add(callback);
		return () => { this.subscribers.delete(callback); };
	}

	async refreshContext(): Promise<void> {
		const file = this.workspace.getActiveFile();
		if (!file) {
			this.currentContext = null;
			return;
		}

		const content = await this.vault.cachedRead(file);
		const hash = simpleHash(content);

		if (this.currentContext) {
			this.previousContents.set(this.currentContext.contentHash, {
				hash: this.currentContext.contentHash,
				content: this.currentContext.content,
			});
		}

		this.currentContext = { path: file.path, contentHash: hash, content };

		for (const cb of this.subscribers) {
			try { cb(this.currentContext); } catch { /* subscriber error */ }
		}
	}

	dispose(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		for (const ref of this.eventRefs) {
			this.workspace.offref(ref);
		}
		this.eventRefs = [];
		this.subscribers.clear();
		this.previousContents.clear();
	}

	private debounceRefresh(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => void this.refreshContext(), 2000);
	}
}
