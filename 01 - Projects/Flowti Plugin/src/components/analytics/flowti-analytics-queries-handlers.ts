import type { FlowtiAnalyticsQueries } from './flowti-analytics-queries.js';

interface QuerySource {
	path: string;
	alias: string;
	displayName: string;
	headers?: string[];
}

/**
 * Handles scalar editor property updates. Returns true if handled.
 */
export function handleEditorScalar(
	comp: FlowtiAnalyticsQueries,
	type: string,
	detail: Record<string, unknown>,
): boolean {
	switch (type) {
		case 'update-query-name':
			comp.editorConfig = { ...comp.editorConfig, name: detail.name as string };
			return true;
		case 'toggle-source':
			handleToggleSource(comp, detail);
			return true;
		case 'toggle-dimension':
			handleToggleDimension(comp, detail);
			return true;
		case 'update-time-bucket':
			comp.editorConfig = { ...comp.editorConfig, timeBucket: detail.timeBucket as { column: string; period: string } | null };
			return true;
		case 'update-limit':
			comp.editorConfig = { ...comp.editorConfig, limit: detail.limit as number | null };
			return true;
		default:
			return false;
	}
}

/**
 * Handles collection (filter/measure/sort) updates. Returns true if handled.
 */
export function handleEditorCollection(
	comp: FlowtiAnalyticsQueries,
	type: string,
	detail: Record<string, unknown>,
): boolean {
	if (type === 'add-filter' || type === 'update-filter' || type === 'remove-filter') {
		handleFilterEvent(comp, type, detail);
		return true;
	}
	if (type === 'add-measure' || type === 'update-measure' || type === 'remove-measure') {
		handleMeasureEvent(comp, type, detail);
		return true;
	}
	if (type === 'add-sort' || type === 'update-sort' || type === 'remove-sort') {
		handleSortEvent(comp, type, detail);
		return true;
	}
	return false;
}

function handleToggleSource(comp: FlowtiAnalyticsQueries, detail: Record<string, unknown>): void {
	const alias = detail.alias as string;
	const currentSources = [...(comp.editorConfig.sources ?? [])];
	const idx = currentSources.findIndex((s) => s.alias === alias);
	if (idx >= 0) {
		currentSources.splice(idx, 1);
	} else {
		const src = (comp.sources as QuerySource[]).find((s) => s.alias === alias);
		if (src) currentSources.push({ csvPath: src.path, alias: src.alias });
	}
	comp.editorConfig = { ...comp.editorConfig, sources: currentSources };
	comp.requestUpdate();
}

function handleToggleDimension(comp: FlowtiAnalyticsQueries, detail: Record<string, unknown>): void {
	const col = detail.column as string;
	const dims = [...(comp.editorConfig.dimensions ?? [])];
	const di = dims.findIndex((d) => d.column === col);
	if (di >= 0) { dims.splice(di, 1); } else { dims.push({ column: col }); }
	comp.editorConfig = { ...comp.editorConfig, dimensions: dims };
}

function handleFilterEvent(comp: FlowtiAnalyticsQueries, type: string, detail: Record<string, unknown>): void {
	const filters = [...(comp.editorConfig.filters ?? [])];
	if (type === 'add-filter') {
		filters.push({ column: comp.editorHeaders[0] ?? '', operator: '=', value: '' });
	} else if (type === 'update-filter') {
		filters[detail.index as number] = detail.filter as { column: string; operator: string; value: string };
	} else {
		filters.splice(detail.index as number, 1);
	}
	comp.editorConfig = { ...comp.editorConfig, filters };
}

function handleMeasureEvent(comp: FlowtiAnalyticsQueries, type: string, detail: Record<string, unknown>): void {
	const measures = [...(comp.editorConfig.measures ?? [])];
	if (type === 'add-measure') {
		measures.push({ column: comp.editorHeaders[0] ?? '', function: 'COUNT' });
	} else if (type === 'update-measure') {
		measures[detail.index as number] = detail.measure as { column: string; function: string; label?: string };
	} else {
		measures.splice(detail.index as number, 1);
	}
	comp.editorConfig = { ...comp.editorConfig, measures };
}

function handleSortEvent(comp: FlowtiAnalyticsQueries, type: string, detail: Record<string, unknown>): void {
	const sorts = [...(comp.editorConfig.sorts ?? [])];
	if (type === 'add-sort') {
		const usedCols = new Set(sorts.map((s) => s.column));
		const available = comp.editorHeaders.find((h: string) => !usedCols.has(h));
		sorts.push({ column: available ?? comp.editorHeaders[0] ?? '', direction: 'asc' });
	} else if (type === 'update-sort') {
		sorts[detail.index as number] = detail.sort as { column: string; direction: 'asc' | 'desc' };
	} else {
		sorts.splice(detail.index as number, 1);
	}
	comp.editorConfig = { ...comp.editorConfig, sorts };
}
