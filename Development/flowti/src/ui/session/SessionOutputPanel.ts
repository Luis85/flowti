import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { SessionOutputArtifact } from "../../domain/session/types";

/**
 * Panel that lists generated output artifacts and provides
 * a "Generate Output" button for completed/archived sessions.
 */
export class SessionOutputPanel {
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;
	private onGenerate: () => void;

	constructor(private container: HTMLElement, deps: SessionPanelDeps, onGenerate: () => void) {
		this.deps = deps;
		this.onGenerate = onGenerate;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-outputs ft-section" });

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

		const labelRow = headerRow.createDiv();
		labelRow.style.cssText = "display:flex;align-items:center;gap:8px;";
		labelRow.createEl("strong", { text: "Output Artifacts" });
		this.countEl = labelRow.createEl("span", {
			text: `(${session.outputArtifacts.length})`,
			cls: "ft-text-muted ft-text-sm",
		});
		this.countEl.style.cssText = "color:var(--text-muted);font-size:12px;";

		// Generate button
		const btn = headerRow.createEl("button", { text: "Generate Output", cls: "ft-output-generate-btn" });
		btn.style.cssText = "display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:13px;";
		const iconEl = btn.createSpan();
		setIcon(iconEl, "file-output");
		btn.prepend(iconEl);
		btn.addEventListener("click", () => this.onGenerate());

		this.listEl = section.createDiv({ cls: "ft-outputs-list" });
		this.renderList();
	}

	refreshList(): void {
		this.renderList();
		this.updateCount();
	}

	private updateCount(): void {
		const session = this.deps.getSession();
		if (this.countEl) {
			this.countEl.textContent = `(${session.outputArtifacts.length})`;
		}
	}

	private renderList(): void {
		const session = this.deps.getSession();
		if (!this.listEl) return;
		this.listEl.empty();

		if (session.outputArtifacts.length === 0) {
			const empty = this.listEl.createDiv({ cls: "ft-outputs-empty" });
			empty.style.cssText = "color:var(--text-muted);font-size:12px;padding:8px 0;";
			empty.setText("No output artifacts generated yet.");
			return;
		}

		for (const artifact of session.outputArtifacts) {
			this.renderArtifactRow(artifact);
		}
	}

	private renderArtifactRow(artifact: SessionOutputArtifact): void {
		const row = this.listEl!.createDiv({ cls: "ft-output-row" });
		row.style.cssText = "padding:6px 0;border-bottom:1px solid var(--background-modifier-border);display:flex;align-items:center;gap:8px;";

		const iconEl = row.createSpan();
		setIcon(iconEl, "file-text");

		const name = artifact.path.split("/").pop() ?? artifact.path;
		const link = row.createEl("a", { text: name, cls: "ft-output-link" });
		link.title = artifact.path;
		link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);flex:1;font-size:13px;";
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.deps.openFile(artifact.path);
		});

		const date = new Date(artifact.generatedAt).toISOString().split("T")[0];
		row.createEl("span", { text: date, cls: "ft-output-date" }).style.cssText = "color:var(--text-muted);font-size:11px;";
	}
}
