import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState } from '../shared-styles.js';

interface CommandData {
	id: string;
	label: string;
	description: string;
	domain: string;
	category: string;
	icon?: string;
	shortcut?: string;
}

/**
 * User Commands — searchable command catalog.
 *
 * @property commands - Array of command metadata objects
 * @property searchText - Filter text for command labels/descriptions/domains
 *
 * @fires execute-command - detail: { commandId } when a command item is clicked
 */
export class FlowtiUserCommands extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		commands: { type: Array },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		emptyState,
		css`
			.commands-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.command-item {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.command-item:hover {
				background: var(--background-modifier-hover);
			}

			.command-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.command-label {
				font-weight: 500;
				font-size: var(--flowti-font-sm);
				flex: 1;
			}

			.command-domain {
				font-size: var(--flowti-font-sm);
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}

			.command-description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.command-shortcut {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				font-family: monospace;
			}
		`,
	];

	commands: CommandData[] = [];
	searchText = '';

	private get filteredCommands(): CommandData[] {
		if (!this.searchText) return this.commands;
		const lower = this.searchText.toLowerCase();
		return this.commands.filter(
			(c) =>
				c.label.toLowerCase().includes(lower) ||
				c.description.toLowerCase().includes(lower) ||
				c.domain.toLowerCase().includes(lower),
		);
	}

	private dispatchExecuteCommand(commandId: string): void {
		this.dispatchEvent(
			new CustomEvent('execute-command', {
				detail: { commandId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredCommands;

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No commands found</div>
				</div>
			`;
		}

		return html`
			<div class="commands-layout">
				${filtered.map((cmd) => this.renderCommandItem(cmd))}
			</div>
		`;
	}

	private renderCommandItem(cmd: CommandData) {
		return html`
			<div class="command-item" @click=${() => this.dispatchExecuteCommand(cmd.id)}>
				<div class="command-header">
					<span class="command-label">${cmd.label}</span>
					<span class="command-domain">${cmd.domain}</span>
				</div>
				<div class="command-description">${cmd.description}</div>
			</div>
		`;
	}
}

customElements.define('flowti-user-commands', FlowtiUserCommands);
