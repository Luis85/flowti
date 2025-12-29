// ─────────────────────────────────────────────────────────────
// CSV Export Service
// Exportiert F1 Daten als CSV Dateien in den Obsidian Vault
// ─────────────────────────────────────────────────────────────

import { App, TFile, TFolder, Notice } from "obsidian";
import { F1EntityType, F1ApiProvider } from "../models/F1Models";

export interface CsvExportOptions {
	basePath?: string;
	includeTimestamp?: boolean;
	delimiter?: string;
}

const DEFAULT_OPTIONS: Required<CsvExportOptions> = {
	basePath: 'Motorsport-Data',
	includeTimestamp: true,
	delimiter: ','
};

export class CsvExportService {
	private app: App;
	private options: Required<CsvExportOptions>;

	constructor(app: App, options?: CsvExportOptions) {
		this.app = app;
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	// ─────────────────────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────────────────────

	async exportToCsv(
		data: Record<string, unknown>[],
		entityType: F1EntityType,
		provider: F1ApiProvider,
		additionalInfo?: string
	): Promise<TFile> {
		if (data.length === 0) {
			throw new Error('Keine Daten zum Exportieren vorhanden.');
		}

		// CSV Content generieren
		const csvContent = this.convertToCsv(data);
		
		// Dateinamen erstellen
		const fileName = this.generateFileName(entityType, provider, additionalInfo);
		
		// Pfad erstellen
		const fullPath = `${this.options.basePath}/${provider}/${fileName}`;
		
		// Sicherstellen dass der Ordner existiert
		await this.ensureFolder(`${this.options.basePath}/${provider}`);
		
		// Datei schreiben
		const file = await this.writeFile(fullPath, csvContent);
		
		new Notice(`✅ ${data.length} Einträge exportiert: ${fileName}`);
		
		return file;
	}

	// ─────────────────────────────────────────────────────────────
	// CSV Conversion
	// ─────────────────────────────────────────────────────────────

	private convertToCsv(data: Record<string, unknown>[]): string {
		if (data.length === 0) return '';

		// Header aus den Keys des ersten Objekts
		const headers = Object.keys(data[0]);
		
		// Header-Zeile
		const headerLine = headers.join(this.options.delimiter);
		
		// Daten-Zeilen
		const dataLines = data.map(row => {
			return headers.map(header => {
				const value = row[header];
				return this.escapeCsvValue(value);
			}).join(this.options.delimiter);
		});

		return [headerLine, ...dataLines].join('\n');
	}

	private escapeCsvValue(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		
		const stringValue = String(value);
		
		// Escape wenn nötig (Komma, Anführungszeichen, Zeilenumbruch)
		if (
			stringValue.includes(this.options.delimiter) ||
			stringValue.includes('"') ||
			stringValue.includes('\n')
		) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}
		
		return stringValue;
	}

	// ─────────────────────────────────────────────────────────────
	// File Operations
	// ─────────────────────────────────────────────────────────────

	private generateFileName(
		entityType: F1EntityType,
		provider: F1ApiProvider,
		additionalInfo?: string
	): string {
		const parts: string[] = [entityType];
		
		if (additionalInfo) {
			parts.push(additionalInfo);
		}
		
		if (this.options.includeTimestamp) {
			const timestamp = new Date().toISOString().split('T')[0];
			parts.push(timestamp);
		}
		
		return `${parts.join('_')}.csv`;
	}

	private async ensureFolder(path: string): Promise<TFolder> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		
		if (folder instanceof TFolder) {
			return folder;
		}
		
		// Rekursiv Ordner erstellen
		const parts = path.split('/');
		let currentPath = '';
		
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(currentPath);
			
			if (!existing) {
				await this.app.vault.createFolder(currentPath);
			}
		}
		
		return this.app.vault.getAbstractFileByPath(path) as TFolder;
	}

	private async writeFile(path: string, content: string): Promise<TFile> {
		const existingFile = this.app.vault.getAbstractFileByPath(path);
		
		if (existingFile instanceof TFile) {
			// Bestehende Datei überschreiben
			await this.app.vault.modify(existingFile, content);
			return existingFile;
		}
		
		// Neue Datei erstellen
		return await this.app.vault.create(path, content);
	}

	// ─────────────────────────────────────────────────────────────
	// Utility
	// ─────────────────────────────────────────────────────────────

	getExportPath(): string {
		return this.options.basePath;
	}
}
