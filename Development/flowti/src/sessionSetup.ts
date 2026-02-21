/**
 * Session UI wiring — commands, view factories, file-menu items,
 * and session summary writers.
 *
 * Extracted from main.ts to reduce its LOC (TD-05).
 */

import { Notice, TFile, TFolder } from "obsidian";
import type { App, Command, EventRef, ViewCreator } from "obsidian";
import type { IEventBus } from "./infrastructure/events/types";
import type { IErrorService } from "./infrastructure/errors/types";
import type { SessionService } from "./domain/session/SessionService";
import type { Session } from "./domain/session/types";
import { SESSION_TYPES, type SessionType } from "./domain/session/types";
import { generateSessionSummary, mergeSessionNotes } from "./domain/session/helpers";
import { NewSessionModal } from "./ui/modals";
import { SessionWorkspaceView, VIEW_TYPE_SESSION_WORKSPACE } from "./ui/SessionWorkspaceView";

export interface SessionSetupDeps {
	app: App;
	eventBus: IEventBus;
	errorService: IErrorService;
	sessionService: SessionService;
	registerView: (type: string, factory: ViewCreator) => void;
	registerEvent: (ref: EventRef) => void;
	addCommand: (command: Command) => void;
}

export class SessionSetup {
	constructor(private deps: SessionSetupDeps) {}

	/** Register the Session Workspace view factory. */
	registerViews(): void {
		const { eventBus, sessionService, registerView } = this.deps;

		registerView(VIEW_TYPE_SESSION_WORKSPACE, (leaf) =>
			new SessionWorkspaceView(leaf, eventBus, sessionService),
		);
	}

	/** Register session commands for the command palette. */
	registerCommands(): void {
		const { addCommand } = this.deps;

		addCommand({
			id: "flowti:open-session-workspace",
			name: "Open Session Workspace",
			icon: "timer",
			callback: () => {
				void this.deps.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
				});
			},
		});

		addCommand({
			id: "flowti:open-session-workspace-sidebar",
			name: "Open Session Workspace in Sidebar",
			icon: "panel-right",
			callback: () => {
				this.openSessionWorkspaceInSidebar();
			},
		});

		addCommand({
			id: "flowti:create-session",
			name: "Create New Session",
			icon: "timer",
			callback: () => {
				new NewSessionModal(this.deps.app, {
					sessionTypes: SESSION_TYPES,
					templates: this.deps.sessionService?.getSavedTemplates() ?? [],
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

		addCommand({
			id: "flowti:resume-session",
			name: "Resume Paused Session",
			icon: "play",
			callback: () => {
				const session = this.deps.sessionService?.getActiveSession();
				if (session && session.status === "paused") {
					void this.deps.eventBus.emit("session.resume", { sessionId: session.id });
					new Notice(`Resumed "${session.title}"`);
				} else {
					new Notice("No paused session to resume");
				}
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
				const current = sessionService?.getCurrentSession();
				if (current) {
					const bindType = isFolder ? "folder" as const : "file" as const;
					const bindPath = isFolder ? file.path + "/" : file.path;
					const label = isFolder ? file.name : (file as TFile).basename;
					menu.addItem((item) => {
						item.setTitle(`Add to "${current.title}"`)
							.setIcon("link")
							.onClick(() => {
								void eventBus.emit("session.context.bind", {
									sessionId: current.id,
									path: bindPath,
									type: bindType,
								});
								new Notice(`Added "${label}" to "${current.title}"`);
							});
					});
				}

				if (isFile) {
					menu.addItem((item) => {
						item.setTitle("Create New Session")
							.setIcon("timer")
							.onClick(() => {
								new NewSessionModal(app, {
									sessionTypes: SESSION_TYPES,
									templates: sessionService?.getSavedTemplates() ?? [],
									prefill: { title: "", type: SESSION_TYPES[0].type, durationMinutes: 25, focusFile: file.path },
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
