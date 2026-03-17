/**
 * Session UI wiring — commands, view factories, file-menu items,
 * and session summary writers.
 *
 * Extracted from main.ts to reduce its LOC (TD-05).
 */

import { TFile, TFolder } from "obsidian";
import type { App, Command, EventRef, ViewCreator } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { IErrorService } from "../infrastructure/errors/types";
import type { SessionService } from "../domain/session/SessionService";
import type { TrainService } from "../domain/train/TrainService";
import type { Session } from "../domain/session/types";
import { SESSION_TYPES, type SessionType } from "../domain/session/types";

/** Session types available in NewSessionModal (excludes specialized types with their own creation flow). */
const MODAL_SESSION_TYPES = SESSION_TYPES.filter(
	(st) => st.type !== "train-of-thought" && st.type !== "canvas-session",
);
import { generateSessionSummary, mergeSessionNotes } from "../domain/session/helpers";
import { NewSessionModal } from "../ui/modals";
import { SessionWorkspaceView, VIEW_TYPE_SESSION_WORKSPACE } from "../ui/session/SessionWorkspaceView";

/** Terminal session statuses where "Add to" context menu should be hidden for train sessions. */
const TERMINAL_STATUSES = new Set(["completed", "reviewing", "archived"]);

/**
 * Determine whether the "Add to {session}" context menu item should be shown.
 * Returns false for completed train sessions (train can't accept new thoughts).
 */
export function shouldShowAddToSession(session: { type: string; status: string } | null): boolean {
	if (!session) return false;
	if (session.type === "train-of-thought" && TERMINAL_STATUSES.has(session.status)) return false;
	return true;
}

export interface SessionSetupDeps {
	app: App;
	eventBus: IEventBus;
	errorService: IErrorService;
	sessionService: SessionService;
	trainService?: TrainService;
	registerView: (type: string, factory: ViewCreator) => void;
	registerEvent: (ref: EventRef) => void;
	addCommand: (command: Command) => void;
}

export class SessionSetup {
	constructor(private deps: SessionSetupDeps) {}

	/** Register the Session Workspace view factory. */
	registerViews(): void {
		const { eventBus, sessionService, trainService, registerView } = this.deps;

		registerView(VIEW_TYPE_SESSION_WORKSPACE, (leaf) => {
			const view = new SessionWorkspaceView(leaf, eventBus, sessionService);
			if (trainService) view.trainService = trainService;
			return view;
		});
	}

	/** Register session commands for the command palette. */
	registerCommands(): void {
		const { addCommand, sessionService } = this.deps;

		// Workspace commands — only visible when a session is active
		addCommand({
			id: "flowti:open-session-workspace",
			name: "Open session workspace",
			icon: "timer",
			checkCallback: (checking) => {
				if (!sessionService.getActiveSession()) return false;
				if (!checking) {
					void this.deps.app.workspace.getLeaf("tab").setViewState({
						type: VIEW_TYPE_SESSION_WORKSPACE,
						active: true,
					});
				}
				return true;
			},
		});

		addCommand({
			id: "flowti:open-session-workspace-sidebar",
			name: "Open session workspace in sidebar",
			icon: "panel-right",
			checkCallback: (checking) => {
				if (!sessionService.getActiveSession()) return false;
				if (!checking) this.openSessionWorkspaceInSidebar();
				return true;
			},
		});

		// Create — always available
		addCommand({
			id: "flowti:create-session",
			name: "Create new session",
			icon: "timer",
			callback: () => {
				new NewSessionModal(this.deps.app, {
					sessionTypes: MODAL_SESSION_TYPES,
					templates: sessionService?.getSavedTemplates() ?? [],
					onSubmit: (title, type, durationMinutes, focusFile, goals, extra) => {
						void this.deps.eventBus.emit("session.create", {
							type: type as SessionType,
							title,
							durationMinutes,
							focusFile: focusFile ?? undefined,
							goals: goals.length > 0 ? goals : undefined,
							...extra,
						});
					},
				}).open();
			},
		});

		// Resume — only visible when a session is paused
		addCommand({
			id: "flowti:resume-session",
			name: "Resume paused session",
			icon: "play",
			checkCallback: (checking) => {
				const session = sessionService?.getActiveSession();
				if (!session || session.status !== "paused") return false;
				if (!checking) {
					void this.deps.eventBus.emit("session.resume", { sessionId: session.id });
					void this.deps.eventBus.emit("notice.success", { message: `Resumed "${session.title}"` });
				}
				return true;
			},
		});
	}

