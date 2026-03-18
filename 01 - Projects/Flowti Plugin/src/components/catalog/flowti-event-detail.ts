import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState } from '../shared-styles.js';

export interface EventDetailEntry {
	type: string;
	description: string;
	category: string;
	domain: string;
	services: string;
	direction: string;
	stability: string;
	visibility: string;
	tags: string[];
	isCustom: boolean;
	isFollowed: boolean;
	isExcluded: boolean;
}

export interface EventWatcher {
	id: string;
	label: string;
	eventType: string;
	enabled: boolean;
	filters: { pathPattern?: string; extension?: string; namePattern?: string };
}

export interface EventTransform {
	id: string;
	sourceEventType: string;
	domainEventName: string;
	filePattern: string;
	emissionPolicy: string;
	enabled: boolean;
}

export interface RelatedEntity {
	name: string;
	type: string;
}

/**
 * Event detail panel — shows full event information including header,
 * info card, watchers, transforms, and related entities.
 *
 * @property entry - The event entry to display (null shows empty state)
 * @property watchers - Array of subscription watchers for this event
 * @property transforms - Array of event definition transforms for this event
 * @property relatedFlows - Related flow entities
 * @property relatedSystems - Related system entities
 * @property relatedActors - Related actor entities
 * @property totalEvents - Total event count (for empty state)
 * @property configuredCount - Configured event count (for empty state)
 * @property followedCount - Followed event count (for empty state)
 *
 * @fires navigate-domain - detail: { domain } when domain link is clicked
 * @fires navigate-service - detail: { service } when service link is clicked
 * @fires navigate-flow - detail: { name } when a flow entity is clicked
 * @fires navigate-system - detail: { name } when a system entity is clicked
 * @fires navigate-actor - detail: { name } when an actor entity is clicked
 * @fires toggle-follow - detail: { eventType } when follow button is clicked
 * @fires toggle-visibility - detail: { eventType } when visibility button is clicked
 * @fires open-doc - detail: { eventType } when event doc link is clicked
 * @fires open-source - detail: { eventType } when source link is clicked
 * @fires delete-event - detail: { eventType } when delete is clicked
 * @fires add-watcher - detail: { eventType } when add watcher is clicked
 * @fires edit-watcher - detail: { watcherId, eventType } when edit watcher is clicked
 * @fires toggle-watcher - detail: { watcherId, enabled } when watcher toggle is clicked
 * @fires delete-watcher - detail: { watcherId } when watcher delete is clicked
 * @fires add-transform - detail: { eventType } when add transform is clicked
 * @fires edit-transform - detail: { transformId, eventType } when edit transform is clicked
 * @fires toggle-transform - detail: { transformId, enabled } when transform toggle is clicked
 * @fires delete-transform - detail: { transformId } when transform delete is clicked
 */
