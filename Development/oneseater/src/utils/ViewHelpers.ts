// ─────────────────────────────────────────────────────────────
// View Renderer Types & Helpers
// ─────────────────────────────────────────────────────────────
import { F1DataRepository } from "src/compendium/services/F1DataRepository";
import { NavigationManager } from "./NavigationManager";

export interface ViewContext {
	container: HTMLElement;
	repository: F1DataRepository;
	navigation: NavigationManager;
	setStatus: (message: string, type: 'info' | 'success' | 'error') => void;
	clearStatus: () => void;
}

// ─────────────────────────────────────────────────────────────
// UI Helper Functions
// ─────────────────────────────────────────────────────────────

export function createHeader(
	container: HTMLElement, 
	title: string, 
	subtitle?: string
): HTMLElement {
	const header = container.createDiv({ cls: 'f1-view-header' });
	header.createEl('h1', { text: title });
	if (subtitle) {
		header.createEl('p', { text: subtitle, cls: 'f1-text-muted' });
	}
	return header;
}

export function createInfoGrid(container: HTMLElement): HTMLElement {
	return container.createDiv({ cls: 'f1-info-grid' });
}

export function createInfoItem(
	container: HTMLElement, 
	label: string, 
	value: string | number | undefined,
	icon?: string
): HTMLElement {
	const item = container.createDiv({ cls: 'f1-info-item' });
	if (icon) {
		item.createEl('span', { text: icon, cls: 'f1-info-icon' });
	}
	item.createEl('span', { text: label, cls: 'f1-info-label' });
	item.createEl('span', { text: String(value ?? '-'), cls: 'f1-info-value' });
	return item;
}

export function createSection(
	container: HTMLElement, 
	title: string
): HTMLElement {
	const section = container.createDiv({ cls: 'f1-section' });
	section.createEl('h2', { text: title });
	return section;
}

export function createTable(
	container: HTMLElement,
	headers: string[],
	data: Record<string, unknown>[],
	columns: { key: string; format?: (val: unknown) => string }[],
	onRowClick?: (row: Record<string, unknown>) => void
): HTMLTableElement {
	const table = container.createEl('table', { cls: 'f1-table' });
	
	// Header
	const thead = table.createEl('thead');
	const headerRow = thead.createEl('tr');
	headers.forEach(h => headerRow.createEl('th', { text: h }));
	
	// Body
	const tbody = table.createEl('tbody');
	
	data.forEach(row => {
		const tr = tbody.createEl('tr', { 
			cls: onRowClick ? 'f1-table-row-clickable' : '' 
		});
		
		columns.forEach(col => {
			const value = row[col.key];
			const formatted = col.format ? col.format(value) : String(value ?? '-');
			tr.createEl('td', { text: formatted });
		});
		
		if (onRowClick) {
			tr.addEventListener('click', () => onRowClick(row));
		}
	});
	
	return table;
}

export function createCacheIndicator(
	container: HTMLElement,
	source: 'cache' | 'api',
	cachedAt?: string
): HTMLElement {
	const indicator = container.createDiv({ cls: 'f1-cache-indicator' });
	
	if (source === 'cache') {
		indicator.addClass('is-cached');
		const date = cachedAt ? new Date(cachedAt).toLocaleString('de-DE') : 'Unbekannt';
		indicator.createEl('span', { text: `📦 Aus Cache (${date})` });
		
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const refreshBtn = indicator.createEl('button', { 
			text: '🔄', 
			cls: 'f1-btn f1-btn-small',
			attr: { title: 'Neu laden' }
		});
		
		return indicator;
	} else {
		indicator.addClass('is-live');
		indicator.createEl('span', { text: '🌐 Live geladen' });
		return indicator;
	}
}

export function formatDate(dateString: string | undefined): string {
	if (!dateString) return '-';
	try {
		return new Date(dateString).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	} catch {
		return dateString;
	}
}

export function formatNationality(code: string | undefined): string {
	const flags: Record<string, string> = {
		'British': '🇬🇧',
		'German': '🇩🇪',
		'Dutch': '🇳🇱',
		'Spanish': '🇪🇸',
		'French': '🇫🇷',
		'Italian': '🇮🇹',
		'Australian': '🇦🇺',
		'Mexican': '🇲🇽',
		'Finnish': '🇫🇮',
		'Danish': '🇩🇰',
		'Canadian': '🇨🇦',
		'Monegasque': '🇲🇨',
		'Japanese': '🇯🇵',
		'Thai': '🇹🇭',
		'Chinese': '🇨🇳',
		'American': '🇺🇸',
		'Brazilian': '🇧🇷',
		'Austrian': '🇦🇹',
		'Swiss': '🇨🇭',
		'New Zealander': '🇳🇿',
		'Argentinian': '🇦🇷',
	};
	
	return code ? `${flags[code] || '🏁'} ${code}` : '-';
}
