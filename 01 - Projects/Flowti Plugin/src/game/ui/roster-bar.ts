import { html, css } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import { resolveSettingForDomain } from "../config/domain-map.js";
import { SCENE_THEMES } from "../config/settings.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent, Setting } from "../data/types.js";

export class RosterBar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 44px;
				background: var(--bg-primary);
				border-top: 1px solid var(--border);
				display: flex;
				align-items: center;
				padding: 0 10px;
				gap: 4px;
				z-index: 50;
				overflow-x: auto;
				overflow-y: hidden;
			}
			:host::-webkit-scrollbar { height: 0; }
			:host { scrollbar-width: none; }
			.card {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 2px;
				padding: 4px 8px;
				cursor: pointer;
				display: flex;
				flex-direction: column;
				min-width: 64px;
				transition: background 0.15s, border-color 0.2s, box-shadow 0.2s;
				flex-shrink: 0;
			}
			.card:hover {
				background: var(--bg-tertiary);
				border-color: var(--accent-gold);
				box-shadow: 0 0 8px rgba(217, 170, 78, 0.08);
			}
			.card-top {
				display: flex;
				align-items: center;
				gap: 4px;
			}
			.status-dot {
				width: 5px;
				height: 5px;
				border-radius: 50%;
				flex-shrink: 0;
			}
			.agent-name {
				font-size: 9px;
				font-weight: 600;
				color: var(--text-primary);
				letter-spacing: 0.03em;
			}
			.agent-location {
				font-size: 7px;
				color: var(--text-muted);
				margin-top: 1px;
				text-transform: uppercase;
				letter-spacing: 0.06em;
			}
		`,
	];

	store!: DashboardStore;

	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	private get domainAgents(): readonly DashboardAgent[] {
		return (this.store?.agents ?? []).filter(
			(a) => resolveSettingForDomain(a.domain) !== "hub",
		);
	}

	private statusColor(status: DashboardAgent["status"]): string {
		if (status === "busy") return "#22c55e";
		if (status === "idle") return "#3b82f6";
		return "#6b7280";
	}

	private truncate(name: string): string {
		return name.length > 9 ? name.slice(0, 8) + "\u2026" : name;
	}

	private handleCardClick(setting: Setting): void {
		this.store.changeScene(setting);
	}

	protected renderContent() {
		return html`${this.domainAgents.map((agent) => {
			const setting = resolveSettingForDomain(agent.domain);
			const label = SCENE_THEMES[setting]?.label ?? setting;
			const dotColor = this.statusColor(agent.status);
			const truncName = this.truncate(agent.name);

			return html`
				<div class="card" @click=${() => this.handleCardClick(setting)}>
					<div class="card-top">
						<span class="status-dot" style="background:${dotColor}"></span>
						<span class="agent-name">${truncName}</span>
					</div>
					<div class="agent-location">${label}</div>
				</div>
			`;
		})}`;
	}
}

if (!customElements.get("ft-game-roster-bar")) customElements.define("ft-game-roster-bar", RosterBar);