	/** Register file-menu items for session context binding and new session creation. */
	registerFileMenuItems(): void {
		const { app, eventBus, sessionService, registerEvent } = this.deps;

		registerEvent(
			app.workspace.on("file-menu", (menu, file) => {
				const isFile = file instanceof TFile;
				const isFolder = file instanceof TFolder;
				if (!isFile && !isFolder) return;

				menu.addSeparator();

				// "Add to {session title}" — when any session is current
				// Skip for completed train sessions (train can't accept new thoughts)
				const current = sessionService?.getCurrentSession();
				if (current && shouldShowAddToSession(current)) {
					const bindType = isFolder ? "folder" as const : "file" as const;
					const bindPath = isFolder ? file.path + "/" : file.path;
					const label = file instanceof TFile ? file.basename : file.name;
					menu.addItem((item) => {
						item.setTitle(`Add to "${current.title}"`)
							.setIcon("link")
							.onClick(() => {
								void eventBus.emit("session.context.bind", {
									sessionId: current.id,
									path: bindPath,
									type: bindType,
								});
								void eventBus.emit("notice.success", { message: `Added "${label}" to "${current.title}"` });
							});
					});
				}

				if (isFile) {
					menu.addItem((item) => {
						item.setTitle("Create new session")
							.setIcon("timer")
							.onClick(() => {
								new NewSessionModal(app, {
									sessionTypes: MODAL_SESSION_TYPES,
									templates: sessionService?.getSavedTemplates() ?? [],
									prefill: { title: "", type: MODAL_SESSION_TYPES[0].type, durationMinutes: 25, focusFile: file.path },
									onSubmit: (title, type, durationMinutes, focusFile, goals, extra) => {
										void eventBus.emit("session.create", {
											type: type as SessionType,
											title,
											durationMinutes,
											focusFile: focusFile ?? undefined,
											goals: goals.length > 0 ? goals : undefined,
											...extra,
										});
									},
								}).open();
							});
					});

					// "Start new Train from this file" — always available for .md files
					if (file.extension === "md") {
						menu.addItem((item) => {
							item.setTitle("Start new train from this file")
								.setIcon("train-front")
								.onClick(() => {
									void eventBus.emit("ui.startTrain", { fromFilePath: file.path });
								});
						});
					}
				}

				menu.addSeparator();
			}),
		);
	}

	/**
	 * Opens the Session Workspace in the right sidebar.
	 * Reuses an existing sidebar leaf if one exists; otherwise creates one.
	 * Always reveals the leaf so the sidebar opens if collapsed.
	 */
	openSessionWorkspaceInSidebar(sessionId?: string): void {
		if (sessionId) {
			this.deps.sessionService.workspaceSessionId = sessionId;
		}
		setTimeout(() => {
			const existing = this.deps.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
				.find((l) => l.getRoot() === this.deps.app.workspace.rightSplit);
			const leaf = existing ?? this.deps.app.workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
					state: sessionId ? { sessionId } : undefined,
				});
				void this.deps.app.workspace.revealLeaf(leaf);
			}
		}, 0);
	}

	/**
	 * Writes a Markdown summary to the session's notes file.
	 * Creates the folder and file if they don't exist yet.
	 */
	async writeSessionSummary(session: Session): Promise<void> {
		if (!session.notesFile) return;

		try {
			const { vault } = this.deps.app;
			const folder = session.notesFile.substring(0, session.notesFile.lastIndexOf("/"));
			if (folder && !vault.getAbstractFileByPath(folder)) {
				await vault.createFolder(folder);
			}

			const globalFilter = this.deps.sessionService.globalActivityFilter;
			const existing = vault.getAbstractFileByPath(session.notesFile);
			if (existing instanceof TFile) {
				const existingContent = await vault.read(existing);
				const merged = mergeSessionNotes(existingContent, session, globalFilter);
				await vault.modify(existing, merged);
			} else {
				const markdown = generateSessionSummary(session, globalFilter);
				await vault.create(session.notesFile, markdown);
			}
		} catch (error) {
			this.deps.errorService?.handle(
				error instanceof Error ? error : new Error(String(error)),
				"writeSessionSummary",
			);
		}
	}

}
