import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState } from '../shared-styles.js';

export interface EntityDetailData {
	name: string;
	entityType: string;
	description: string;
	filePath: string | null;
	badges: EntityBadge[];
	infoRows: EntityInfoRow[];
	events: EntityEvent[];
	relatedFlows: EntityRelated[];
	relatedSystems: EntityRelated[];
	relatedActors: EntityRelated[];
	services: string[];
}

export interface EntityBadge {
	text: string;
	variant: 'muted' | 'area' | 'system' | 'accent';
}

export interface EntityInfoRow {
	label: string;
	value: string;
}

export interface EntityEvent {
	type: string;
	category: string;
}

export interface EntityRelated {
	name: string;
}

/**
 * Generic entity detail panel for domains, services, actors, flows, systems.
 *
 * Renders: header with badges, description, info grid, clickable services,
 * events list, related entities, and action buttons.
 *
 * @property entity - The entity data to display (null shows empty state)
 * @property totalCount - Total entity count for empty state
 * @property totalEvents - Total events count for empty state
 * @property totalConfigured - Total configured count for empty state
 * @property emptyLabel - Label for entity type in empty state
 *
 * @fires navigate-event - detail: { type } when an event is clicked
 * @fires navigate-service - detail: { service } when a service is clicked
 * @fires navigate-flow - detail: { name } when a flow entity is clicked
 * @fires navigate-system - detail: { name } when a system entity is clicked
 * @fires navigate-actor - detail: { name } when an actor entity is clicked
 * @fires open-doc - detail: { name, entityType } when open/create doc is clicked
 * @fires create-doc - detail: { name, entityType } when create doc is clicked
 * @fires delete-doc - detail: { name, filePath } when delete is clicked
 * @fires create-area - detail: { name } when mark as area is clicked
 * @fires create-architecture-doc - detail: { name } when architecture doc is clicked
 */
