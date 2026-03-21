import { css } from 'lit';

export const trainTimelineStyles = css`
	:host {
		display: block;
	}

	.timeline-header {
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		border-bottom: 1px solid var(--flowti-border, #333);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
	}

	.title-text {
		font-weight: 600;
		font-size: 0.95em;
	}

	.status-badge {
		font-size: var(--flowti-font-sm);
		padding: 1px 6px;
		border-radius: var(--flowti-radius-sm, 4px);
		background: var(--background-modifier-hover, #2a2a2a);
		color: var(--flowti-text-muted, #999);
	}

	.header-btn {
		padding: 2px 4px;
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--flowti-text-muted, #999);
		border-radius: var(--flowti-radius-sm, 4px);
	}

	.header-btn:hover {
		background: var(--background-modifier-hover, #2a2a2a);
		color: var(--flowti-text, inherit);
	}

	.stat-line {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-text-muted, #999);
		margin-top: 2px;
	}

	.timeline-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--flowti-space-xl);
		color: var(--flowti-text-muted, #999);
	}

	.empty-chain {
		padding: var(--flowti-space-md);
		color: var(--flowti-text-muted, #999);
		font-size: var(--flowti-font-sm);
	}

	.graph-timeline {
		overflow-y: auto;
		padding: var(--flowti-space-xs) 0;
	}

	.graph-node {
		display: flex;
		align-items: stretch;
		cursor: pointer;
		min-height: 32px;
	}

	.graph-node:hover {
		background: var(--background-modifier-hover, #2a2a2a);
	}

	.graph-node--active {
		background: var(--background-modifier-active-hover, #333);
	}

	.graph-node--branch {
		opacity: 0.9;
	}

	.graph-cell {
		position: relative;
		flex-shrink: 0;
	}

	.graph-rail {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
	}

	.graph-fork {
		position: absolute;
		top: 50%;
		height: 2px;
	}

	.graph-merge {
		position: absolute;
		bottom: 0;
		height: 8px;
		border-bottom: 2px dashed;
	}

	.graph-merge-arrow {
		position: absolute;
		bottom: -6px;
		width: 0;
		height: 0;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
		border-top: 6px solid;
	}

	.graph-merge-arrow--left {
		left: -4px;
	}

	.graph-merge-arrow--right {
		right: -4px;
	}

	.graph-dot {
		position: absolute;
		top: 50%;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		z-index: 1;
	}

	.graph-dot--active {
		width: 10px;
		height: 10px;
		box-shadow: 0 0 4px currentColor;
	}

	.graph-dot--head {
		width: 10px;
		height: 10px;
		border: 2px solid var(--flowti-text, #fff);
	}

	.graph-content {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		flex: 1;
		min-width: 0;
		flex-wrap: wrap;
	}

	.node-title {
		font-size: 0.9em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chevron {
		cursor: pointer;
		font-size: 0.8em;
		color: var(--flowti-text-muted, #999);
		user-select: none;
	}

	.chevron:hover {
		color: var(--flowti-text, inherit);
	}

	.branch-badge {
		font-size: var(--flowti-font-sm);
		padding: 0 4px;
		border-radius: var(--flowti-radius-sm, 4px);
		background: var(--background-modifier-hover, #2a2a2a);
		color: var(--flowti-text-muted, #999);
	}

	.branch-status-badge {
		font-size: var(--flowti-font-sm);
		padding: 0 4px;
		border-radius: var(--flowti-radius-sm, 4px);
		cursor: pointer;
	}

	.branch-status-exploring {
		background: color-mix(in srgb, var(--flowti-color-info, #4a9eff) 20%, transparent);
		color: var(--flowti-color-info, #4a9eff);
	}

	.branch-status-promising {
		background: color-mix(in srgb, var(--flowti-color-success, #4ade80) 20%, transparent);
		color: var(--flowti-color-success, #4ade80);
	}

	.branch-status-stale {
		background: color-mix(in srgb, var(--flowti-color-warning, #fbbf24) 20%, transparent);
		color: var(--flowti-color-warning, #fbbf24);
	}

	.tag-btn {
		cursor: pointer;
		color: var(--flowti-text-muted, #999);
		font-size: var(--flowti-font-sm);
	}

	.tag-btn:hover {
		color: var(--flowti-text, inherit);
	}

	.merge-badge {
		font-size: var(--flowti-font-sm);
		padding: 0 4px;
		border-radius: var(--flowti-radius-sm, 4px);
	}

	.merge-badge--outgoing {
		background: color-mix(in srgb, var(--flowti-color-info, #4a9eff) 15%, transparent);
		color: var(--flowti-color-info, #4a9eff);
	}

	.merge-badge--incoming {
		background: color-mix(in srgb, var(--flowti-color-success, #4ade80) 15%, transparent);
		color: var(--flowti-color-success, #4ade80);
	}

	.graph-time {
		font-size: var(--flowti-font-sm);
		color: var(--text-faint, #666);
		margin-left: auto;
		white-space: nowrap;
	}
`;
