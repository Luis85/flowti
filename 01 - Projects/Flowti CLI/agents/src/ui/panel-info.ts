/**
 * Info tab — renders agent attributes, meta row, skills, and relationships.
 * Pure presentational Lit component; receives a DashboardAgent as a property.
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles } from "./shared-styles.js";
import type { DashboardAgent } from "../data/types.js";

const ATTR_ENTRIES: ReadonlyArray<readonly [string, keyof NonNullable<DashboardAgent["attributes"]>]> = [
	["STR", "str"],
	["INT", "int"],
	["WIS", "wis"],
	["CHA", "cha"],
	["DEX", "dex"],
	["CON", "con"],
];

@customElement("panel-info")
export class PanelInfo extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				display: block;
			}

			/* Attribute grid */
			.attr-grid {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: 6px;
				margin-bottom: 10px;
			}

			.attr-item {
				text-align: center;
				padding: 4px;
				background: #0f172a;
				border-radius: 4px;
			}

			.attr-label {
				font-size: 10px;
				color: var(--text-dim);
				text-transform: uppercase;
			}

			.attr-value {
				font-size: 14px;
				font-weight: 600;
				color: var(--text-primary);
			}

			/* Meta row */
			.meta-row {
				display: flex;
				gap: 12px;
				margin-bottom: 10px;
				font-size: 12px;
				color: var(--text-secondary);
				flex-wrap: wrap;
			}

			/* Section headings */
			.section-title {
				font-size: 11px;
				font-weight: 600;
				color: var(--text-primary);
				text-transform: uppercase;
				margin-bottom: 4px;
				margin-top: 10px;
			}

			.section-title:first-of-type {
				margin-top: 0;
			}

			/* Skills / relationships list items */
			.list-item {
				font-size: 12px;
				color: var(--text-secondary);
				padding: 2px 0;
			}

			/* Empty state */
			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}
		`,
	];

	@property({ attribute: false }) agent!: DashboardAgent;

	private renderAttributes() {
		const attrs = this.agent.attributes;
		if (!attrs) return null;

		const items = ATTR_ENTRIES
			.filter(([, key]) => attrs[key] !== undefined)
			.map(([label, key]) => html`
				<div class="attr-item">
					<div class="attr-label">${label}</div>
					<div class="attr-value">${attrs[key]}</div>
				</div>
			`);

		if (items.length === 0) return null;

		return html`<div class="attr-grid">${items}</div>`;
	}

	private renderMeta() {
		const { mood, experience, status } = this.agent;
		return html`
			<div class="meta-row">
				${mood ? html`<span>Mood: ${mood}</span>` : null}
				${experience !== undefined ? html`<span>XP: ${experience}</span>` : null}
				<span>Status: ${status}</span>
			</div>
		`;
	}

	private renderSkills() {
		const { skills } = this.agent;
		if (!skills || skills.length === 0) return null;

		return html`
			<div class="section-title">Skills</div>
			${skills.map((s) => html`<div class="list-item">${s.name}: ${s.level}</div>`)}
		`;
	}

	private renderRelationships() {
		const { relationships } = this.agent;
		if (!relationships || relationships.length === 0) return null;

		return html`
			<div class="section-title">Relationships</div>
			${relationships.map((r) => html`<div class="list-item">${r.target} (${r.type})</div>`)}
		`;
	}

	private isEmpty(): boolean {
		const { attributes, mood, experience, skills, relationships } = this.agent;
		const hasAttrs = attributes && Object.values(attributes).some((v) => v !== undefined);
		const hasSkills = skills && skills.length > 0;
		const hasRelationships = relationships && relationships.length > 0;
		return !hasAttrs && mood === undefined && experience === undefined && !hasSkills && !hasRelationships;
	}

	render() {
		if (this.isEmpty()) {
			return html`<div class="empty">No additional information available.</div>`;
		}

		return html`
			${this.renderAttributes()}
			${this.renderMeta()}
			${this.renderSkills()}
			${this.renderRelationships()}
		`;
	}
}
