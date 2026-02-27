/**
 * Helper functions extracted from SessionWorkspaceView.
 *
 * Extracted to keep the main view under 450 LOC per TD-01.
 * Contains: workspace state capture/restore, modal openers,
 * leaf navigation, and status styling.
 */

import type { App, WorkspaceLeaf, TAbstractFile } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { Session, WorkspaceState, SessionOutputTemplate } from "../../domain/session/types";
import { SESSION_TYPE_LABELS } from "../userHub/types";
import { SaveTemplateModal } from "../modals";
import { SessionOutputPickerModal } from "./SessionOutputPickerModal";
import { VIEW_TYPE_SESSION_WORKSPACE } from "./types";

/** Narrow context needed by workspace helper functions. */
export interface WorkspaceHelperContext {
	app: App;
	eventBus: IEventBus;
	leaf: WorkspaceLeaf;
	getSession: () => Session | null;
	getAdjacentLeaf: () => WorkspaceLeaf | null;
	setAdjacentLeaf: (leaf: WorkspaceLeaf) => void;
	customOutputTemplates: readonly SessionOutputTemplate[];
	sessionService: {
		workspaceSessionId: string | null;
		saveTemplateFromSession(id: string, name: string): Promise<unknown>;
	};
}

/** Returns inline CSS for a session status badge. */
export function getStatusStyle(status: string): string {
	switch (status) {
		case "active":
		case "running": return "background:var(--color-green);color:var(--background-primary);";
		case "paused": return "background:var(--color-yellow);color:var(--background-primary);";
		case "reviewing": return "background:var(--color-orange);color:var(--background-primary);";
		case "completed": return "background:var(--color-blue);color:var(--background-primary);";
		default: return "background:var(--background-modifier-hover);";
	}
}

/** Returns the CSS modifier class for a session status (e.g. "running" → "running", unknown → "default"). */
export function getStatusClass(status: string): string {
	switch (status) {
		case "active":
		case "running":
		case "paused":
		case "reviewing":
		case "completed": return status;
		default: return "default";
	}
}

/** Captures the current workspace state (open files, active file). */
export async function captureWorkspaceState(ctx: WorkspaceHelperContext, sessionId: string): Promise<void> {
	const openFiles: string[] = [];
	let activeFile: string | null = null;

	ctx.app.workspace.iterateAllLeaves((leaf) => {
		const viewState = leaf.getViewState();
		const file = (viewState.state as Record<string, unknown>)?.file;
		if (typeof file === "string") {
			openFiles.push(file);
		}
	});

	const current = ctx.app.workspace.getActiveFile();
	if (current) {
		activeFile = current.path;
	}

	const state: WorkspaceState = { openFiles, activeFile, scrollPositions: {} };
	await ctx.eventBus.emit("session.state.saved", { sessionId, state });
}

/** Restores workspace state by reopening saved files. */
export async function restoreWorkspaceState(
	ctx: WorkspaceHelperContext,
	sessionId: string,
	state: WorkspaceState,
): Promise<void> {
	for (const filePath of state.openFiles) {
		const exists = ctx.app.vault.getAbstractFileByPath(filePath);
		if (exists) {
			await ctx.app.workspace.openLinkText(filePath, "", false);
		}
	}

	if (state.activeFile) {
		const exists = ctx.app.vault.getAbstractFileByPath(state.activeFile);
		if (exists) {
			await ctx.app.workspace.openLinkText(state.activeFile, "", false);
		}
	}

	await ctx.eventBus.emit("session.state.restored", { sessionId });
}

/** Opens the output template picker modal. */
export function openOutputPicker(ctx: WorkspaceHelperContext): void {
	const session = ctx.getSession();
	if (!session) return;
	const sessionId = session.id;
	new SessionOutputPickerModal(ctx.app, {
		customTemplates: ctx.customOutputTemplates,
		onSelect: (template) => {
			void ctx.eventBus.emit("session.output.generate", { sessionId, template });
		},
	}).open();
}

/** Opens the save-as-template modal. */
export function openSaveTemplateModal(ctx: WorkspaceHelperContext, session: Session): void {
	new SaveTemplateModal(ctx.app, {
		sessionTitle: session.title,
		sessionType: SESSION_TYPE_LABELS[session.type] ?? session.type,
		sessionDuration: session.durationMinutes,
		onSubmit: (name) => {
			void ctx.sessionService.saveTemplateFromSession(session.id, name);
		},
	}).open();
}

/** Opens the session workspace in a new tab. */
export function openInTab(ctx: WorkspaceHelperContext): void {
	const session = ctx.getSession();
	if (!session) return;
	const sessionId = session.id;
	ctx.sessionService.workspaceSessionId = sessionId;
	void ctx.app.workspace.getLeaf("tab").setViewState({
		type: VIEW_TYPE_SESSION_WORKSPACE,
		active: true,
		state: { sessionId },
	});
}

/** Opens the session workspace in the right sidebar. */
export function openInSidebar(ctx: WorkspaceHelperContext): void {
	const session = ctx.getSession();
	if (!session) return;
	const sessionId = session.id;
	ctx.sessionService.workspaceSessionId = sessionId;
	setTimeout(() => {
		const existing = ctx.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
			.find((l) => l.getRoot() === ctx.app.workspace.rightSplit);
		const leaf = existing ?? ctx.app.workspace.getRightLeaf(false);
		if (leaf) {
			void leaf.setViewState({ type: VIEW_TYPE_SESSION_WORKSPACE, active: true, state: { sessionId } });
			void ctx.app.workspace.revealLeaf(leaf);
		}
	}, 0);
}

/** Reveals a folder in the file explorer pane. */
export function revealInFileExplorer(ctx: WorkspaceHelperContext, path: string): void {
	const cleanPath = path.replace(/\/$/, "");
	const folder = ctx.app.vault.getAbstractFileByPath(cleanPath);
	if (!folder) return;

	const explorers = ctx.app.workspace.getLeavesOfType("file-explorer");
	if (explorers.length > 0) {
		(explorers[0].view as unknown as { revealInFolder: (f: TAbstractFile) => void }).revealInFolder(folder);
		void ctx.app.workspace.revealLeaf(explorers[0]);
	}
}

/** Opens a file in an adjacent split leaf, reusing the tracked leaf if still attached. */
export function openInAdjacentLeaf(ctx: WorkspaceHelperContext, path: string): void {
	let adjacent = ctx.getAdjacentLeaf();
	if (!adjacent || !adjacent.parent) {
		adjacent = ctx.app.workspace.getLeaf("split");
		ctx.setAdjacentLeaf(adjacent);
	}
	const target = adjacent;
	ctx.app.workspace.setActiveLeaf(target, { focus: true });
	void ctx.app.workspace.openLinkText(path, "", false).then(() => {
		if (target.parent) ctx.app.workspace.setActiveLeaf(target, { focus: true });
	});
}
