import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";
import type { CatalogEntity, CatalogEntityDef } from "../../domain/projects/types.js";

const styles = css`
	h3 { font-size: 0.95em; margin: 0 0 8px; color: var(--text-muted, #999); }
	.row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
	.btn {
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
	}
	select, input { font-size: var(--flowti-font-sm, 0.85em); padding: 4px 8px; background: var(--background-primary, #1e1e1e); color: var(--text-normal, #ddd); border: 1px solid var(--background-modifier-border, #333); border-radius: 4px; }
	.list { font-size: var(--flowti-font-sm, 0.85em); }
`;

export class FlowtiTabEventCatalog extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		entities: { type: Array },
	};

	static styles = [tokens, styles];

	projectName = "";
	entities: CatalogEntity[] = [];
	private entityType = "domains";

	protected renderContent() {
		return html`
			<h3>Event catalog</h3>
			<div class="row">
				<select @change="${(e: Event) => { this.entityType = (e.target as HTMLSelectElement).value; this.refresh(); }}">
					<option value="domains">Domains</option>
					<option value="services">Services</option>
					<option value="events">Events</option>
					<option value="flows">Flows</option>
				</select>
				<button type="button" class="btn" @click="${this.refresh}">Refresh</button>
			</div>
			<div class="row">
				<input id="ce-name" placeholder="New entity name" />
				<button type="button" class="btn" @click="${this.createEntity}">Create</button>
			</div>
			<div class="list">
				${this.entities.map((e) => html`<div>${e.name} <span style="opacity:0.6">${e.status}</span></div>`)}
			</div>
		`;
	}

	private refresh = (): void => {
		this.dispatchEvent(new CustomEvent("catalog-list-refresh", { detail: { entityType: this.entityType }, bubbles: true, composed: true }));
	};

	private createEntity = (): void => {
		const input = this.shadowRoot?.getElementById("ce-name") as HTMLInputElement | null;
		const name = input?.value.trim();
		if (!name) return;
		const definition: CatalogEntityDef = { name };
		this.dispatchEvent(new CustomEvent("catalog-entity-create", { detail: { entityType: this.entityType, definition }, bubbles: true, composed: true }));
		if (input) input.value = "";
	};
}

if (!customElements.get("flowti-tab-event-catalog")) customElements.define("flowti-tab-event-catalog", FlowtiTabEventCatalog);
