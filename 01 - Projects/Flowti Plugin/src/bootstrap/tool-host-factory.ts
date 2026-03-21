/**
 * Factory for creating a ToolHost implementation backed by the live Obsidian App.
 *
 * Extracted from main.ts to reduce its LOC.
 */

import { type App, TFile } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { ToolHost } from "../domain/journeyExecutor/types.js";
import type { RequestId } from "../infrastructure/events/events.js";

export function createToolHost(app: App, eventBus: IEventBus): ToolHost {
	return {
		executeCommand: (id) => (app as unknown as { commands: { executeCommandById: (id: string) => boolean } }).commands.executeCommandById(id),
		querySelector: (sel) => document.querySelector(sel),
		querySelectorAll: (sel) => document.querySelectorAll(sel),
		createFile: async (path, content) => { await app.vault.create(path, content); },
		deleteFile: async (path) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (file) await app.fileManager.trashFile(file);
		},
		readFile: async (path) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error(`File not found: ${path}`);
			return app.vault.read(file);
		},
		moveFile: async (from, to) => {
			const file = app.vault.getAbstractFileByPath(from);
			if (file) await app.vault.rename(file, to);
		},
		copyFile: async (from, to) => {
			const file = app.vault.getAbstractFileByPath(from);
			if (file instanceof TFile) await app.vault.copy(file, to);
		},
		openFile: async (path) => { await app.workspace.openLinkText(path, "", false); },
		openUrl: (url) => { window.open(url); },
		showNotice: (msg, dur) => { void eventBus.emit("notice.show", { message: msg, duration: dur }); },
		setTheme: () => { /* theme switching deferred to Inc 8 */ },
		closeLeaves: (viewType) => { if (viewType) app.workspace.detachLeavesOfType(viewType); },
		closeModals: () => { document.querySelectorAll(".modal-container").forEach((el) => el.remove()); },
		clickRibbon: (label) => {
			const btn = document.querySelector(`[aria-label*="${label}"]`) as HTMLElement | null;
			btn?.click();
			return !!btn;
		},
		scrollTo: (sel, behavior, block) => {
			const el = document.querySelector(sel);
			if (!el) return false;
			el.scrollIntoView({ behavior: (behavior ?? "smooth") as ScrollBehavior, block: (block ?? "center") as ScrollLogicalPosition });
			return true;
		},
		getFrontmatter: (path) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return undefined;
			return app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		},
		updateFrontmatter: async (path, data) => {
			void eventBus.emit("frontmatter.update.request", { requestId: `exec-${Date.now()}` as RequestId, path, data });
		},
		getEventTrace: () => [],
		showSpinner: () => { /* wired in Inc 8 */ },
		hideSpinner: () => { /* wired in Inc 8 */ },
		writeRunLog: async (path, content) => {
			const existing = app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				const prev = await app.vault.read(existing);
				await app.vault.modify(existing, prev + "\n" + content);
			} else {
				await app.vault.create(path, content);
			}
		},
		seed: async () => { /* seed logic deferred */ },
	};
}
