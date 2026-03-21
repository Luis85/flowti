/**
 * Root Lit component for the Project Detail view.
 * 5-tab router: Overview, Components, Event Catalog, Reporting, Config.
 * Each tab delegates to a dedicated child tab component.
 */

import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { projectDetailStyles } from "./flowti-project-detail-styles.js";
import type { StorybookStatus, ProjectSummary, ProjectConfig, HealthScore, TodoItem, CatalogEntity, ComponentEntry, ReportGeneratorInfo, TeamRoleSlot, VaultAgentSummary } from "../../domain/projects/types.js";

// Side-effect imports to register child custom elements
import "./flowti-tab-overview.js";
import "./flowti-tab-components.js";
import "./flowti-tab-event-catalog.js";
import "./flowti-tab-reporting.js";
import "./flowti-tab-config.js";
import "./flowti-tab-team.js";
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
		roleSlots: { type: Array },
		vaultAgents: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		projectDetailStyles,
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
	roleSlots: TeamRoleSlot[] = [];
	vaultAgents: VaultAgentSummary[] = [];

	protected renderContent() {
		if (!this.projectName) return this.renderProjectList();
		return html`
			${this.renderHeader()}
			${this.renderActivityBar()}
			${this.statusMessage ? html`<div class="status-banner">${this.statusMessage}</div>` : ""}
			${this.renderTabBar()}
			${this.renderActiveTab()}
			${this.showScaffoldModal ? this.renderScaffoldModal() : ""}
		`;
	}

	private renderActiveTab() {
		switch (this.activeTab) {
			case "overview": return html`<flowti-tab-overview .projectName="${this.projectName}" .notePath="${this.notePath}" .brief="${this.brief}" .config="${this.config}" .healthScore="${this.healthScore}" .healthError="${this.healthError}" .todos="${this.todos}" .todosExist="${this.todosExist}"></flowti-tab-overview>`;
			case "components": return html`<flowti-tab-components .projectName="${this.projectName}" .components="${this.components}" .storybookInstalled="${this.storybook?.installed ?? false}" .storybookFramework="${this.storybook?.framework ?? ""}" .storybookRunning="${this.storybook?.running ?? false}" .storybookUrl="${this.storybook?.url ?? ""}" .storybookBusy="${this.storybookBusy}" .storybookBusyLabel="${this.storybookBusyLabel}" .storybookOutput="${this.storybookOutput}" .storybookError="${this.storybookError}" .hasCanvas="${this.hasCanvas}" .hasSitemap="${this.hasSitemap}" .canvasPreset="${this.canvasPreset}" .canvasChanged="${this.canvasChanged}"></flowti-tab-components>`;
			case "catalog": return html`<flowti-tab-event-catalog .projectName="${this.projectName}" .entities="${this.catalogEntities}"></flowti-tab-event-catalog>`;
			case "reporting": return html`<flowti-tab-reporting .projectName="${this.projectName}" .generators="${this.reportGenerators}" .nodeStates="${this.reportNodeStates}" .outputLines="${this.reportOutput}" .busy="${this.reportBusy}"></flowti-tab-reporting>`;
			case "team":
				return html`<flowti-tab-team
					.projectName="${this.projectName}"
					.roleSlots="${this.roleSlots}"
					.vaultAgents="${this.vaultAgents}"
				></flowti-tab-team>`;
			case "config": return html`<flowti-tab-config .projectName="${this.projectName}" .config="${this.config}" .hasCanvas="${this.hasCanvas}"></flowti-tab-config>`;
			default: return "";
		}
	}

	private renderScaffoldModal() {
		return html`<flowti-scaffold-modal .hasSitemap="${this.hasSitemap}" .hasMarkdownSource="${this.hasMarkdownSource}" .hasCanvas="${this.hasCanvas}" .canvasChanged="${this.canvasChanged}"></flowti-scaffold-modal>`;
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
				${tab("team", "Team")}
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
