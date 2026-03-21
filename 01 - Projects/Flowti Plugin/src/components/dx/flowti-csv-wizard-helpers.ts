import { html, nothing, type TemplateResult } from 'lit';
import type { CsvImportResult } from './flowti-csv-wizard.js';

export function renderImportResult(
	result: CsvImportResult,
	targetFolder: string,
	onRunAgain: () => void,
	onEditConfig: () => void,
	onCsvDetail: () => void,
): TemplateResult {
	const hasErrors = result.failed > 0;
	const allSkipped = result.skipped === result.totalRows;
	const statusText = hasErrors
		? `Import completed with ${result.failed} error${result.failed !== 1 ? 's' : ''}`
		: allSkipped
			? 'All rows skipped \u2014 notes already exist'
			: `Successfully imported ${result.created + result.updated} note${(result.created + result.updated) !== 1 ? 's' : ''}`;

	return html`
		<div class="page-content">
			<div class="header-row">
				<span class="status-icon ${hasErrors ? 'text-error' : allSkipped ? 'text-muted' : 'text-success'}">
					${hasErrors ? '\u26A0' : allSkipped ? '\u2296' : '\u2713'}
				</span>
				<h3>${statusText}</h3>
			</div>
			<div class="card">
				<div class="card-title">What happened</div>
				<div class="info-grid">
					<span class="info-label">CSV rows processed</span><span>${result.totalRows}</span>
					${result.created > 0 ? html`<span class="info-label">Notes created</span><span>${result.created}</span>` : nothing}
					${result.updated > 0 ? html`<span class="info-label">Notes updated</span><span>${result.updated}</span>` : nothing}
					${result.skipped > 0 ? html`<span class="info-label">Notes skipped</span><span>${result.skipped} (already exist)</span>` : nothing}
					${result.failed > 0 ? html`<span class="info-label text-error">Failed</span><span class="text-error">${result.failed}</span>` : nothing}
					<span class="info-label">Target folder</span><span>${targetFolder}</span>
				</div>
			</div>
			${result.errors.length > 0 ? html`
				<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
					<div class="card-title">Errors (${result.errors.length})</div>
					${result.errors.slice(0, 20).map((err) => html`
						<div style="display: flex; gap: var(--flowti-space-sm); font-size: var(--flowti-font-sm); margin-bottom: 2px">
							<span class="text-muted">Row ${err.row}</span>
							<span>${err.filename}</span>
							<span class="text-error">${err.error}</span>
						</div>
					`)}
					${result.errors.length > 20 ? html`<div class="text-muted">...and ${result.errors.length - 20} more</div>` : nothing}
				</div>
			` : nothing}
			<div class="card">
				<div class="card-title">What's next</div>
				<div class="actions-row">
					<button @click=${onRunAgain}>Run Again</button>
					<button @click=${onEditConfig}>Edit Config</button>
					<button @click=${onCsvDetail}>CSV Detail</button>
				</div>
			</div>
		</div>
	`;
}

export function renderImportError(
	errorMessage: string | null,
	onRetry: () => void,
	onEditConfig: () => void,
	onCsvDetail: () => void,
): TemplateResult {
	return html`
		<div class="page-content">
			<div class="header-row">
				<span class="status-icon text-error">\u2717</span>
				<h3>Import failed</h3>
			</div>
			<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
				<div class="card-title">Error</div>
				<div style="font-size: var(--flowti-font-sm)">${errorMessage}</div>
			</div>
			<div class="card">
				<div class="card-title">What's next</div>
				<div class="actions-row">
					<button class="btn-primary" @click=${onRetry}>Retry</button>
					<button @click=${onEditConfig}>Edit Config</button>
					<button @click=${onCsvDetail}>CSV Detail</button>
				</div>
			</div>
		</div>
	`;
}
