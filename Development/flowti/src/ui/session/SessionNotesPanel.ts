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

		section.createEl("strong", { text: "Notes" }).style.cssText = "display:block;margin-bottom:8px;";

		this.notesTextarea = section.createEl("textarea");
		this.notesTextarea.value = session.notes;
		this.notesTextarea.placeholder = "Session notes...";
		this.notesTextarea.style.cssText = "width:100%;min-height:100px;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);resize:vertical;font-family:inherit;";

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
