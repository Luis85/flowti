/**
 * Components tab for the project detail view.
 * Shows the component registry list and wraps the Storybook section.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { ComponentEntry } from "../../domain/projects/types.js";
import "./flowti-storybook-section.js";

const PRESETS = [
	{ id: "web-app", label: "Web App" },
	{ id: "landing", label: "Landing" },
	{ id: "dashboard", label: "Dashboard" },
	{ id: "e-commerce", label: "E-Commerce" },
	{ id: "enterprise", label: "Enterprise" },
	{ id: "cli", label: "CLI" },
	{ id: "obsidian-plugin", label: "Plugin" },
	{ id: "docs", label: "Docs" },
	{ id: "system-design", label: "System" },
	{ id: "service-design", label: "Service" },
	{ id: "product-design", label: "Product" },
];

export class FlowtiTabComponents extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		components: { type: Array },
		storybookInstalled: { type: Boolean },
		storybookFramework: { type: String },
		storybookRunning: { type: Boolean },
		storybookUrl: { type: String },
		storybookBusy: { type: Boolean },
		storybookBusyLabel: { type: String },
		storybookOutput: { type: Array },
		storybookError: { type: String },
		expandedComponent: { type: String },
		hasCanvas: { type: Boolean },
		hasSitemap: { type: Boolean },
		canvasPreset: { type: String },
		canvasChanged: { type: Boolean },
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

			.section-title {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 600;
				color: var(--text-normal);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.registry-section {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
			}

			.component-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				cursor: pointer;
				text-align: left;
				color: var(--text-normal);
				font-size: var(--flowti-font-sm, 0.85em);
				width: 100%;
				box-sizing: border-box;
			}

			.component-row:hover {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
			}

			.component-row--expanded {
				border-color: var(--interactive-accent, #7c3aed);
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 8%, transparent);
			}

			.component-name {
				flex: 1;
				font-weight: 500;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.category-badge {
				display: inline-block;
				padding: 1px 7px;
				border-radius: 10px;
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
				color: var(--interactive-accent, #7c3aed);
				font-size: 0.78em;
				font-weight: 500;
				flex-shrink: 0;
			}

			.meta {
				display: flex;
				gap: var(--flowti-space-xs, 4px);
				color: var(--text-faint, #666);
				font-size: 0.78em;
				flex-shrink: 0;
			}

			.meta-item {
				white-space: nowrap;
			}

			.component-detail {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border: 1px solid var(--background-modifier-border, #444);
				border-top: none;
				border-radius: 0 0 var(--flowti-radius-sm, 4px) var(--flowti-radius-sm, 4px);
				background: var(--background-primary, #1e1e1e);
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-muted);
			}

			.detail-row {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.detail-label {
				color: var(--text-faint, #666);
				min-width: 80px;
			}

			.empty-state {
				padding: var(--flowti-space-lg, 24px) var(--flowti-space-md, 16px);
				text-align: center;
				color: var(--text-muted);
				font-size: var(--flowti-font-sm, 0.85em);
				border: 1px dashed var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
			}

			.divider {
				border: none;
				border-top: 1px solid var(--background-modifier-border, #333);
				margin: var(--flowti-space-xs, 4px) 0;
			}

			.storybook-wrapper {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm, 8px);
			}

			.refresh-btn, .preset-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none; color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em); cursor: pointer;
			}
			.refresh-btn:hover, .preset-btn:hover {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
				color: var(--interactive-accent, #7c3aed);
			}
			.preset-row { display: flex; flex-wrap: wrap; gap: var(--flowti-space-xs, 4px); }
			.preset-btn--active { background: var(--interactive-accent, #7c3aed); color: var(--text-on-accent, #fff); border-color: var(--interactive-accent, #7c3aed); }
			.canvas-actions { display: flex; align-items: center; gap: var(--flowti-space-sm, 8px); margin-top: var(--flowti-space-sm, 8px); }
			.canvas-merge-btn { padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px); border-radius: var(--flowti-radius-sm, 4px); border: 1px solid var(--interactive-accent, #7c3aed); background: var(--interactive-accent, #7c3aed); color: var(--text-on-accent, #fff); font-size: var(--flowti-font-sm, 0.85em); font-weight: 500; cursor: pointer; }
			.canvas-merge-btn:hover { opacity: 0.9; }
			.canvas-open-btn { padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px); border-radius: var(--flowti-radius-sm, 4px); border: 1px solid var(--background-modifier-border, #444); background: none; color: var(--text-normal, #ddd); font-size: var(--flowti-font-sm, 0.85em); cursor: pointer; }
			.canvas-open-btn:hover { background: var(--background-modifier-hover, #333); }
			.canvas-changed-badge { padding: 2px 8px; border-radius: 12px; font-size: var(--flowti-font-xs, 0.75em); background: #422006; color: #f59e0b; font-weight: 600; }
			.registry-header { display: flex; align-items: center; justify-content: space-between; }
		`,
	];

	projectName = "";
	components: ComponentEntry[] = [];
	storybookInstalled = false;
	storybookFramework = "";
	storybookRunning = false;
	storybookUrl = "";
	storybookBusy = false;
	storybookBusyLabel = "";
	storybookOutput: string[] = [];
	storybookError = "";
	expandedComponent: string | null = null;
	hasCanvas = false;
	hasSitemap = false;
	canvasPreset = "";
	canvasChanged = false;

	protected renderContent() {
		return html`
			${this.renderCanvasSection()}
			${this.renderRegistry()}
			<hr class="divider" />
			${this.renderStorybook()}
		`;
	}

	private renderCanvasSection() {
		return html`
			<div class="registry-section">
				<div class="section-title">Sitemap Canvas</div>
				<div class="preset-row">
					${PRESETS.map((p) => html`
						<button class="preset-btn ${this.canvasPreset === p.id ? "preset-btn--active" : ""}"
							@click="${() => { this.canvasPreset = p.id; this.fire("canvas-generate", { preset: p.id }); }}"
						>${p.label}</button>
					`)}
				</div>
				${this.hasCanvas ? html`
					<div class="canvas-actions">
						<button class="canvas-merge-btn"
							@click="${() => this.fire("canvas-merge")}"
						>${this.hasSitemap ? "Merge to sitemap.json" : "Save as sitemap.json"}</button>
						<button class="canvas-open-btn"
							@click="${() => this.fire("canvas-open")}"
						>Open canvas</button>
						${this.canvasChanged ? html`<span class="canvas-changed-badge">changed</span>` : nothing}
					</div>
				` : nothing}
			</div>
		`;
	}

	private renderRegistry() {
		return html`
			<div class="registry-section">
				<div class="registry-header">
					<div class="section-title">Component Registry</div>
					<button class="refresh-btn" @click="${() => this.fire("components-refresh")}">Refresh</button>
				</div>
				${this.components.length === 0
					? html`<div class="empty-state">Configure component source in Config tab</div>`
					: this.components.map((c) => this.renderComponentRow(c))
				}
			</div>
		`;
	}

	private renderComponentRow(component: ComponentEntry) {
		const isExpanded = this.expandedComponent === component.name;
		return html`
			<button
				class="component-row ${isExpanded ? "component-row--expanded" : ""}"
				@click="${() => this.toggleExpand(component.name)}"
			>
				<span class="component-name">${component.name}</span>
				<span class="category-badge">${component.category}</span>
				<span class="meta">
					<span class="meta-item">${component.propCount}p</span>
					<span class="meta-item">${component.slotCount}s</span>
				</span>
			</button>
			${isExpanded ? this.renderComponentDetail(component) : ""}
		`;
	}

	private renderComponentDetail(component: ComponentEntry) {
		return html`
			<div class="component-detail">
				<div class="detail-row">
					<span class="detail-label">Category</span>
					<span>${component.category}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Props</span>
					<span>${component.propCount}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Slots</span>
					<span>${component.slotCount}</span>
				</div>
				${component.status ? html`
					<div class="detail-row">
						<span class="detail-label">Status</span>
						<span>${component.status}</span>
					</div>
				` : ""}
			</div>
		`;
	}

	private renderStorybook() {
		return html`
			<div class="storybook-wrapper">
				<div class="section-title">Storybook</div>
				<flowti-storybook-section
					.installed="${this.storybookInstalled}"
					.framework="${this.storybookFramework}"
					.running="${this.storybookRunning}"
					.url="${this.storybookUrl}"
					.busy="${this.storybookBusy}"
					.busyLabel="${this.storybookBusyLabel}"
					.outputLines="${this.storybookOutput}"
					.errorNote="${this.storybookError}"
				></flowti-storybook-section>
			</div>
		`;
	}

	private toggleExpand(name: string): void {
		this.expandedComponent = this.expandedComponent === name ? null : name;
	}

	private fire(name: string, detail?: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-components")) customElements.define("flowti-tab-components", FlowtiTabComponents);
