/**
 * Root Lit component for the Project Detail view.
 * Composes child components: header → note section → storybook section.
 * Dispatches navigation and action events to the controller.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { StorybookStatus, ProjectSummary, ProjectConfig } from "../../domain/projects/types.js";

// Side-effect imports to register child custom elements
import "./flowti-storybook-section.js";
import "./flowti-config-tab.js";
import "./flowti-scaffold-modal.js";

export class FlowtiProjectDetail extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String, attribute: "project-name" },
		projectType: { type: String, attribute: "project-type" },
		hasNote: { type: Boolean, attribute: "has-note" },
		notePath: { type: String, attribute: "note-path" },
		storybook: { type: Object },
		projects: { type: Array },
		searchQuery: { type: String },
		statusMessage: { type: String },
		storybookBusy: { type: Boolean },
		storybookBusyLabel: { type: String },
		storybookOutput: { type: Array },
		storybookError: { type: String },
		config: { type: Object },
		activeTab: { type: String },
		showScaffoldModal: { type: Boolean },
		hasSitemap: { type: Boolean },
		hasMarkdownSource: { type: Boolean },
		hasCanvas: { type: Boolean },
		canvasChanged: { type: Boolean },
		brief: { type: Object },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 16px);
				padding: var(--flowti-space-md, 16px);
			}

			.header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
			}

			.back-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: none;
				color: var(--text-muted, #999);
				cursor: pointer;
				font-size: 1em;
				flex-shrink: 0;
			}

			.back-btn:hover {
				background: var(--background-modifier-hover, #333);
				color: var(--text-normal, #ddd);
			}

			.project-name {
				font-size: 1.25em;
				font-weight: 600;
				color: var(--text-normal, #ddd);
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.type-badge {
				font-size: var(--flowti-font-xs, 0.75em);
				padding: 2px 8px;
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
				color: var(--interactive-accent, #7c3aed);
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				flex-shrink: 0;
			}

			.section {
				padding: var(--flowti-space-sm, 8px) 0;
				border-top: 1px solid var(--background-modifier-border, #333);
			}

			.section--first {
				border-top: none;
			}

			.brief-info {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
				padding: var(--flowti-space-sm, 8px) 0;
			}

			.brief-row {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.brief-label {
				color: var(--text-muted, #999);
				min-width: 70px;
			}

			.brief-value {
				color: var(--text-normal, #ddd);
			}

			.brief-meta {
				display: flex;
				gap: var(--flowti-space-md, 16px);
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-muted, #999);
			}

			.brief-description {
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-normal, #ddd);
				line-height: 1.5;
			}

			.brief-status {
				display: inline-block;
				padding: 1px 8px;
				border-radius: 3px;
				font-size: 0.8em;
				background: var(--background-modifier-hover, #333);
			}

			.section-title {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-muted, #999);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.note-link {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs, 4px);
				color: var(--interactive-accent, #7c3aed);
				cursor: pointer;
				font-size: var(--flowti-font-sm, 0.85em);
				border: none;
				background: none;
				padding: 4px 0;
			}

			.note-link:hover {
				text-decoration: underline;
			}

			.note-warning {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 10%, transparent);
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.note-create {
				padding: 4px 12px;
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--interactive-accent, #7c3aed);
				background: none;
				color: var(--interactive-accent, #7c3aed);
				cursor: pointer;
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
			}

			.note-create:hover {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 10%, transparent);
			}

			/* ── Project list styles ── */
			.list-header {
				font-size: 1.1em;
				font-weight: 600;
				color: var(--text-normal, #ddd);
			}

			.search-input {
				width: 100%;
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--background-primary, #1e1e1e);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.project-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
			}

			.project-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				cursor: pointer;
				border: none;
				background: none;
				color: var(--text-normal, #ddd);
				text-align: left;
				width: 100%;
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.project-item:hover {
				background: var(--background-modifier-hover, #333);
			}

			.project-item__name {
				flex: 1;
				font-weight: 500;
			}

			.project-item__badges {
				display: flex;
				gap: var(--flowti-space-xs, 4px);
				align-items: center;
			}

			.badge {
				font-size: 0.7em;
				padding: 1px 6px;
				border-radius: var(--flowti-radius-sm, 4px);
				font-weight: 500;
			}

			.badge--type {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
				color: var(--interactive-accent, #7c3aed);
			}

			.badge--sb {
				background: color-mix(in srgb, var(--color-green, #4caf50) 15%, transparent);
				color: var(--color-green, #4caf50);
			}

			.badge--running {
				background: color-mix(in srgb, var(--color-green, #4caf50) 20%, transparent);
				color: var(--color-green, #4caf50);
			}

			.badge--no-note {
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 15%, transparent);
				color: var(--color-yellow, #e5a00d);
			}

			.empty-list {
				padding: var(--flowti-space-xl, 32px);
				text-align: center;
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.status-banner {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 12%, transparent);
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			/* ── Config info section ── */
			.config-grid {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.config-label {
				color: var(--text-muted, #999);
				font-weight: 500;
				white-space: nowrap;
			}

			.config-value {
				color: var(--text-normal, #ddd);
			}

			.config-tags {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs, 4px);
			}

			.config-tag {
				display: inline-block;
				padding: 1px 6px;
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--background-modifier-hover, #333);
				font-size: 0.9em;
			}

			.config-empty {
				padding: var(--flowti-space-sm, 8px);
				color: var(--text-faint, #666);
				font-size: var(--flowti-font-sm, 0.85em);
				font-style: italic;
			}

			.tab-bar {
				display: flex;
				gap: 0;
				border-bottom: 1px solid var(--background-modifier-border, #333);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.tab-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border: none;
				border-bottom: 2px solid transparent;
				background: none;
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.tab-btn:hover {
				color: var(--text-normal, #ddd);
			}

			.tab-btn--active {
				color: var(--interactive-accent, #7c3aed);
				border-bottom-color: var(--interactive-accent, #7c3aed);
				font-weight: 500;
			}

			.framework-badge {
				display: inline-block;
				padding: 1px 6px;
				border-radius: 3px;
				font-size: 0.8em;
				background: var(--background-modifier-hover, #333);
				color: var(--text-muted, #999);
			}

			.status-label {
				font-size: 0.8em;
				color: var(--text-muted, #999);
			}

			.status-label--running {
				color: var(--color-green, #4caf50);
			}

			.dot--running {
				display: inline-block;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--color-green, #4caf50);
			}
		`,
	];

	projectName = "";
	projectType = "";
	hasNote = false;
	notePath = "";
	storybook: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false };
	projects: ProjectSummary[] = [];
	searchQuery = "";
	statusMessage = "";
	storybookBusy = false;
	storybookBusyLabel = "";
	storybookOutput: string[] = [];
	storybookError = "";
	config: ProjectConfig | undefined = undefined;
	activeTab = "overview";
	showScaffoldModal = false;
	hasSitemap = false;
	hasMarkdownSource = false;
	hasCanvas = false;
	canvasChanged = false;
	brief: Record<string, string | undefined> | undefined = undefined;

	protected renderContent() {
		if (!this.projectName) {
			return this.renderProjectList();
		}
		return html`
			${this.renderHeader()}
			${this.renderBriefSection()}
			${this.statusMessage ? html`<div class="status-banner">${this.statusMessage}</div>` : ""}
			${this.canvasChanged ? html`
				<div class="status-banner">
					sitemap.canvas has changed
					<button class="note-create" @click="${() => this.dispatchEvent(new CustomEvent('canvas-merge', { bubbles: true, composed: true }))}">Merge</button>
				</div>
			` : ""}
			${this.renderTabBar()}
			${this.activeTab === "overview" ? html`
				${this.renderConfigSection()}
				${this.renderNoteSection()}
				${this.renderStorybookSection()}
			` : ""}
			${this.activeTab === "config" ? html`
				<flowti-config-tab
					.projectName="${this.projectName}"
					.config="${this.config}"
				></flowti-config-tab>
			` : ""}
			${this.showScaffoldModal ? html`
				<flowti-scaffold-modal
					.hasSitemap="${this.hasSitemap}"
					.hasMarkdownSource="${this.hasMarkdownSource}"
					.hasCanvas="${this.hasCanvas}"
					.canvasChanged="${this.canvasChanged}"
				></flowti-scaffold-modal>
			` : ""}
		`;
	}

	private renderTabBar() {
		const tab = (id: string, label: string) => html`
			<button
				class="tab-btn ${this.activeTab === id ? "tab-btn--active" : ""}"
				@click="${() => { this.activeTab = id; }}"
			>${label}</button>
		`;
		return html`
			<div class="tab-bar">
				${tab("overview", "Overview")}
				${tab("config", "Config")}
			</div>
		`;
	}

	private renderProjectList() {
		const filtered = this.searchQuery
			? this.projects.filter((p) => p.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
			: this.projects;

		return html`
			<div class="list-header">Projects</div>
			<input
				class="search-input"
				type="text"
				placeholder="Search projects..."
				.value="${this.searchQuery}"
				@input="${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}"
			/>
			${filtered.length === 0
				? html`<div class="empty-list">${this.projects.length === 0 ? "No projects found. Is the CLI server running?" : "No matches"}</div>`
				: html`<div class="project-list">${filtered.map((p) => this.renderProjectItem(p))}</div>`
			}
		`;
	}

	private renderProjectItem(p: ProjectSummary) {
		return html`
			<button class="project-item" @click="${() => this.selectProject(p.name)}">
				<span class="project-item__name">${p.name}</span>
				<span class="project-item__badges">
					${p.hasNote ? html`<span class="badge badge--type">${p.type}</span>` : ""}
					${!p.hasNote ? html`<span class="badge badge--no-note" @click="${(e: Event) => { e.stopPropagation(); this.createNote(p.name); }}" title="Create ProjectBrief note">+ brief</span>` : ""}
					${p.storybook.running ? html`<span class="badge badge--running">SB running</span>` : ""}
					${p.storybook.installed && !p.storybook.running ? html`<span class="badge badge--sb">${p.storybook.framework ?? "SB"}</span>` : ""}
				</span>
			</button>
		`;
	}

	private selectProject(name: string) {
		this.dispatchEvent(new CustomEvent("project-selected", { detail: { name }, bubbles: true, composed: true }));
	}

	private createNote(name: string) {
		this.dispatchEvent(new CustomEvent("create-project-note", { detail: { name }, bubbles: true, composed: true }));
	}

	private renderHeader() {
		return html`
			<div class="header">
				<button class="back-btn" @click="${this.dispatchBackToList}" title="Back to project list">&larr;</button>
				<span class="project-name">${this.projectName}</span>
				<span class="type-badge">${this.projectType}</span>
			</div>
		`;
	}

	private renderNoteSection() {
		return html`
			<div class="section">
				<div class="section-title">Project Brief</div>
				${this.hasNote ? this.renderNoteLink() : this.renderNoteWarning()}
			</div>
		`;
	}

	private renderNoteLink() {
		return html`
			<button class="note-link" @click="${this.dispatchOpenNote}">Open brief</button>
		`;
	}

	private renderNoteWarning() {
		return html`
			<div class="note-warning">
				<span>No project brief</span>
				<button class="note-create" @click="${this.dispatchCreateNote}">Create brief</button>
			</div>
		`;
	}

	private renderBriefSection() {
		if (!this.brief) return "";
		const { goal, description, start, end, status } = this.brief;
		const hasAny = goal || description || start || end || status;
		if (!hasAny) return "";

		return html`
			<div class="brief-info">
				${goal ? html`
					<div class="brief-row">
						<span class="brief-label">Goal</span>
						<span class="brief-value">${goal}</span>
					</div>
				` : ""}
				${status || start || end ? html`
					<div class="brief-meta">
						${status ? html`<span class="brief-status">${status}</span>` : ""}
						${start ? html`<span>Start: ${start}</span>` : ""}
						${end ? html`<span>End: ${end}</span>` : ""}
					</div>
				` : ""}
				${description ? html`<div class="brief-description">${description}</div>` : ""}
			</div>
		`;
	}

	private renderConfigSection() {
		if (!this.config) {
			return html`
				<div class="section section--first">
					<div class="section-title">Project Info</div>
					<div class="config-empty">No flowti.config.json found</div>
				</div>
			`;
		}

		const { buildModes, testPresets, healthTargets, agents, publishTargets } = this.config;
		const hasHealth = healthTargets && (healthTargets.coverageTarget || healthTargets.minTests);

		return html`
			<div class="section section--first">
				<div class="section-title">Project Info</div>
				<div class="config-grid">
					${buildModes.length > 0 ? html`
						<span class="config-label">Build</span>
						<span class="config-value"><span class="config-tags">${buildModes.map((m) => html`<span class="config-tag">${m}</span>`)}</span></span>
					` : ""}
					${testPresets.length > 0 ? html`
						<span class="config-label">Test</span>
						<span class="config-value"><span class="config-tags">${testPresets.map((t) => html`<span class="config-tag">${t}</span>`)}</span></span>
					` : ""}
					${hasHealth ? html`
						<span class="config-label">Health</span>
						<span class="config-value">${this.formatHealth(healthTargets)}</span>
					` : ""}
					${agents && agents.length > 0 ? html`
						<span class="config-label">Team</span>
						<span class="config-value">${agents.length <= 4 ? agents.join(", ") : `${agents.slice(0, 3).join(", ")} +${agents.length - 3} more`}</span>
					` : ""}
					${publishTargets && publishTargets.length > 0 ? html`
						<span class="config-label">Deploy</span>
						<span class="config-value">${publishTargets.join(", ")}</span>
					` : ""}
				</div>
			</div>
		`;
	}

	private formatHealth(h: NonNullable<ProjectConfig["healthTargets"]>): string {
		const parts: string[] = [];
		if (h.coverageMin || h.coverageTarget) {
			parts.push(`Coverage ${h.coverageMin ?? "?"}%\u2192${h.coverageTarget ?? "?"}%`);
		}
		if (h.maxLintErrors !== undefined) parts.push(`Lint errors \u2264${h.maxLintErrors}`);
		if (h.maxLintWarnings !== undefined) parts.push(`Warnings \u2264${h.maxLintWarnings}`);
		if (h.minTests) parts.push(`Tests \u2265${h.minTests}`);
		return parts.join(" \u00B7 ");
	}

	private renderStorybookSection() {
		const badge = this.storybook.framework
			? html`<span class="framework-badge">${this.storybook.framework}</span>`
			: "";
		const statusText = this.storybook.running ? "Running" : this.storybook.installed ? "Installed" : "";
		const statusClass = this.storybook.running ? "status-label--running" : "";
		const dot = this.storybook.running ? html`<span class="dot--running"></span>` : "";

		return html`
			<div class="section">
				<div class="section-title">
					Storybook ${dot} ${badge}
					${statusText ? html`<span class="status-label ${statusClass}">${statusText}</span>` : ""}
				</div>
				<flowti-storybook-section
					.installed="${this.storybook.installed}"
					.framework="${this.storybook.framework}"
					.running="${this.storybook.running}"
					.busy="${this.storybookBusy}"
					.busyLabel="${this.storybookBusyLabel}"
					.outputLines="${this.storybookOutput}"
					.errorNote="${this.storybookError}"
					.url="${this.storybook.url}"
					.pid="${this.storybook.pid}"
					.hasStaticBuild="${this.storybook.hasStaticBuild}"
				></flowti-storybook-section>
			</div>
		`;
	}

	private dispatchBackToList(): void {
		this.dispatchEvent(new CustomEvent("back-to-list", { bubbles: true, composed: true }));
	}

	private dispatchOpenNote(): void {
		this.dispatchEvent(new CustomEvent("open-project-note", {
			detail: { path: this.notePath },
			bubbles: true,
			composed: true,
		}));
	}

	private dispatchCreateNote(): void {
		this.dispatchEvent(new CustomEvent("create-project-note", {
			detail: { name: this.projectName },
			bubbles: true,
			composed: true,
		}));
	}
}

if (!customElements.get("flowti-project-detail")) customElements.define("flowti-project-detail", FlowtiProjectDetail);
