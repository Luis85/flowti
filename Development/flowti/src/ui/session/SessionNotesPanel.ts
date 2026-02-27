import type { SessionPanelDeps } from "./types";

const NOTES_DEBOUNCE_MS = 500;

export class SessionNotesPanel {
	private notesTextarea: HTMLTextAreaElement | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-notes ft-section" });

		section.createEl("strong", { text: "Notes", cls: "ft-session-notes-heading" });

		this.notesTextarea = section.createEl("textarea", { cls: "ft-session-notes-textarea" });
		this.notesTextarea.value = session.notes;
		this.notesTextarea.placeholder = "Session notes...";

		this.notesTextarea.addEventListener("input", () => {
			this.debouncedNotesUpdate();
		});
	}

	updateNotes(notes: string): void {
		if (this.notesTextarea && document.activeElement !== this.notesTextarea) {
			this.notesTextarea.value = notes;
		}
	}

	destroy(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	private debouncedNotesUpdate(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			const session = this.deps.getSession();
			if (this.notesTextarea) {
				void this.deps.eventBus.emit("session.notes.update", {
					sessionId: session.id,
					notes: this.notesTextarea.value,
				});
			}
		}, NOTES_DEBOUNCE_MS);
	}
}