export class FlowtiEntityDetail extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		entity: { type: Object },
		totalCount: { type: Number },
		totalEvents: { type: Number },
		totalConfigured: { type: Number },
		emptyLabel: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		emptyState,
		css`
			.detail-header {
				margin-bottom: var(--flowti-space-md);
			}

			.entity-name {
				font-size: 1.1em;
				font-weight: 600;
				margin-bottom: var(--flowti-space-xs);
			}

			.badge-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				flex-wrap: wrap;
				margin-top: var(--flowti-space-xs);
			}

			.badge {
				display: inline-flex;
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}

			.badge-area {
				background: color-mix(in srgb, var(--flowti-color-warning) 15%, transparent);
				color: var(--flowti-color-warning);
			}

			.badge-system {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				color: var(--flowti-color-info);
			}

			.badge-accent {
				background: color-mix(in srgb, var(--flowti-color-success) 15%, transparent);
				color: var(--flowti-color-success);
			}

			.card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				margin-bottom: var(--flowti-space-md);
			}

			.description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.info-grid {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: var(--flowti-space-xs) var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
			}

			.info-label {
				color: var(--flowti-color-muted);
				font-weight: 500;
			}

			.nav-link {
				color: var(--flowti-color-info);
				cursor: pointer;
				text-decoration: none;
			}

			.nav-link:hover {
				text-decoration: underline;
			}

			.service-list {
				display: flex;
				gap: var(--flowti-space-xs);
				flex-wrap: wrap;
			}

			.actions {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-md);
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}

			.btn-danger {
				color: var(--flowti-color-error);
			}

			.section {
				margin-bottom: var(--flowti-space-md);
			}

			.section-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--flowti-space-sm);
			}

			.section-title {
				font-weight: 600;
				font-size: var(--flowti-font-sm);
			}

			.event-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
			}

			.event-row:hover {
				background: var(--background-modifier-hover);
			}

			.event-type {
				font-family: var(--flowti-font-mono, monospace);
				flex: 1;
			}

			.event-category {
				color: var(--flowti-color-muted);
			}

			.related-section {
				margin-bottom: var(--flowti-space-sm);
			}

			.related-title {
				font-size: var(--flowti-font-sm);
				font-weight: 500;
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-xs);
			}

			.related-chips {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs);
			}

			.stat-row {
				display: flex;
				gap: var(--flowti-space-lg);
				margin-top: var(--flowti-space-md);
			}

			.stat {
				text-align: center;
			}

			.stat-value {
				font-weight: 600;
			}

			.stat-label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}
		`,
	];

	entity: EntityDetailData | null = null;
	totalCount = 0;
	totalEvents = 0;
	totalConfigured = 0;
	emptyLabel = 'entity';

	protected renderContent() {
		if (!this.entity) {
			return this.renderEmptyState();
		}
		return html`
			${this.renderHeader(this.entity)}
			${this.entity.description ? html`<div class="card"><div class="description">${this.entity.description}</div></div>` : nothing}
			${this.renderInfoCard(this.entity)}
			${this.renderActions(this.entity)}
			${this.renderEventsList(this.entity)}
			${this.renderRelatedEntities(this.entity)}
		`;
	}

	private renderEmptyState() {
		return html`
			<div class="empty-state">
				<div class="empty-state__message">Select a ${this.emptyLabel} to view details</div>
				<div class="stat-row">
					<div class="stat">
						<div class="stat-value">${this.totalCount}</div>
						<div class="stat-label">${this.emptyLabel}s</div>
					</div>
					<div class="stat">
						<div class="stat-value">${this.totalEvents}</div>
						<div class="stat-label">events</div>
					</div>
					<div class="stat">
						<div class="stat-value">${this.totalConfigured}</div>
						<div class="stat-label">configured</div>
					</div>
				</div>
			</div>
		`;
	}

	private renderHeader(entity: EntityDetailData) {
		return html`
			<div class="detail-header">
				<div class="entity-name">${entity.name}</div>
				<div class="badge-row">
					${entity.badges.map((b) => html`
						<span class="badge ${b.variant !== 'muted' ? `badge-${b.variant}` : ''}">${b.text}</span>
					`)}
				</div>
			</div>
		`;
	}

	private renderInfoCard(entity: EntityDetailData) {
		return html`
			<div class="card">
				<div class="info-grid">
					${entity.infoRows.map((row) => html`
						<span class="info-label">${row.label}</span>
						<span>${row.value}</span>
					`)}
					${entity.services.length > 0 ? html`
						<span class="info-label">Services</span>
						<div class="service-list">
							${entity.services.map((svc) => html`
								<span class="nav-link" @click=${() => this.emit('navigate-service', { service: svc })}>${svc}</span>
							`)}
						</div>
					` : nothing}
				</div>
			</div>
		`;
	}

	private renderActions(entity: EntityDetailData) {
		return html`
			<div class="actions">
				<span class="nav-link" @click=${() => this.emit(
					entity.filePath ? 'open-doc' : 'create-doc',
					{ name: entity.name, entityType: entity.entityType },
				)}>
					${entity.filePath ? 'Open Doc' : 'Create Doc'}
				</span>
				${entity.entityType === 'domain' ? html`
					<span class="nav-link" @click=${() => this.emit('create-architecture-doc', { name: entity.name })}>
						Architecture Doc
					</span>
					<span class="nav-link" @click=${() => this.emit('create-area', { name: entity.name })}>
						Mark as Area
					</span>
				` : nothing}
				${entity.filePath ? html`
					<button class="btn-danger" @click=${() => this.emit('delete-doc', { name: entity.name, filePath: entity.filePath })}>
						Delete
					</button>
				` : nothing}
			</div>
		`;
	}

	private renderEventsList(entity: EntityDetailData) {
		if (entity.events.length === 0) return nothing;
		return html`
			<div class="section">
				<div class="section-header">
					<span class="section-title">Events (${entity.events.length})</span>
				</div>
				${entity.events.map((event) => html`
					<div class="event-row" @click=${() => this.emit('navigate-event', { type: event.type })}>
						<span class="event-type">${event.type}</span>
						<span class="event-category">${event.category}</span>
					</div>
				`)}
			</div>
		`;
	}

	private renderRelatedEntities(entity: EntityDetailData) {
		const hasRelated = entity.relatedFlows.length > 0 ||
			entity.relatedSystems.length > 0 ||
			entity.relatedActors.length > 0;
		if (!hasRelated) return nothing;

		return html`
			${this.renderRelatedSection('Related Flows', entity.relatedFlows, 'navigate-flow')}
			${this.renderRelatedSection('Related Systems', entity.relatedSystems, 'navigate-system')}
			${this.renderRelatedSection('Related Actors', entity.relatedActors, 'navigate-actor')}
		`;
	}

	private renderRelatedSection(title: string, entities: EntityRelated[], eventName: string) {
		if (entities.length === 0) return nothing;
		return html`
			<div class="related-section">
				<div class="related-title">${title}</div>
				<div class="related-chips">
					${entities.map((e) => html`
						<span class="nav-link" @click=${() => this.emit(eventName, { name: e.name })}>${e.name}</span>
					`)}
				</div>
			</div>
		`;
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(
			new CustomEvent(name, { detail, bubbles: true, composed: true }),
		);
	}
}

if (!customElements.get('flowti-entity-detail')) customElements.define('flowti-entity-detail', FlowtiEntityDetail);
