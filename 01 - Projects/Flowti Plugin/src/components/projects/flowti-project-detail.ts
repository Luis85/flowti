/**
 * Root Lit component for the Project Detail view.
 * 5-tab router: Overview, Components, Event Catalog, Reporting, Config.
 * Each tab delegates to a dedicated child tab component.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { StorybookStatus, ProjectSummary, ProjectConfig, HealthScore, TodoItem, CatalogEntity, ComponentEntry, ReportGeneratorInfo } from "../../domain/projects/types.js";

// Side-effect imports to register child custom elements
import "./flowti-tab-overview.js";
import "./flowti-tab-components.js";
import "./flowti-tab-event-catalog.js";
import "./flowti-tab-reporting.js";
import "./flowti-tab-config.js";
import "./flowti-scaffold-modal.js";
import "./flowti-add-project-dropdown.js";
import "./flowti-git-import-modal.js";

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
		actionSuccess: { type: String },
		config: { type: Object },
		activeTab: { type: String },
		showScaffoldModal: { type: Boolean },
		hasSitemap: { type: Boolean },
		hasMarkdownSource: { type: Boolean },
		hasCanvas: { type: Boolean },
		canvasChanged: { type: Boolean },
		canvasPreset: { type: String },
		brief: { type: Object },
		showGitModal: { type: Boolean },
		gitModalMode: { type: String },
		showNamePrompt: { type: Boolean },
		cliConnected: { type: Boolean },
		healthScore: { type: Object },
		healthError: { type: String },
		todos: { type: Array },
		todosExist: { type: Boolean },
		catalogEntities: { type: Array },
		components: { type: Array },
		reportGenerators: { type: Array },
		reportNodeStates: { type: Object },
		reportOutput: { type: Array },
		reportBusy: { type: Boolean },
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
				max-width: 360px;
				width: calc(100% - 24px);
				box-sizing: border-box;
			}

			.modal-title {
				font-weight: 600;
				font-size: 1.1em;
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.modal-body {
				margin-bottom: var(--flowti-space-md, 16px);
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

			/* ── Project list styles ── */
			.list-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				font-size: 1.1em;
				font-weight: 600;
				color: var(--text-normal, #ddd);
			}

			.search-input {
				width: 100%;
				box-sizing: border-box;
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

			.empty-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
			}

			.empty-pulse {
				display: inline-block;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--text-muted, #999);
				animation: pulse 1.5s ease-in-out infinite;
			}

			@keyframes pulse {
				0%, 100% { opacity: 0.3; }
				50% { opacity: 1; }
			}

			.status-banner {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 12%, transparent);
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
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

			/* ── Activity bar ── */
			.activity-bar {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.activity-bar--busy {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 10%, transparent);
				color: var(--interactive-accent, #7c3aed);
			}

			.activity-bar--success {
				background: color-mix(in srgb, var(--color-green, #4caf50) 12%, transparent);
				color: var(--color-green, #4caf50);
			}

			.activity-bar--error {
				background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
				color: var(--color-red, #e53935);
			}

			.activity-spinner {
				display: inline-block;
				width: 14px;
				height: 14px;
				border: 2px solid currentColor;
				border-top-color: transparent;
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
				flex-shrink: 0;
			}

			@keyframes spin {
				to { transform: rotate(360deg); }
			}

			.activity-dismiss {
				margin-left: auto;
				background: none;
				border: none;
				color: inherit;
				cursor: pointer;
				font-size: 1.1em;
				padding: 0 4px;
				opacity: 0.6;
			}

			.activity-dismiss:hover {
				opacity: 1;
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
	actionSuccess = "";
	config: ProjectConfig | undefined = undefined;
	activeTab = "overview";
	showScaffoldModal = false;
	hasSitemap = false;
	hasMarkdownSource = false;
	hasCanvas = false;
	canvasChanged = false;
	canvasPreset = "";
	brief: Record<string, string | undefined> | undefined = undefined;
	showGitModal = false;
	gitModalMode: "submodule" | "template" = "submodule";
	showNamePrompt = false;
	cliConnected = false;
	healthScore: HealthScore | null = null;
	healthError = "";
	todos: TodoItem[] = [];
	todosExist = false;
	catalogEntities: CatalogEntity[] = [];
	components: ComponentEntry[] = [];
	reportGenerators: ReportGeneratorInfo[] = [];
	reportNodeStates: Record<string, string> = {};
	reportOutput: string[] = [];
	reportBusy = false;

	protected renderContent() {
		if (!this.projectName) {
			return this.renderProjectList();
		}
		return html`
			${this.renderHeader()}
			${this.renderActivityBar()}
			${this.statusMessage ? html`<div class="status-banner">${this.statusMessage}</div>` : ""}
			${this.renderTabBar()}
			${this.activeTab === "overview" ? html`
				<flowti-tab-overview
					.projectName="${this.projectName}"
					.brief="${this.brief}"
					.config="${this.config}"
					.healthScore="${this.healthScore}"
					.healthError="${this.healthError}"
					.todos="${this.todos}"
					.todosExist="${this.todosExist}"
					.hasCanvas="${this.hasCanvas}"
					.hasSitemap="${this.hasSitemap}"
					.canvasPreset="${this.canvasPreset}"
					.canvasChanged="${this.canvasChanged}"
				></flowti-tab-overview>
			` : ""}
			${this.activeTab === "components" ? html`
				<flowti-tab-components
					.projectName="${this.projectName}"
					.components="${this.components}"
					.storybookInstalled="${this.storybook?.installed ?? false}"
					.storybookFramework="${this.storybook?.framework ?? ""}"
					.storybookRunning="${this.storybook?.running ?? false}"
					.storybookUrl="${this.storybook?.url ?? ""}"
					.storybookBusy="${this.storybookBusy}"
					.storybookBusyLabel="${this.storybookBusyLabel}"
					.storybookOutput="${this.storybookOutput}"
					.storybookError="${this.storybookError}"
				></flowti-tab-components>
			` : ""}
			${this.activeTab === "catalog" ? html`
				<flowti-tab-event-catalog
					.projectName="${this.projectName}"
					.entities="${this.catalogEntities}"
				></flowti-tab-event-catalog>
			` : ""}
			${this.activeTab === "reporting" ? html`
				<flowti-tab-reporting
					.projectName="${this.projectName}"
					.generators="${this.reportGenerators}"
					.nodeStates="${this.reportNodeStates}"
					.outputLines="${this.reportOutput}"
					.busy="${this.reportBusy}"
				></flowti-tab-reporting>
			` : ""}
			${this.activeTab === "config" ? html`
				<flowti-tab-config
					.projectName="${this.projectName}"
					.config="${this.config}"
					.hasCanvas="${this.hasCanvas}"
				></flowti-tab-config>
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
				${tab("components", "Components")}
				${tab("catalog", "Event Catalog")}
				${tab("reporting", "Reporting")}
				${tab("config", "Config")}
			</div>
		`;
	}

	private renderProjectList() {
		const filtered = this.searchQuery
			? this.projects.filter((p) => p.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
			: this.projects;

		return html`
			${this.renderActivityBar()}
			<div class="list-header"><span>Projects</span><flowti-add-project-dropdown></flowti-add-project-dropdown></div>
			<input
				class="search-input"
				type="text"
				placeholder="Search projects..."
				.value="${this.searchQuery}"
				@input="${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}"
			/>
			${filtered.length === 0
				? html`<div class="empty-list">
					${!this.cliConnected
						? html`<div class="empty-state"><span class="empty-pulse"></span><span>Waiting for Flowti CLI server...</span></div>`
						: this.projects.length === 0
							? html`<div class="empty-state"><span>No projects yet</span><flowti-add-project-dropdown></flowti-add-project-dropdown></div>`
							: html`<span>No matches</span>`
					}
				</div>`
				: html`<div class="project-list">${filtered.map((p) => this.renderProjectItem(p))}</div>`
			}
			${this.showGitModal ? html`
				<flowti-git-import-modal
					.mode="${this.gitModalMode}"
				></flowti-git-import-modal>
			` : ""}
			${this.showNamePrompt ? this.renderNamePrompt() : ""}
		`;
	}

	private renderNamePrompt() {
		return html`
			<div class="overlay" @click="${() => { this.showNamePrompt = false; }}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Create project</div>
					<div class="modal-body">
						<input
							class="search-input"
							type="text"
							placeholder="Project name"
							@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter") this.submitNamePrompt(e); }}"
						/>
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${() => { this.showNamePrompt = false; }}">Cancel</button>
						<button class="btn btn--primary" @click="${(e: Event) => this.submitNamePrompt(e)}">Create</button>
					</div>
				</div>
			</div>
		`;
	}

	private submitNamePrompt(e: Event): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>(".overlay .search-input");
		const name = input?.value.trim();
		if (!name) return;
		this.showNamePrompt = false;
		this.dispatchEvent(new CustomEvent("create-empty-project", { detail: { name }, bubbles: true, composed: true }));
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
			</div>
		`;
	}

	private renderActivityBar() {
		if (this.storybookBusy) {
			return html`
				<div class="activity-bar activity-bar--busy">
					<span class="activity-spinner"></span>
					<span>${this.storybookBusyLabel || "Working..."}</span>
				</div>
			`;
		}
		if (this.storybookError) {
			return html`
				<div class="activity-bar activity-bar--error">
					<span>${this.storybookError}</span>
					<button class="activity-dismiss" @click="${() => { this.storybookError = ""; }}" title="Dismiss">&times;</button>
				</div>
			`;
		}
		if (this.actionSuccess) {
			return html`
				<div class="activity-bar activity-bar--success">
					<span>${this.actionSuccess}</span>
					<button class="activity-dismiss" @click="${() => { this.actionSuccess = ""; }}" title="Dismiss">&times;</button>
				</div>
			`;
		}
		return "";
	}

	private dispatchBackToList(): void {
		this.dispatchEvent(new CustomEvent("back-to-list", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-project-detail")) customElements.define("flowti-project-detail", FlowtiProjectDetail);
