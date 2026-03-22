/**
 * Git import modal — multi-step wizard for importing projects from Git.
 *
 * Five states:
 * 1. form — URL + name inputs, Setup button
 * 2. progress — spinner + output log, Cancel button
 * 3. detect — read-only detection results, Configure/Finish button
 * 4. configure — pre-filled form for build/test/lint, Finish button
 * 5. done — summary + Open Project button
 */

import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { gitImportModalStyles } from "./flowti-git-import-modal-styles.js";
import "../shared/ft-process-log.js";
import type { GitDetectResult } from "../../domain/projects/types.js";

type ModalStep = "form" | "progress" | "detect" | "configure" | "done";

export class FlowtiGitImportModal extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		mode: { type: String },
		step: { type: String },
		url: { type: String },
		name: { type: String },
		outputLines: { type: Array },
		errorNote: { type: String },
		detected: { type: Object },
		configBuildCommand: { type: String },
		configTestCommand: { type: String },
		configLintCommand: { type: String },
		configFramework: { type: String },
	};

	static styles = [
		tokens,
		gitImportModalStyles,
	];

	mode: "submodule" | "template" = "submodule";
	step: ModalStep = "form";
	url = "";
	name = "";
	outputLines: string[] = [];
	errorNote = "";
	detected: GitDetectResult | null = null;
	configBuildCommand = "";
	configTestCommand = "";
	configLintCommand = "";
	configFramework = "";

	private get isUrlValid(): boolean {
		const u = this.url.trim();
		return u.startsWith("https://") || u.startsWith("git@") || u.startsWith("http://");
	}

	private get projectName(): string {
		return this.name.trim() || this.extractRepoName(this.url);
	}

	protected renderContent() {
		switch (this.step) {
			case "form": return this.renderForm();
			case "progress": return this.renderProgress();
			case "detect": return this.renderDetect();
			case "configure": return this.renderConfigure();
			case "done": return this.renderDone();
			default: return html``;
		}
	}

	private renderForm() {
		const modeLabel = this.mode === "template" ? "New from Template" : "Import from Git";
		const modeHint = this.mode === "template"
			? "Clone the repository, detach git history, and add as an untracked project."
			: "Clone as a tracked git submodule.";

		return html`
			<div class="overlay" @click="${this.dispatchCancel}" @keydown="${this.onOverlayKeydown}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">${modeLabel}</div>
					<div class="modal-body">${modeHint}</div>

					<div class="form-field">
						<label>Repository URL</label>
						<input
							type="text"
							placeholder="https://github.com/user/repo"
							.value="${this.url}"
							@input="${(e: Event) => { this.url = (e.target as HTMLInputElement).value; }}"
							@blur="${this.onUrlBlur}"
							@keydown="${this.onFormKeydown}"
						/>
					</div>

					<div class="form-field">
						<label>Project name</label>
						<input
							type="text"
							placeholder="${this.extractRepoName(this.url) || "my-project"}"
							.value="${this.name}"
							@input="${(e: Event) => { this.name = (e.target as HTMLInputElement).value; }}"
							@keydown="${this.onFormKeydown}"
						/>
						${this.projectName ? html`<span class="hint">Path: 01 - Projects/${this.projectName}/</span>` : ""}
					</div>

					${this.errorNote ? html`<div class="error-note">${this.errorNote}</div>` : ""}

					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchCancel}">Cancel</button>
						<button
							class="btn btn--primary"
							?disabled="${!this.isUrlValid || !this.projectName}"
							@click="${this.dispatchSetup}"
						>Setup</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderProgress() {
		return html`
			<div class="overlay">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Setting up project</div>
					<div class="progress-section">
						<div class="progress-label">
							<div class="spinner"></div>
							<span>Cloning ${this.projectName}...</span>
						</div>
						<ft-process-log .lines="${this.outputLines}"></ft-process-log>
					</div>
					${this.errorNote ? html`<div class="error-note">${this.errorNote}</div>` : ""}
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchAbort}">Cancel</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderDetect() {
		const steps = this.renderStepIndicator(0);
		return html`
			<div class="overlay">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Project detected</div>
					${steps}
					<dl class="detect-grid">
						<dt>Type</dt><dd>${this.detected?.type ?? "unknown"}</dd>
						<dt>Framework</dt><dd>${this.detected?.framework ?? "none"}</dd>
						<dt>Package manager</dt><dd>${this.detected?.packageManager ?? "none"}</dd>
						<dt>Test framework</dt><dd>${this.detected?.testFramework ?? "none"}</dd>
						<dt>Existing config</dt><dd>${this.detected?.hasConfig ? "yes" : "no"}</dd>
					</dl>
					${this.errorNote ? html`<div class="error-note">${this.errorNote}</div>` : ""}
					<div class="modal-actions">
						<button class="btn" @click="${this.goToConfigure}">Configure</button>
						<button class="btn btn--primary" @click="${this.dispatchFinish}">Finish</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderConfigure() {
		const steps = this.renderStepIndicator(1);
		const frameworks = ["React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt"];

		return html`
			<div class="overlay">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Configure project</div>
					${steps}

					<div class="form-field">
						<label>Build command</label>
						<input
							type="text"
							placeholder="npm run build"
							.value="${this.configBuildCommand}"
							@input="${(e: Event) => { this.configBuildCommand = (e.target as HTMLInputElement).value; }}"
						/>
					</div>

					<div class="form-field">
						<label>Test command</label>
						<input
							type="text"
							placeholder="npm test"
							.value="${this.configTestCommand}"
							@input="${(e: Event) => { this.configTestCommand = (e.target as HTMLInputElement).value; }}"
						/>
					</div>

					<div class="form-field">
						<label>Lint command</label>
						<input
							type="text"
							placeholder="npm run lint"
							.value="${this.configLintCommand}"
							@input="${(e: Event) => { this.configLintCommand = (e.target as HTMLInputElement).value; }}"
						/>
					</div>

					<div class="form-field">
						<label>Framework</label>
						<div class="framework-group">
							${frameworks.map((fw) => html`
								<button
									class="framework-btn ${this.configFramework === fw ? "framework-btn--selected" : ""}"
									@click="${() => { this.configFramework = this.configFramework === fw ? "" : fw; }}"
								>${fw}</button>
							`)}
						</div>
					</div>

					<div class="modal-actions">
						<button class="btn" @click="${this.goToDetect}">Back</button>
						<button class="btn btn--primary" @click="${this.dispatchConfigure}">Finish</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderDone() {
		const steps = this.renderStepIndicator(2);
		return html`
			<div class="overlay">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Project ready</div>
					${steps}
					<div class="summary-card">
						<div class="name">${this.projectName}</div>
						<div class="detail">${this.detected?.framework || this.configFramework || this.detected?.type || "Project"} &middot; ${this.mode === "template" ? "template" : "submodule"}</div>
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchCancel}">Close</button>
						<button class="btn btn--primary" @click="${this.dispatchOpenProject}">Open Project</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderStepIndicator(activeIndex: number) {
		const labels = ["Detect", "Configure", "Done"];
		return html`
			<div class="step-indicator">
				${labels.map((label, i) => {
					const cls = i < activeIndex ? "step-dot step-dot--done"
						: i === activeIndex ? "step-dot step-dot--active"
						: "step-dot";
					return html`<span class="${cls}">${i + 1}. ${label}</span>`;
				})}
			</div>
		`;
	}

	// ── URL helpers (inlined from CLI domain) ───────────────

	private normalizeGitUrl(raw: string): string {
		const url = raw.trim();
		if (!url || url.startsWith("git@")) return url;

		let parsed: URL;
		try { parsed = new URL(url); } catch { return url; }

		parsed.search = "";
		parsed.hash = "";
		const host = parsed.hostname.toLowerCase();
		const path = parsed.pathname;

		if (host === "github.com") {
			const m = path.match(/^\/([^/]+\/[^/]+)/);
			if (m) return `https://github.com/${m[1].replace(/\.git$/, "")}.git`;
		}
		if (host === "gitlab.com" || host.includes("gitlab")) {
			const m = path.match(/^\/([^/]+\/[^/]+)/);
			if (m) return `${parsed.origin}/${m[1].replace(/\.git$/, "")}.git`;
		}
		if (host === "bitbucket.org") {
			const m = path.match(/^\/([^/]+\/[^/]+)/);
			if (m) return `https://bitbucket.org/${m[1].replace(/\.git$/, "")}.git`;
		}

		return parsed.toString();
	}

	private extractRepoName(url: string): string {
		const trimmed = url.trim();
		if (!trimmed) return "";

		if (trimmed.startsWith("git@")) {
			const m = trimmed.match(/\/([^/]+?)(?:\.git)?$/);
			if (m) return m[1];
		}

		const azureMatch = trimmed.match(/\/_git\/([^/?]+)/);
		if (azureMatch) return azureMatch[1];

		try {
			const parsed = new URL(trimmed);
			const segments = parsed.pathname.split("/").filter(Boolean);
			if (segments.length >= 2) return segments[1].replace(/\.git$/, "");
		} catch {
			// Fall through
		}

		return "";
	}

	// ── Event handlers ──────────────────────────────────────

	private onUrlBlur(): void {
		if (this.url.trim()) {
			this.url = this.normalizeGitUrl(this.url);
		}
	}

	private onFormKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter" && this.isUrlValid && this.projectName) {
			e.preventDefault();
			this.dispatchSetup();
		}
	}

	private onOverlayKeydown(e: KeyboardEvent): void {
		if (e.key === "Escape") this.dispatchCancel();
	}

	// ── Event dispatchers ───────────────────────────────────

	private dispatchSetup(): void {
		this.dispatchEvent(new CustomEvent("import-setup", {
			detail: { url: this.url, name: this.projectName, mode: this.mode },
			bubbles: true, composed: true,
		}));
	}

	private dispatchCancel(): void {
		this.dispatchEvent(new CustomEvent("import-cancel", {
			bubbles: true, composed: true,
		}));
	}

	private dispatchAbort(): void {
		this.dispatchEvent(new CustomEvent("import-abort", {
			bubbles: true, composed: true,
		}));
	}

	private dispatchFinish(): void {
		this.dispatchEvent(new CustomEvent("wizard-configure", {
			detail: {
				name: this.projectName,
				framework: this.detected?.framework ?? "",
				buildCommand: this.configBuildCommand,
				testCommand: this.configTestCommand,
				lintCommand: this.configLintCommand,
			},
			bubbles: true, composed: true,
		}));
	}

	private dispatchConfigure(): void {
		this.dispatchEvent(new CustomEvent("wizard-configure", {
			detail: {
				name: this.projectName,
				framework: this.configFramework || this.detected?.framework || "",
				buildCommand: this.configBuildCommand,
				testCommand: this.configTestCommand,
				lintCommand: this.configLintCommand,
			},
			bubbles: true, composed: true,
		}));
	}

	private dispatchOpenProject(): void {
		this.dispatchEvent(new CustomEvent("wizard-open-project", {
			detail: { name: this.projectName },
			bubbles: true, composed: true,
		}));
	}

	// ── Navigation ──────────────────────────────────────────

	private goToConfigure(): void {
		this.configBuildCommand = this.configBuildCommand || this.detected?.buildCommand || "";
		this.configTestCommand = this.configTestCommand || this.detected?.testCommand || "";
		this.configLintCommand = this.configLintCommand || this.detected?.lintCommand || "";
		this.configFramework = this.configFramework || this.detected?.framework || "";
		this.step = "configure";
	}

	private goToDetect(): void {
		this.step = "detect";
	}
}

if (!customElements.get("flowti-git-import-modal")) customElements.define("flowti-git-import-modal", FlowtiGitImportModal);