export class FlowtiEventDetail extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		entry: { type: Object },
		watchers: { type: Array },
		transforms: { type: Array },
		relatedFlows: { type: Array },
		relatedSystems: { type: Array },
		relatedActors: { type: Array },
		totalEvents: { type: Number },
		configuredCount: { type: Number },
		followedCount: { type: Number },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		emptyState,
		css`
			.detail-header {
				margin-bottom: var(--flowti-space-md);
			}

			.event-type-name {
				font-size: 1.1em;
				font-weight: 600;
				font-family: var(--flowti-font-mono, monospace);
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

			.badge-tag {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				color: var(--flowti-color-info);
			}

			.info-card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				margin-bottom: var(--flowti-space-md);
			}

			.description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-sm);
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

			.btn-primary {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
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

			.row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
			}

			.row:hover {
				background: var(--background-modifier-hover);
			}

			.row-label {
				font-weight: 500;
			}

			.row-meta {
				color: var(--flowti-color-muted);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.row-spacer {
				flex: 1;
			}

			.row-actions {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
			}

			.icon-btn {
				padding: 2px 4px;
				border: none;
				background: none;
				cursor: pointer;
				color: var(--flowti-color-muted);
				border-radius: var(--flowti-radius);
			}

			.icon-btn:hover {
				background: var(--background-modifier-hover);
				color: var(--flowti-text, inherit);
			}

			.icon-btn--off {
				opacity: 0.5;
			}

			.transform-arrow {
				color: var(--flowti-color-muted);
			}

			.domain-event-name {
				font-family: var(--flowti-font-mono, monospace);
				color: var(--flowti-color-info);
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

			.muted-text {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				padding: var(--flowti-space-sm);
			}
		`,
	];

	entry: EventDetailEntry | null = null;
	watchers: EventWatcher[] = [];
	transforms: EventTransform[] = [];
	relatedFlows: RelatedEntity[] = [];
	relatedSystems: RelatedEntity[] = [];
	relatedActors: RelatedEntity[] = [];
	totalEvents = 0;
	configuredCount = 0;
	followedCount = 0;

	protected renderContent() {
		if (!this.entry) {
			return this.renderEmptyState();
		}
		return html`
			${this.renderHeader(this.entry)}
			${this.renderInfoCard(this.entry)}
			${this.renderActions(this.entry)}
			${this.renderWatchers(this.entry)}
			${this.renderTransforms(this.entry)}
			${this.renderRelatedEntities()}
		`;
	}

	private renderEmptyState() {
		return html`
			<div class="empty-state">
				<div class="empty-state__message">Select an event to view details</div>
				<div class="stat-row">
					<div class="stat">
						<div class="stat-value">${this.totalEvents}</div>
						<div class="stat-label">events</div>
					</div>
					<div class="stat">
						<div class="stat-value">${this.configuredCount}</div>
						<div class="stat-label">configured</div>
					</div>
					<div class="stat">
						<div class="stat-value">${this.followedCount}</div>
						<div class="stat-label">followed</div>
					</div>
				</div>
			</div>
		`;
	}

	private renderHeader(entry: EventDetailEntry) {
		return html`
			<div class="detail-header">
				<div class="event-type-name">${entry.type}</div>
				<div class="badge-row">
					<span class="badge">${entry.category}</span>
					${entry.stability ? html`<span class="badge">${entry.stability}</span>` : nothing}
					${entry.tags.map((tag) => html`<span class="badge badge-tag">${tag}</span>`)}
				</div>
			</div>
		`;
	}

	private renderInfoCard(entry: EventDetailEntry) {
		return html`
			<div class="info-card">
				${entry.description ? html`<div class="description">${entry.description}</div>` : nothing}
				<div class="info-grid">
					<span class="info-label">Direction</span>
					<span>${entry.direction}</span>
					<span class="info-label">Domain</span>
					<span class="nav-link" @click=${() => this.emit('navigate-domain', { domain: entry.domain })}>${entry.domain}</span>
					<span class="info-label">Services</span>
					<span class="nav-link" @click=${() => this.emit('navigate-service', { service: entry.services })}>${entry.services}</span>
					${entry.stability ? html`
						<span class="info-label">Stability</span>
						<span>${entry.stability}</span>
					` : nothing}
					${entry.visibility ? html`
						<span class="info-label">Visibility</span>
						<span>${entry.visibility}</span>
					` : nothing}
				</div>
			</div>
		`;
	}

	private renderActions(entry: EventDetailEntry) {
		return html`
			<div class="actions">
				<span class="nav-link" @click=${() => this.emit('open-doc', { eventType: entry.type })}>
					Event Doc
				</span>
				<button class="${entry.isFollowed ? 'btn-primary' : ''}"
					title="${entry.isFollowed ? 'Currently following' : 'Follow this event'}"
					@click=${() => this.emit('toggle-follow', { eventType: entry.type })}>
					${entry.isFollowed ? 'Following' : 'Follow'}
				</button>
				<button title="${entry.isExcluded ? 'Hidden from Activity Log' : 'Visible in Activity Log'}"
					@click=${() => this.emit('toggle-visibility', { eventType: entry.type })}>
					${entry.isExcluded ? 'Hidden from Log' : 'In Activity Log'}
				</button>
				${entry.isCustom ? html`
					<span class="nav-link" @click=${() => this.emit('open-source', { eventType: entry.type })}>
						Source
					</span>
					<button class="btn-danger" @click=${() => this.emit('delete-event', { eventType: entry.type })}>
						Delete
					</button>
				` : nothing}
			</div>
		`;
	}

	private renderWatchers(entry: EventDetailEntry) {
		return html`
			<div class="section">
				<div class="section-header">
					<span class="section-title">Watchers (${this.watchers.length})</span>
					<button @click=${() => this.emit('add-watcher', { eventType: entry.type })}>Add watcher</button>
				</div>
				${this.watchers.length === 0
					? html`<div class="muted-text">No watchers configured for this event.</div>`
					: this.watchers.map((w) => this.renderWatcherRow(w))}
			</div>
		`;
	}

	private renderWatcherRow(watcher: EventWatcher) {
		const filterParts: string[] = [];
		if (watcher.filters.pathPattern) filterParts.push(`path: ${watcher.filters.pathPattern}`);
		if (watcher.filters.extension) filterParts.push(`ext: ${watcher.filters.extension}`);
		if (watcher.filters.namePattern) filterParts.push(`name: ${watcher.filters.namePattern}`);

		return html`
			<div class="row">
				<span class="row-label">${watcher.label || watcher.eventType}</span>
				${filterParts.length > 0
					? html`<span class="row-meta">${filterParts.join(', ')}</span>`
					: nothing}
				<span class="row-spacer"></span>
				<div class="row-actions">
					<span class="icon-btn ${watcher.enabled ? '' : 'icon-btn--off'}"
						title="${watcher.enabled ? 'Disable' : 'Enable'}"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('toggle-watcher', { watcherId: watcher.id, enabled: !watcher.enabled }); }}>
						${watcher.enabled ? '\u2713' : '\u25CB'}
					</span>
					<span class="icon-btn" title="Edit watcher"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('edit-watcher', { watcherId: watcher.id, eventType: watcher.eventType }); }}>
						\u270E
					</span>
					<span class="icon-btn" title="Delete watcher"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('delete-watcher', { watcherId: watcher.id }); }}>
						\u2715
					</span>
				</div>
			</div>
		`;
	}

	private renderTransforms(entry: EventDetailEntry) {
		return html`
			<div class="section">
				<div class="section-header">
					<span class="section-title">Transforms (${this.transforms.length})</span>
					<button @click=${() => this.emit('add-transform', { eventType: entry.type })}>Add transform</button>
				</div>
				${this.transforms.length === 0
					? html`<div class="muted-text">No transforms configured for this event.</div>`
					: this.transforms.map((t) => this.renderTransformRow(t))}
			</div>
		`;
	}

	private renderTransformRow(transform: EventTransform) {
		const meta: string[] = [];
		if (transform.filePattern) meta.push(transform.filePattern);
		meta.push(transform.emissionPolicy === 'once' ? 'once' : 'always');

		return html`
			<div class="row">
				<span class="transform-arrow">\u2192</span>
				<span class="domain-event-name">${transform.domainEventName}</span>
				<span class="row-meta">${meta.join(' \u00B7 ')}</span>
				<span class="row-spacer"></span>
				<div class="row-actions">
					<span class="icon-btn ${transform.enabled ? '' : 'icon-btn--off'}"
						title="${transform.enabled ? 'Disable' : 'Enable'}"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('toggle-transform', { transformId: transform.id, enabled: !transform.enabled }); }}>
						${transform.enabled ? '\u2713' : '\u25CB'}
					</span>
					<span class="icon-btn" title="Edit transform"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('edit-transform', { transformId: transform.id, eventType: transform.sourceEventType }); }}>
						\u270E
					</span>
					<span class="icon-btn" title="Delete transform"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('delete-transform', { transformId: transform.id }); }}>
						\u2715
					</span>
				</div>
			</div>
		`;
	}

	private renderRelatedEntities() {
		const hasRelated = this.relatedFlows.length > 0 ||
			this.relatedSystems.length > 0 ||
			this.relatedActors.length > 0;
		if (!hasRelated) return nothing;

		return html`
			${this.renderRelatedSection('Related Flows', this.relatedFlows, 'navigate-flow')}
			${this.renderRelatedSection('Related Systems', this.relatedSystems, 'navigate-system')}
			${this.renderRelatedSection('Related Actors', this.relatedActors, 'navigate-actor')}
		`;
	}

	private renderRelatedSection(title: string, entities: RelatedEntity[], eventName: string) {
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

if (!customElements.get('flowti-event-detail')) customElements.define('flowti-event-detail', FlowtiEventDetail);
