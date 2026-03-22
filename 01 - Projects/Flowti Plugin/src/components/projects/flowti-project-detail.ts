/**
 * Root Lit component for the Project Detail view.
 * 6-tab router: Overview, Components, Event Catalog, Reporting, Team, Config.
 * Each tab delegates to a dedicated child tab component.
 */

import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { hubButton, emptyState } from "../shared-styles.js";
import { projectDetailStyles } from "./flowti-project-detail-styles.js";
import type { StorybookStatus, ProjectSummary, ProjectConfig, HealthScore, TodoItem, CatalogEntity, ComponentEntry, ReportGeneratorInfo, TeamRoleSlot, VaultAgentSummary, GitDetectResult, ProjectBrief } from "../../domain/projects/types.js";

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
		/** Long-running work outside Components (team, config, canvas, git, …). */
		projectHubBusy: { type: Boolean },
		projectHubBusyLabel: { type: String },
		projectHubOutput: { type: Array },
		projectHubError: { type: String },
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
		gitImportStep: { type: String },
		gitImportError: { type: String },
		gitImportOutputLines: { type: Array },
		gitImportDetected: { type: Object },
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
		/** Set while "Create agent from role" is running (highlights the role card). */
		agentCreationContext: { type: Object },
		configSaveStatus: { type: String },
		configSourcePath: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		hubButton,
		emptyState,
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
	projectHubBusy = false;
	projectHubBusyLabel = "";
	projectHubOutput: string[] = [];
	projectHubError = "";
	actionSuccess = "";
	config: ProjectConfig | undefined = undefined;
	activeTab = "overview";
	showScaffoldModal = false;
	hasSitemap = false;
	hasMarkdownSource = false;
	hasCanvas = false;
	canvasChanged = false;
	canvasPreset = "";
	brief: ProjectBrief | undefined = undefined;
	showGitModal = false;
	gitModalMode: "submodule" | "template" = "submodule";
	gitImportStep: "form" | "progress" | "detect" | "configure" | "done" = "form";
	gitImportError = "";
	gitImportOutputLines: string[] = [];
	gitImportDetected: GitDetectResult | null = null;
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
	agentCreationContext: { roleId: string; agentName: string } | null = null;
	configSaveStatus = "";
	configSourcePath = "";

	protected renderContent() {
		if (!this.projectName) return this.renderProjectList();
		return html`
			${this.renderHeader()}
			${this.renderTabBar()}
			${this.renderActivityBar()}
			${this.statusMessage
				? html`<div class="status-banner" role="status" aria-live="polite">${this.statusMessage}</div>`
				: ""}
			${this.renderActiveTab()}
			${this.renderStorybookCliLog()}
			${this.renderProjectHubLog()}
			${this.showScaffoldModal ? this.renderScaffoldModal() : ""}
		`;
	}

	private renderActiveTab() {
		switch (this.activeTab) {
			case "overview":
				return html`<flowti-tab-overview
					.projectName="${this.projectName}"
					.notePath="${this.notePath}"
					.brief="${this.brief}"
					.config="${this.config}"
					.healthScore="${this.healthScore}"
					.healthError="${this.healthError}"
					.todos="${this.todos}"
					.todosExist="${this.todosExist}"
					.hubLocked="${this.projectHubBusy}"
					.hasSitemap="${this.hasSitemap}"
					.hasCanvas="${this.hasCanvas}"
					.canvasChanged="${this.canvasChanged}"
					.canvasPreset="${this.canvasPreset}"
				></flowti-tab-overview>`;
			case "components": return html`<flowti-tab-components .projectName="${this.projectName}" .components="${this.components}" .storybookInstalled="${this.storybook?.installed ?? false}" .storybookFramework="${this.storybook?.framework ?? ""}" .storybookRunning="${this.storybook?.running ?? false}" .storybookUrl="${this.storybook?.url ?? ""}" .storybookBusy="${this.storybookBusy}" .storybookBusyLabel="${this.storybookBusyLabel}" .storybookError="${this.storybookError}" .hasSitemap="${this.hasSitemap}"></flowti-tab-components>`;
			case "catalog": return html`<flowti-tab-event-catalog .projectName="${this.projectName}" .entities="${this.catalogEntities}"></flowti-tab-event-catalog>`;
			case "reporting": return html`<flowti-tab-reporting .projectName="${this.projectName}" .generators="${this.reportGenerators}" .nodeStates="${this.reportNodeStates}" .outputLines="${this.reportOutput}" .busy="${this.reportBusy}"></flowti-tab-reporting>`;
			case "team":
				return html`<flowti-tab-team
					.projectName="${this.projectName}"
					.roleSlots="${this.roleSlots}"
					.vaultAgents="${this.vaultAgents}"
					.actionsLocked="${this.projectHubBusy}"
					.hubBusy="${this.projectHubBusy}"
					.hubBusyLabel="${this.projectHubBusyLabel}"
					.hubOutputLines="${this.projectHubOutput}"
					.agentCreationContext="${this.agentCreationContext}"
				></flowti-tab-team>`;
			case "config":
				return html`<flowti-tab-config
					.projectName="${this.projectName}"
					.config="${this.config}"
					.hasCanvas="${this.hasCanvas}"
					.hubLocked="${this.projectHubBusy}"
					.saveStatus="${this.configSaveStatus}"
					.sourcePath="${this.configSourcePath}"
				></flowti-tab-config>`;
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
				: html`<div class="project-list">${filtered.map((p, i) => this.renderProjectItem(p, i))}</div>`
			}
			${this.showGitModal ? html`
				<flowti-git-import-modal
					.mode="${this.gitModalMode}"
					.step="${this.gitImportStep}"
					.errorNote="${this.gitImportError}"
					.outputLines="${this.gitImportOutputLines}"
					.detected="${this.gitImportDetected}"
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
							@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter") this.submitNamePrompt(); }}"
						/>
					</div>
					<div class="modal-actions">
						<button class="hub-btn" @click="${() => { this.showNamePrompt = false; }}">Cancel</button>
						<button class="hub-btn hub-btn--primary" @click="${() => this.submitNamePrompt()}">Create</button>
					</div>
				</div>
			</div>
		`;
	}

	private submitNamePrompt(): void {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>(".overlay .search-input");
		const name = input?.value.trim();
		if (!name) return;
		this.showNamePrompt = false;
		this.dispatchEvent(new CustomEvent("create-empty-project", { detail: { name }, bubbles: true, composed: true }));
	}

	private renderProjectItem(p: ProjectSummary, index = 0) {
		return html`
			<button class="project-item" style="--i: ${index}" @click="${() => this.selectProject(p.name)}">
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
		if (this.projectHubBusy) {
			return html`
				<div class="activity-bar activity-bar--busy" role="status" aria-live="polite">
					<span class="activity-spinner"></span>
					<span>${this.projectHubBusyLabel || "Working…"}</span>
				</div>
			`;
		}
		if (this.projectHubError) {
			return html`
				<div class="activity-bar activity-bar--error" role="alert">
					<span>${this.projectHubError}</span>
					<button class="activity-dismiss" @click="${() => { this.projectHubError = ""; }}" title="Dismiss">&times;</button>
				</div>
			`;
		}
		if (this.actionSuccess) {
			return html`
				<div class="activity-bar activity-bar--success" role="status">
					<span>${this.actionSuccess}</span>
					<button class="activity-dismiss" @click="${() => { this.actionSuccess = ""; }}" title="Dismiss">&times;</button>
				</div>
			`;
		}
		return "";
	}

	private renderStorybookCliLog() {
		if (!this.storybookBusy && this.storybookOutput.length === 0) return "";
		const body = this.storybookOutput.length > 0
			? this.storybookOutput.join("\n")
			: (this.storybookBusy ? "Waiting for CLI output…" : "");
		return html`
			<div class="hub-cli-log hub-cli-log--storybook" role="region" aria-label="Storybook CLI output">
				<div class="hub-cli-log__head">
					<span class="hub-cli-log__title">Storybook CLI output</span>
					<button type="button" class="hub-cli-log__clear" @click="${this.clearStorybookSurfaceLog}">Clear</button>
				</div>
				<pre class="hub-cli-log__pre">${body}</pre>
			</div>
		`;
	}

	private clearStorybookSurfaceLog(): void {
		this.dispatchEvent(new CustomEvent("storybook-dismiss-output", { bubbles: true, composed: true }));
	}

	private renderProjectHubLog() {
		if (!this.projectHubBusy && this.projectHubOutput.length === 0) return "";
		const body = this.projectHubOutput.length > 0
			? this.projectHubOutput.join("\n")
			: (this.projectHubBusy ? "Waiting for output…" : "");
		return html`
			<div class="hub-cli-log ${this.projectHubBusy ? "hub-cli-log--active" : ""}" role="region" aria-label="Project CLI output">
				<div class="hub-cli-log__head">
					<span class="hub-cli-log__title">Project CLI output</span>
					<button type="button" class="hub-cli-log__clear" ?disabled="${this.projectHubBusy}" @click="${this.clearProjectHubLog}">Clear</button>
				</div>
				<pre class="hub-cli-log__pre">${body}</pre>
			</div>
		`;
	}

	private clearProjectHubLog(): void {
		this.projectHubOutput = [];
	}

	private dispatchBackToList(): void {
		this.dispatchEvent(new CustomEvent("back-to-list", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-project-detail")) customElements.define("flowti-project-detail", FlowtiProjectDetail);
