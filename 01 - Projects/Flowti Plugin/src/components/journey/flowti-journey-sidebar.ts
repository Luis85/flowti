import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Journey sidebar with step list, navigation, and step CRUD.
 * Step list with selected highlight, add/remove, and move-up/down reordering.
 *
 * @fires step-select - detail: { index }
 * @fires step-add - add a new step
 * @fires step-remove - detail: { stepId }
 * @fires step-move - detail: { fromIndex, direction }
 * @fires nav-prev / nav-next / nav-setup
 */
interface SidebarStep {
	id: string;
	title: string;
	description: string;
	swimlane: string;
	actions: unknown[];
}

export class FlowtiJourneySidebar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		steps: { type: Array },
		currentIndex: { type: Number, attribute: 'current-index' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.sidebar { display: flex; flex-direction: column; gap: var(--flowti-space-sm); height: 100%; }
			.nav { display: flex; align-items: center; gap: var(--flowti-space-sm); padding: var(--flowti-space-sm) 0; border-bottom: 1px solid var(--flowti-border); }
			.nav-btn { cursor: pointer; padding: var(--flowti-space-xs) var(--flowti-space-sm); border-radius: var(--flowti-radius); border: 1px solid var(--flowti-border); background: var(--background-secondary); color: var(--text-normal); font-size: var(--flowti-font-sm); }
			.nav-btn:hover:not(.nav-off) { background: var(--background-modifier-hover); }
			.nav-off { opacity: 0.4; cursor: default; }
			.nav-count { flex: 1; text-align: center; font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--flowti-space-xs); }
			.item { display: flex; align-items: center; gap: var(--flowti-space-sm); padding: var(--flowti-space-sm) var(--flowti-space-md); border-radius: var(--flowti-radius); cursor: pointer; border: 1px solid transparent; }
			.item:hover { background: var(--background-modifier-hover); }
			.item--sel { background: var(--background-modifier-active-hover); border-color: var(--flowti-color-info); }
			.item-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: color-mix(in srgb, var(--flowti-color-info) 20%, transparent); color: var(--flowti-color-info); font-size: var(--flowti-font-sm); font-weight: 700; flex-shrink: 0; }
			.item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--flowti-font-sm); }
			.item-title--empty { color: var(--flowti-color-muted); font-style: italic; }
			.ctrls { display: flex; gap: 2px; }
			.ctrl { cursor: pointer; padding: 2px; border-radius: var(--flowti-radius); color: var(--flowti-color-muted); font-size: var(--flowti-font-sm); }
			.ctrl:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
			.ctrl--off { opacity: 0.3; cursor: default; }
			.add-btn { display: flex; align-items: center; justify-content: center; gap: var(--flowti-space-xs); padding: var(--flowti-space-sm); border: 1px dashed var(--flowti-border); border-radius: var(--flowti-radius); cursor: pointer; color: var(--flowti-color-muted); font-size: var(--flowti-font-sm); }
			.add-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
			.empty { display: flex; align-items: center; justify-content: center; padding: var(--flowti-space-xl); color: var(--flowti-color-muted); font-size: var(--flowti-font-sm); text-align: center; }
		`,
	];

	steps: SidebarStep[] = [];
	currentIndex = 0;

	private emit(name: string, detail?: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail: detail ?? {}, bubbles: true, composed: true }));
	}

	protected renderContent() {
		const n = this.steps.length;
		const hasPrev = n > 0 && this.currentIndex > 0;
		const hasNext = n > 0 && this.currentIndex < n - 1;
		return html`
			<div class="sidebar">
				<div class="nav">
					<button class="nav-btn" aria-label="Setup" @click=${() => this.emit('nav-setup')}>&#x2699;</button>
					<button class="nav-btn ${hasPrev ? '' : 'nav-off'}" aria-label="Previous step" ?disabled=${!hasPrev}
						@click=${() => hasPrev && this.emit('nav-prev')}>&#x2190;</button>
					<span class="nav-count">${n === 0 ? 'No steps yet' : `Step ${this.currentIndex + 1} of ${n}`}</span>
					<button class="nav-btn ${hasNext ? '' : 'nav-off'}" aria-label="Next step" ?disabled=${!hasNext}
						@click=${() => hasNext && this.emit('nav-next')}>&#x2192;</button>
				</div>
				${n === 0
					? html`<div class="empty">No steps yet. Click "Add step" to begin.</div>`
					: html`<div class="list">${this.steps.map((s, i) => this.renderItem(s, i))}</div>`}
				<div class="add-btn" role="button" tabindex="0" aria-label="Add step"
					@click=${() => this.emit('step-add')}
					@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.emit('step-add'); } }}>+ Add step</div>
			</div>
		`;
	}

	private renderItem(step: SidebarStep, i: number) {
		const sel = i === this.currentIndex;
		const first = i === 0;
		const last = i === this.steps.length - 1;
		return html`
			<div class="item ${sel ? 'item--sel' : ''}" role="button" tabindex="0"
				@click=${() => this.emit('step-select', { index: i })}
				@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.emit('step-select', { index: i }); } }}>
				<span class="item-num">${i + 1}</span>
				<span class="item-title ${step.title ? '' : 'item-title--empty'}">${step.title || 'Untitled step'}</span>
				<div class="ctrls">
					<span class="ctrl ${first ? 'ctrl--off' : ''}" role="button" tabindex=${first ? '-1' : '0'} aria-label="Move up"
						@click=${(e: Event) => { e.stopPropagation(); if (!first) this.emit('step-move', { fromIndex: i, direction: 'up' }); }}>&#x2191;</span>
					<span class="ctrl ${last ? 'ctrl--off' : ''}" role="button" tabindex=${last ? '-1' : '0'} aria-label="Move down"
						@click=${(e: Event) => { e.stopPropagation(); if (!last) this.emit('step-move', { fromIndex: i, direction: 'down' }); }}>&#x2193;</span>
					<span class="ctrl" role="button" tabindex="0" aria-label="Remove step"
						@click=${(e: Event) => { e.stopPropagation(); this.emit('step-remove', { stepId: step.id }); }}>&#x2715;</span>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-journey-sidebar')) customElements.define('flowti-journey-sidebar', FlowtiJourneySidebar);
