/**
 * Event Catalog tab for the project detail view.
 * Sub-tabs for Domains, Services, Events, and Flows.
 * Entity list display and add forms for creating new catalog entities.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { CatalogEntity, CatalogEntityType } from "../../domain/projects/types.js";

const SUB_TABS: { id: CatalogEntityType; label: string }[] = [
	{ id: "domains", label: "Domains" },
	{ id: "services", label: "Services" },
	{ id: "events", label: "Events" },
	{ id: "flows", label: "Flows" },
];

export class FlowtiTabEventCatalog extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		entities: { type: Array },
		activeSubTab: { type: String },
		showAddForm: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 16px);
			}

			/* ── Sub-tab bar ──────────────────────────────────── */

			.sub-tab-bar {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
			}

			.sub-tab {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: none;
				border-bottom: 2px solid transparent;
				background: none;
				color: var(--text-muted, #999);
				font-size: 0.8em;
				cursor: pointer;
			}

			.sub-tab:hover {
				color: var(--text-normal, #ddd);
			}

			.sub-tab--active {
				color: var(--interactive-accent, #7c3aed);
				border-bottom-color: var(--interactive-accent, #7c3aed);
				font-weight: 500;
			}

			/* ── Entity list ──────────────────────────────────── */

			.entity-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
			}

			.entity-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius, 4px);
				cursor: pointer;
			}

			.entity-row:hover {
				background: var(--background-modifier-hover, #333);
			}

			.entity-name {
				flex: 1;
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-normal, #ddd);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.entity-badge {
				padding: 1px 8px;
				border-radius: 10px;
				font-size: 0.75em;
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 20%, transparent);
				color: var(--interactive-accent, #7c3aed);
			}

			.entity-domain {
				font-size: 0.75em;
				color: var(--text-muted, #999);
				padding: 1px 6px;
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: 8px;
			}

			.entity-date {
				font-size: 0.75em;
				color: var(--text-faint, #666);
				flex-shrink: 0;
			}

			.empty-state {
				padding: var(--flowti-space-lg, 24px);
				text-align: center;
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			/* ── Add button and form ─────────────────────────── */

			.add-entity-btn {
				align-self: flex-start;
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.add-entity-btn:hover {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
				color: var(--interactive-accent, #7c3aed);
			}

			.add-form {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-md, 16px);
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius, 4px);
				background: var(--background-primary, #1e1e1e);
			}

			.form-field {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.form-label {
				font-size: 0.75em;
				color: var(--text-muted, #999);
				font-weight: 500;
			}

			.form-input {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius, 4px);
				background: var(--background-primary, #1e1e1e);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.form-input:focus {
				outline: none;
				border-color: var(--interactive-accent, #7c3aed);
			}

			.form-actions {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				justify-content: flex-end;
				padding-top: var(--flowti-space-xs, 4px);
			}

			.entity-submit-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--interactive-accent, #7c3aed);
				background: var(--interactive-accent, #7c3aed);
				color: var(--text-on-accent, #fff);
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				cursor: pointer;
			}

			.entity-submit-btn:hover {
				opacity: 0.9;
			}

			.cancel-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.cancel-btn:hover {
				background: var(--background-modifier-hover, #333);
			}
		`,
	];

	projectName = "";
	entities: CatalogEntity[] = [];
	activeSubTab: CatalogEntityType = "domains";
	showAddForm = false;

	protected renderContent() {
		return html`
			${this.renderSubTabs()}
			${this.renderEntityList()}
			${this.showAddForm ? this.renderAddForm() : html`
				<button class="add-entity-btn" @click="${this.toggleAddForm}">Add ${this.activeTabLabel()}</button>
			`}
		`;
	}

	private renderSubTabs() {
		return html`
			<div class="sub-tab-bar">
				${SUB_TABS.map((tab) => html`
					<button
						class="sub-tab ${this.activeSubTab === tab.id ? "sub-tab--active" : ""}"
						@click="${() => this.switchSubTab(tab.id)}"
					>${tab.label}</button>
				`)}
			</div>
		`;
	}

	private renderEntityList() {
		const filtered = this.filteredEntities();
		if (filtered.length === 0) {
			return html`<div class="empty-state">No ${this.activeSubTab} yet. Add one to get started.</div>`;
		}
		return html`
			<div class="entity-list">
				${filtered.map((entity) => html`
					<div class="entity-row" @click="${() => this.openEntity(entity)}">
						<span class="entity-name">${entity.name}</span>
						<span class="entity-badge">${entity.status}</span>
						${entity.domain ? html`<span class="entity-domain">${entity.domain}</span>` : nothing}
						<span class="entity-date">${entity.date}</span>
					</div>
				`)}
			</div>
		`;
	}

	private renderAddForm() {
		return html`
			<div class="add-form">
				${this.renderFormFields()}
				<div class="form-actions">
					<button class="cancel-btn" @click="${this.toggleAddForm}">Cancel</button>
					<button class="entity-submit-btn" @click="${this.submitForm}">Create</button>
				</div>
			</div>
		`;
	}

	private renderFormFields() {
		switch (this.activeSubTab) {
			case "domains":
				return html`
					${this.renderField("Name", "entity-name-input")}
					${this.renderField("Status", "entity-status-input")}
					${this.renderField("Description", "entity-description-input")}
				`;
			case "services":
				return html`
					${this.renderField("Name", "entity-name-input")}
					${this.renderField("Domain", "entity-domain-input")}
					${this.renderField("Status", "entity-status-input")}
					${this.renderField("Description", "entity-description-input")}
					${this.renderField("Produces", "entity-produces-input")}
					${this.renderField("Consumers", "entity-consumers-input")}
				`;
			case "events":
				return html`
					${this.renderField("Name", "entity-name-input")}
					${this.renderField("Domain", "entity-domain-input")}
					${this.renderField("Version", "entity-version-input")}
					${this.renderField("Status", "entity-status-input")}
					${this.renderField("Description", "entity-description-input")}
					${this.renderField("Producers", "entity-producers-input")}
					${this.renderField("Consumers", "entity-consumers-input")}
				`;
			case "flows":
				return html`
					${this.renderField("Name", "entity-name-input")}
					${this.renderField("Domain", "entity-domain-input")}
					${this.renderField("Status", "entity-status-input")}
					${this.renderField("Description", "entity-description-input")}
				`;
			default:
				return nothing;
		}
	}

	private renderField(label: string, className: string) {
		return html`
			<div class="form-field">
				<span class="form-label">${label}</span>
				<input class="form-input ${className}" type="text" placeholder="${label}" />
			</div>
		`;
	}

	private filteredEntities(): CatalogEntity[] {
		return this.entities;
	}

	private activeTabLabel(): string {
		const tab = SUB_TABS.find((t) => t.id === this.activeSubTab);
		return tab ? tab.label.slice(0, -1) : "Entity";
	}

	private switchSubTab(tab: CatalogEntityType): void {
		this.activeSubTab = tab;
		this.showAddForm = false;
		this.dispatchEvent(new CustomEvent("catalog-list-refresh", {
			detail: { entityType: tab },
			bubbles: true,
			composed: true,
		}));
	}

	private toggleAddForm(): void {
		this.showAddForm = !this.showAddForm;
	}

	private openEntity(entity: CatalogEntity): void {
		this.dispatchEvent(new CustomEvent("open-project-note", {
			detail: { path: entity.path },
			bubbles: true,
			composed: true,
		}));
	}

	private submitForm(): void {
		const shadow = this.shadowRoot;
		if (!shadow) return;

		const nameInput = shadow.querySelector(".entity-name-input") as HTMLInputElement | null;
		const name = nameInput?.value?.trim() ?? "";
		if (!name) return;

		const getValue = (cls: string): string | undefined => {
			const input = shadow.querySelector(`.${cls}`) as HTMLInputElement | null;
			const val = input?.value?.trim();
			return val || undefined;
		};

		const definition: Record<string, string | undefined> = { name };

		switch (this.activeSubTab) {
			case "domains":
				definition.status = getValue("entity-status-input");
				definition.description = getValue("entity-description-input");
				break;
			case "services":
				definition.domain = getValue("entity-domain-input");
				definition.status = getValue("entity-status-input");
				definition.description = getValue("entity-description-input");
				definition.produces = getValue("entity-produces-input");
				definition.consumers = getValue("entity-consumers-input");
				break;
			case "events":
				definition.domain = getValue("entity-domain-input");
				definition.version = getValue("entity-version-input");
				definition.status = getValue("entity-status-input");
				definition.description = getValue("entity-description-input");
				definition.producers = getValue("entity-producers-input");
				definition.consumers = getValue("entity-consumers-input");
				break;
			case "flows":
				definition.domain = getValue("entity-domain-input");
				definition.status = getValue("entity-status-input");
				definition.description = getValue("entity-description-input");
				break;
		}

		this.dispatchEvent(new CustomEvent("catalog-entity-create", {
			detail: { entityType: this.activeSubTab, definition },
			bubbles: true,
			composed: true,
		}));

		this.showAddForm = false;
	}
}

if (!customElements.get("flowti-tab-event-catalog")) customElements.define("flowti-tab-event-catalog", FlowtiTabEventCatalog);
