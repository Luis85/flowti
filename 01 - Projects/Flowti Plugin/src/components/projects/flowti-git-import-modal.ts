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

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import "../shared/ft-process-log.js";

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
		detectedType: { type: String },
		detectedFramework: { type: String },
		detectedPackageManager: { type: String },
		detectedTestFramework: { type: String },
		detectedHasConfig: { type: Boolean },
		configBuildCommand: { type: String },
		configTestCommand: { type: String },
		configLintCommand: { type: String },
		configFramework: { type: String },
	};

	static styles = [
		tokens,
		css`
			:host {
				display: block;
			}

			.overlay {
				position: fixed;
				inset: 0;
				background: rgba(0, 0, 0, 0.6);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1000;
			}

			.modal {
				background: var(--background-primary, #1e1e1e);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 8px;
				padding: var(--flowti-space-md, 16px);
				max-width: 520px;
				width: calc(100% - 24px);
				margin: 0 12px;
				box-sizing: border-box;
			}

			.modal-title {
				font-weight: 600;
				font-size: 1.1em;
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.modal-body {
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
				margin-bottom: var(--flowti-space-md, 16px);
				line-height: 1.5;
			}

			.modal-actions {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				justify-content: flex-end;
			}

			.btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 4px;
				background: var(--background-secondary, #262626);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.btn:hover {
				background: var(--background-modifier-hover, #333);
			}

			.btn--primary {
				background: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
				color: #fff;
			}

			.btn--primary:hover {
				filter: brightness(1.1);
			}

			.btn:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.form-field {
				display: flex;
				flex-direction: column;
				gap: 4px;
				margin-bottom: var(--flowti-space-md, 16px);
			}

			.form-field label {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-normal, #ddd);
			}

			.form-field input {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 4px;
				background: var(--background-secondary, #262626);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				font-family: inherit;
			}

			.form-field input:focus {
				outline: none;
				border-color: var(--interactive-accent, #7c3aed);
			}

			.form-field .hint {
				font-size: 0.75em;
				color: var(--text-faint, #666);
			}

			.error-note {
				color: var(--text-error, #e53e3e);
				font-size: var(--flowti-font-sm, 0.85em);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.step-indicator {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				margin-bottom: var(--flowti-space-md, 16px);
			}

			.step-dot {
				display: flex;
				align-items: center;
				gap: 4px;
				font-size: 0.75em;
				color: var(--text-faint, #666);
			}

			.step-dot--active {
				color: var(--interactive-accent, #7c3aed);
				font-weight: 600;
			}

			.step-dot--done {
				color: var(--text-success, #38a169);
			}

			.detect-grid {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 4px var(--flowti-space-md, 16px);
				font-size: var(--flowti-font-sm, 0.85em);
				margin-bottom: var(--flowti-space-md, 16px);
			}

			.detect-grid dt {
				color: var(--text-muted, #999);
				font-weight: 500;
			}

			.detect-grid dd {
				color: var(--text-normal, #ddd);
				margin: 0;
			}

			.framework-group {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs, 4px);
			}

			.framework-btn {
				padding: 2px var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 4px;
				background: var(--background-secondary, #262626);
				color: var(--text-normal, #ddd);
				font-size: 0.75em;
				cursor: pointer;
			}

			.framework-btn--selected {
				background: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
				color: #fff;
			}

			.summary-card {
				background: var(--background-secondary, #262626);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 4px;
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				margin-bottom: var(--flowti-space-md, 16px);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.summary-card .name {
				font-weight: 600;
				margin-bottom: 4px;
			}

			.summary-card .detail {
				color: var(--text-muted, #999);
			}

			.progress-section {
				margin-bottom: var(--flowti-space-md, 16px);
			}

			.progress-label {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-muted, #999);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.spinner {
				width: 14px;
				height: 14px;
				border: 2px solid var(--background-modifier-border, #333);
				border-top-color: var(--interactive-accent, #7c3aed);
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
			}

			@keyframes spin {
				to { transform: rotate(360deg); }
			}
		`,
	];

	mode: "submodule" | "template" = "submodule";
	step: ModalStep = "form";
	url = "";
	name = "";
	outputLines: string[] = [];
	errorNote = "";
	detectedType = "";
	detectedFramework = "";
	detectedPackageManager = "";
	detectedTestFramework = "";
	detectedHasConfig = false;
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
						<dt>Type</dt><dd>${this.detectedType || "unknown"}</dd>
						<dt>Framework</dt><dd>${this.detectedFramework || "none"}</dd>
						<dt>Package manager</dt><dd>${this.detectedPackageManager || "none"}</dd>
						<dt>Test framework</dt><dd>${this.detectedTestFramework || "none"}</dd>
						<dt>Existing config</dt><dd>${this.detectedHasConfig ? "yes" : "no"}</dd>
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
						<div class="detail">${this.detectedFramework || this.configFramework || this.detectedType || "Project"} &middot; ${this.mode === "template" ? "template" : "submodule"}</div>
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
				framework: this.detectedFramework,
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
				framework: this.configFramework || this.detectedFramework,
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
		this.configBuildCommand = this.configBuildCommand || "";
		this.configTestCommand = this.configTestCommand || "";
		this.configLintCommand = this.configLintCommand || "";
		this.configFramework = this.configFramework || this.detectedFramework || "";
		this.step = "configure";
	}

	private goToDetect(): void {
		this.step = "detect";
	}
}

if (!customElements.get("flowti-git-import-modal")) customElements.define("flowti-git-import-modal", FlowtiGitImportModal);
