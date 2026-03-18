import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/**
 * Journey step card with inline editing for title, description,
 * swimlane, and chip-based metadata lists.
 *
 * @fires step-title-changed - detail: { stepId, value }
 * @fires step-description-changed - detail: { stepId, value }
 * @fires step-swimlane-changed - detail: { stepId, value }
 * @fires step-list-changed - detail: { stepId, field, items }
 * @fires step-remove - detail: { stepId }
 * @fires step-bg-requested - detail: { stepId }
 * @fires step-bg-removed - detail: { stepId }
 */
interface StepData {
	id: string;
	title: string;
	description: string;
	swimlane: string;
	actions: unknown[];
	events?: string[];
	commands?: string[];
	interactions?: string[];
	components?: string[];
	backgroundImage?: string;
}

const SWIMLANES = [
	{ value: 'customer', label: 'Customer' },
	{ value: 'frontstage', label: 'Frontstage' },
	{ value: 'backstage', label: 'Backstage' },
	{ value: 'support', label: 'Support' },
];

export class FlowtiJourneyStep extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		step: { type: Object },
		stepNumber: { type: Number, attribute: 'step-number' },
		actionCount: { type: Number, attribute: 'action-count' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.card { border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); padding: var(--flowti-space-md); background: var(--background-secondary); display: flex; flex-direction: column; gap: var(--flowti-space-sm); }
			.header { display: flex; align-items: center; gap: var(--flowti-space-sm); }
			.num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: color-mix(in srgb, var(--flowti-color-info) 20%, transparent); color: var(--flowti-color-info); font-size: var(--flowti-font-sm); font-weight: 700; flex-shrink: 0; }
			.title-input { flex: 1; padding: var(--flowti-space-xs) var(--flowti-space-sm); border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); background: var(--background-primary); color: var(--text-normal); }
			.remove { cursor: pointer; color: var(--flowti-color-muted); font-size: 1.2em; padding: 2px; }
			.remove:hover { color: var(--flowti-color-error); }
			textarea, select { width: 100%; padding: var(--flowti-space-xs) var(--flowti-space-sm); border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); background: var(--background-primary); color: var(--text-normal); font-family: inherit; }
			textarea { resize: vertical; }
			.chip-section { display: flex; flex-direction: column; gap: 4px; }
			.chip-label { font-size: var(--flowti-font-sm); font-weight: 500; color: var(--flowti-color-muted); }
			.chips { display: flex; flex-wrap: wrap; gap: 4px; }
			.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px var(--flowti-space-sm); border-radius: var(--flowti-radius); background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent); font-size: var(--flowti-font-sm); }
			.chip-rm { cursor: pointer; font-weight: 700; color: var(--flowti-color-muted); }
			.chip-rm:hover { color: var(--flowti-color-error); }
			.chip-input { padding: 2px var(--flowti-space-sm); border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); background: var(--background-primary); color: var(--text-normal); font-size: var(--flowti-font-sm); }
			.bg { display: flex; align-items: center; gap: var(--flowti-space-sm); font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
			.bg-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.bg-btn { cursor: pointer; padding: 2px var(--flowti-space-sm); border-radius: var(--flowti-radius); border: 1px solid var(--flowti-border); background: var(--background-secondary); color: var(--text-normal); font-size: var(--flowti-font-sm); }
			.bg-btn:hover { background: var(--background-modifier-hover); }
			.count { font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
		`,
	];

	step: StepData = { id: '', title: '', description: '', swimlane: '', actions: [] };
	stepNumber = 1;
	actionCount = 0;

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}

	private addChip(field: string, items: string[], el: HTMLInputElement): void {
		const v = el.value.trim();
		if (!v || items.includes(v)) return;
		el.value = '';
		this.emit('step-list-changed', { stepId: this.step.id, field, items: [...items, v] });
	}

	private removeChip(field: string, items: string[], i: number): void {
		this.emit('step-list-changed', { stepId: this.step.id, field, items: items.filter((_, idx) => idx !== i) });
	}

	protected renderContent() {
		const s = this.step;
		return html`
			<div class="card" data-step-id=${s.id}>
				<div class="header">
					<span class="num">${this.stepNumber}</span>
					<input class="title-input" type="text" placeholder="Enter step title..." .value=${s.title}
						@input=${(e: InputEvent) => this.emit('step-title-changed', { stepId: s.id, value: (e.target as HTMLInputElement).value })} />
					<span class="remove" role="button" tabindex="0" aria-label="Remove step"
						@click=${() => this.emit('step-remove', { stepId: s.id })}
						@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.emit('step-remove', { stepId: s.id }); } }}>&#x2715;</span>
				</div>
				<textarea rows="2" placeholder="Step description..." .value=${s.description}
					@input=${(e: InputEvent) => this.emit('step-description-changed', { stepId: s.id, value: (e.target as HTMLTextAreaElement).value })}></textarea>
				<select .value=${s.swimlane || ''}
					@change=${(e: Event) => this.emit('step-swimlane-changed', { stepId: s.id, value: (e.target as HTMLSelectElement).value })}>
					<option value="" disabled>Select swimlane...</option>
					${SWIMLANES.map((o) => html`<option value=${o.value} ?selected=${s.swimlane === o.value}>${o.label}</option>`)}
				</select>
				${this.renderBg(s)}
				${this.renderChips('Events', 'events', s.events ?? [])}
				${this.renderChips('Commands', 'commands', s.commands ?? [])}
				${this.renderChips('Interactions', 'interactions', s.interactions ?? [])}
				${this.renderChips('Components', 'components', s.components ?? [])}
				<div class="count">${this.actionCount === 0 ? 'No actions' : `${this.actionCount} action${this.actionCount === 1 ? '' : 's'}`}</div>
			</div>
		`;
	}

	private renderBg(s: StepData) {
		if (s.backgroundImage) {
			const name = s.backgroundImage.split('/').pop() ?? s.backgroundImage;
			return html`<div class="bg"><span class="bg-name">${name}</span>
				<button class="bg-btn" @click=${() => this.emit('step-bg-requested', { stepId: s.id })}>Change</button>
				<button class="bg-btn" @click=${() => this.emit('step-bg-removed', { stepId: s.id })}>Remove</button></div>`;
		}
		return html`<div class="bg"><button class="bg-btn" @click=${() => this.emit('step-bg-requested', { stepId: s.id })}>Add background</button></div>`;
	}

	private renderChips(label: string, field: string, items: string[]) {
		return html`
			<div class="chip-section">
				<span class="chip-label">${label}</span>
				<div class="chips">${items.map((item, i) => html`
					<span class="chip">${item}<span class="chip-rm" role="button" tabindex="0"
						@click=${() => this.removeChip(field, items, i)}
						@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.removeChip(field, items, i); } }}>&#x00d7;</span></span>
				`)}</div>
				<input class="chip-input" type="text" placeholder="Add ${label.toLowerCase()}..."
					@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.addChip(field, items, e.target as HTMLInputElement); } }} />
			</div>
		`;
	}
}

if (!customElements.get('flowti-journey-step')) customElements.define('flowti-journey-step', FlowtiJourneyStep);
