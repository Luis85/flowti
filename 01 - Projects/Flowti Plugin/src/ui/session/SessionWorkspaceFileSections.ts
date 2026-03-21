/**
 * File section renderers for SessionWorkspaceView.
 * Extracted to reduce SessionWorkspaceView.ts line count.
 */

import { setIcon } from "obsidian";
import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { Session } from "../../domain/session/types";
import { generateSessionSummary } from "../../domain/session/helpers";
import type { SessionService } from "../../domain/session/SessionService";
import type { WorkspaceHelperContext } from "./SessionWorkspaceHelpers";
import { openInAdjacentLeaf } from "./SessionWorkspaceHelpers";

export function renderFocusFile(
	container: HTMLElement,
	session: Session,
	ctx: WorkspaceHelperContext,
): void {
	if (!session.focusFile || session.focusFile === session.notesFile) return;

	const section = container.createDiv({ cls: "ft-session-workspace-focus ft-section" });

	const iconEl = section.createSpan();
	setIcon(iconEl, "file-text");

	section.createEl("span", { text: "Focus:", cls: "ft-session-file-label" });

	const link = section.createEl("a", { text: session.focusFile, cls: "ft-focus-link ft-session-file-link" });
	link.addEventListener("click", (e) => {
		e.preventDefault();
		openInAdjacentLeaf(ctx, session.focusFile!);
	});
}

export function renderNotesFile(
	container: HTMLElement,
	session: Session,
	app: App,
	eventBus: IEventBus,
	sessionService: SessionService,
	ctx: WorkspaceHelperContext,
): void {
	if (!session.notesFile) return;

	const section = container.createDiv({ cls: "ft-session-workspace-notesfile ft-section" });

	const iconEl = section.createSpan();
	setIcon(iconEl, "file-text");

	section.createEl("span", { text: "Session note:", cls: "ft-session-file-label" });

	const name = session.notesFile.split("/").pop() ?? session.notesFile;
	const link = section.createEl("a", { text: name, cls: "ft-notesfile-link ft-session-file-link" });
	link.title = session.notesFile;
	link.addEventListener("click", (e) => {
		e.preventDefault();
		void openOrCreateNotesFile(app, session, sessionService, ctx);
	});

	const copyBtn = section.createEl("button", { cls: "ft-copy-path-btn clickable-icon" });
	copyBtn.title = "Copy vault path to clipboard";
	setIcon(copyBtn, "clipboard-copy");
	copyBtn.addEventListener("click", () => {
		void navigator.clipboard.writeText(session.notesFile!).then(() => {
			setIcon(copyBtn, "check");
			copyBtn.addClass("ft-copied");
			setTimeout(() => {
				setIcon(copyBtn, "clipboard-copy");
				copyBtn.removeClass("ft-copied");
			}, 1500);
		});
	});
}

async function openOrCreateNotesFile(
	app: App,
	session: Session,
	sessionService: SessionService,
	ctx: WorkspaceHelperContext,
): Promise<void> {
	const path = session.notesFile!;
	const exists = app.vault.getAbstractFileByPath(path);

	if (!exists) {
		const folder = path.substring(0, path.lastIndexOf("/"));
		if (folder && !app.vault.getAbstractFileByPath(folder)) {
			await app.vault.createFolder(folder);
		}
		try {
			await app.vault.create(path, generateSessionSummary(session, sessionService.globalActivityFilter));
		} catch {
			// File already exists on disk — proceed to open
		}
	}

	openInAdjacentLeaf(ctx, path);
}

export function renderCanvasFile(
	container: HTMLElement,
	session: Session,
	app: App,
	eventBus: IEventBus,
	ctx: WorkspaceHelperContext,
): void {
	const section = container.createDiv({ cls: "ft-session-workspace-canvas ft-section" });

	if (session.canvasFile) {
		const iconEl = section.createSpan();
		setIcon(iconEl, "layout-dashboard");

		section.createEl("span", { text: "Session canvas:", cls: "ft-session-file-label" });

		const name = session.canvasFile.split("/").pop() ?? session.canvasFile;
		const link = section.createEl("a", { text: name, cls: "ft-canvasfile-link ft-session-file-link" });
		link.title = session.canvasFile;
		link.addEventListener("click", (e) => {
			e.preventDefault();
			openInAdjacentLeaf(ctx, session.canvasFile!);
		});
	} else {
		const btn = section.createEl("button", { text: "Create session canvas", cls: "ft-canvasfile-create ft-session-action-btn" });
		const iconEl = btn.createSpan();
		setIcon(iconEl, "layout-dashboard");
		btn.prepend(iconEl);
		btn.addEventListener("click", () => {
			btn.setText("Creating...");
			btn.disabled = true;
			void createAndLinkCanvas(app, session, eventBus, ctx);
		});
	}
}

async function createAndLinkCanvas(
	app: App,
	session: Session,
	eventBus: IEventBus,
	ctx: WorkspaceHelperContext,
): Promise<void> {
	const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
	const shortId = session.id.slice(-6);
	const folder = session.notesFile
		? session.notesFile.substring(0, session.notesFile.lastIndexOf("/"))
		: "03 - Resources/Sessions";
	const path = `${folder}/${safeName} (${shortId}).canvas`;

	const exists = app.vault.getAbstractFileByPath(path);
	if (!exists) {
		if (folder && !app.vault.getAbstractFileByPath(folder)) {
			await app.vault.createFolder(folder);
		}
		try {
			await app.vault.create(path, '{\n\t"nodes":[],\n\t"edges":[]\n}');
		} catch {
			// File already exists on disk — proceed to open
		}
	}

	void eventBus.emit("session.canvasFile.set", { sessionId: session.id, path });
	void eventBus.emit("notice.success", { message: `Canvas created: ${path.split("/").pop()}` });

	if (session.notesFile) {
		await appendCanvasLinkToNotes(app, session, session.notesFile, path);
	}

	openInAdjacentLeaf(ctx, path);
}

async function appendCanvasLinkToNotes(
	app: App,
	session: Session,
	notesPath: string,
	canvasPath: string,
): Promise<void> {
	let file = app.vault.getAbstractFileByPath(notesPath);
	if (!file) {
		const folder = notesPath.substring(0, notesPath.lastIndexOf("/"));
		if (folder && !app.vault.getAbstractFileByPath(folder)) {
			await app.vault.createFolder(folder);
		}
		try {
			const title = session.title ?? "Session";
			await app.vault.create(notesPath, `# ${title}\n\n## Canvas\n![[${canvasPath}]]\n`);
			return;
		} catch (err: unknown) {
			file = app.vault.getAbstractFileByPath(notesPath);
			if (!file) {
				console.warn("[Flowti] Failed to create notes file:", err instanceof Error ? err.message : err);
				return;
			}
		}
	}
	const existing = await app.vault.read(file as import("obsidian").TFile);
	const embed = `![[${canvasPath}]]`;
	if (!existing.includes(embed)) {
		await app.vault.modify(file as import("obsidian").TFile, existing + `\n## Canvas\n${embed}\n`);
	}
}
