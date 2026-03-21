import { css } from 'lit';

/** Aggregation function options for measures. */
export const AGG_FUNCTIONS = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const;

/** Time bucket period options. */
export const TIME_PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;

/** Operators for string columns. */
export const STRING_OPERATORS = [
	{ id: '=', label: '=' },
	{ id: '!=', label: '!=' },
	{ id: 'contains', label: 'contains' },
	{ id: 'startsWith', label: 'starts with' },
] as const;

/** Operators for numeric and date columns. */
export const NUMERIC_OPERATORS = [
	{ id: '=', label: '=' },
	{ id: '!=', label: '!=' },
	{ id: '>', label: '>' },
	{ id: '<', label: '<' },
	{ id: '>=', label: '>=' },
	{ id: '<=', label: '<=' },
] as const;

export interface SourceItem {
	path: string;
	alias: string;
	displayName: string;
	headers?: string[];
}

export interface FilterSpec {
	column: string;
	operator: string;
	value: string;
}

export interface DimensionSpec {
	column: string;
}

export interface MeasureSpec {
	column: string;
	function: string;
	label?: string;
}

export interface SortSpec {
	column: string;
	direction: 'asc' | 'desc';
}

export interface TimeBucketSpec {
	column: string;
	period: string;
}

export interface ColumnTypeHint {
	column: string;
	type: string;
	currencySymbol?: string;
	alias?: string;
}

export const queryEditorStyles = css`
	.editor-layout {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-md);
	}

	.editor-header {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
	}

	.editor-header input {
		flex: 1;
		font-size: 1.1em;
		font-weight: 600;
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--text-normal, inherit);
		padding: var(--flowti-space-xs) 0;
	}

	.editor-header input:focus {
		outline: none;
		border-bottom-color: var(--interactive-accent, #5a7);
	}

	.card {
		background: var(--background-secondary);
		border-radius: var(--flowti-radius);
		padding: var(--flowti-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-sm);
	}

	.card-title {
		font-size: var(--flowti-font-sm);
		font-weight: 600;
		color: var(--flowti-color-muted);
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
	}

	.card-description {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
		opacity: 0.8;
	}

	.badge {
		font-size: var(--flowti-font-sm);
		background: var(--background-primary);
		padding: 0 var(--flowti-space-xs);
		border-radius: var(--flowti-radius);
		color: var(--flowti-color-muted);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		flex-wrap: wrap;
	}

	.row-padded {
		padding: var(--flowti-space-xs) 0;
	}

	.row-bordered {
		padding: var(--flowti-space-xs) 0;
		border-bottom: 1px solid var(--flowti-border);
	}

	select, .input-field {
		padding: 2px 6px;
		font-size: var(--flowti-font-sm);
		background: var(--background-primary);
		border: 1px solid var(--flowti-border);
		border-radius: var(--flowti-radius);
		color: var(--text-normal, inherit);
	}

	.input-field {
		width: 80px;
	}

	.input-alias {
		width: 120px;
	}

	.ml-auto {
		margin-left: auto;
	}

	.text-muted {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
	}

	.link-btn {
		font-size: var(--flowti-font-sm);
		cursor: pointer;
		color: var(--text-accent, #5a7);
		background: none;
		border: none;
		padding: 2px var(--flowti-space-xs);
	}

	.link-btn:hover {
		text-decoration: underline;
	}

	.remove-btn {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
		cursor: pointer;
		background: none;
		border: none;
		padding: 2px;
	}

	.remove-btn:hover {
		color: var(--flowti-color-error);
	}

	.source-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
		cursor: pointer;
		border: 1px solid var(--flowti-border);
		background: var(--background-primary);
	}

	.source-chip--selected {
		background: var(--interactive-accent, #5a7);
		color: white;
		border-color: transparent;
	}

	.dim-checkbox {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		font-size: var(--flowti-font-sm);
	}

	.actions-bar {
		display: flex;
		gap: var(--flowti-space-sm);
		padding-top: var(--flowti-space-sm);
		border-top: 1px solid var(--flowti-border);
	}

	button.primary {
		background: var(--interactive-accent, #5a7);
		color: white;
		border-color: transparent;
	}

	button.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.divider {
		border-top: 1px solid var(--flowti-border);
		margin: var(--flowti-space-xs) 0;
	}

	.col-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--flowti-space-xs);
	}

	.col-item {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		padding: 2px var(--flowti-space-xs);
		font-size: var(--flowti-font-sm);
		border-radius: var(--flowti-radius);
	}

	.col-item:hover {
		background: var(--background-modifier-hover);
	}

	.col-type-badge {
		font-size: 0.75em;
		padding: 0 4px;
		border-radius: 3px;
		background: var(--background-primary);
		color: var(--flowti-color-muted);
	}
`;
