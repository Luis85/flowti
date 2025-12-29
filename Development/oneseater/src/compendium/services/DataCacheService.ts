// ─────────────────────────────────────────────────────────────
// Data Cache Service
// Verwaltet lokalen Cache der Daten mit Cache-First Strategie
// ─────────────────────────────────────────────────────────────

import { App, TFile, TFolder } from "obsidian";

export interface CacheSettings {
	dataFolderPath: string;
	compendiumFolderPath: string;
	templatesFolderPath: string;
}

export interface CachedData<T = unknown> {
	data: T[];
	cachedAt: string;
}

export class DataCacheService {
	private app: App;
	private settings: CacheSettings;
	private memoryCache: Map<string, CachedData> = new Map();

	constructor(app: App, settings: CacheSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: CacheSettings) {
		this.settings = settings;
	}

	// ─────────────────────────────────────────────────────────────
	// Cache File Path
	// ─────────────────────────────────────────────────────────────

	private getCacheFilePath(cacheKey: string): string {
		// Sanitize cache key for filename
		const safeName = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
		return `${this.settings.dataFolderPath}/cache/${safeName}.csv`;
	}

	private getMetaFilePath(cacheKey: string): string {
		const safeName = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
		return `${this.settings.dataFolderPath}/cache/${safeName}.meta.json`;
	}

	// ─────────────────────────────────────────────────────────────
	// Load from Cache
	// ─────────────────────────────────────────────────────────────

	async loadFromCache(cacheKey: string): Promise<CachedData | null> {
		// 1. Check memory cache first
		const memCached = this.memoryCache.get(cacheKey);
		if (memCached) {
			console.log(`[Cache] Memory hit: ${cacheKey}`);
			return memCached;
		}

		// 2. Check file cache
		const filePath = this.getCacheFilePath(cacheKey);
		const metaPath = this.getMetaFilePath(cacheKey);
		
		const file = this.app.vault.getAbstractFileByPath(filePath);
		const metaFile = this.app.vault.getAbstractFileByPath(metaPath);

		if (!(file instanceof TFile)) {
			console.log(`[Cache] File miss: ${cacheKey}`);
			return null;
		}

		try {
			// Read CSV data
			const content = await this.app.vault.read(file);
			const data = this.parseCsv(content);

			// Read meta info
			let cachedAt = new Date(file.stat.mtime).toISOString();
			if (metaFile instanceof TFile) {
				const metaContent = await this.app.vault.read(metaFile);
				const meta = JSON.parse(metaContent);
				cachedAt = meta.cachedAt || cachedAt;
			}

			const result: CachedData = { data, cachedAt };

			// Store in memory cache
			this.memoryCache.set(cacheKey, result);

			console.log(`[Cache] File hit: ${cacheKey} (${data.length} items)`);
			return result;

		} catch (error) {
			console.error(`[Cache] Error reading ${cacheKey}:`, error);
			return null;
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Save to Cache
	// ─────────────────────────────────────────────────────────────

	async saveToCache(cacheKey: string, data: Record<string, unknown>[]): Promise<void> {
		if (data.length === 0) return;

		const filePath = this.getCacheFilePath(cacheKey);
		const metaPath = this.getMetaFilePath(cacheKey);
		const cachedAt = new Date().toISOString();

		// Ensure cache folder exists
		await this.ensureFolder(`${this.settings.dataFolderPath}/cache`);

		// Write CSV
		const csvContent = this.convertToCsv(data);
		await this.writeFile(filePath, csvContent);

		// Write meta
		const meta = { cachedAt, count: data.length };
		await this.writeFile(metaPath, JSON.stringify(meta, null, 2));

		// Update memory cache
		this.memoryCache.set(cacheKey, { data, cachedAt });

		console.log(`[Cache] Saved: ${cacheKey} (${data.length} items)`);
	}


	// ─────────────────────────────────────────────────────────────
	// Cache Management
	// ─────────────────────────────────────────────────────────────

	async getCacheInfo(): Promise<{ files: string[]; totalSize: number; entries: { key: string; count: number; cachedAt: string }[] }> {
		const cacheFolder = this.app.vault.getAbstractFileByPath(`${this.settings.dataFolderPath}/cache`);
		
		if (!(cacheFolder instanceof TFolder)) {
			return { files: [], totalSize: 0, entries: [] };
		}

		const files: string[] = [];
		const entries: { key: string; count: number; cachedAt: string }[] = [];
		let totalSize = 0;

		for (const child of cacheFolder.children) {
			if (child instanceof TFile) {
				if (child.extension === 'csv') {
					files.push(child.name);
					totalSize += child.stat.size;

					// Try to read meta
					const metaPath = child.path.replace('.csv', '.meta.json');
					const metaFile = this.app.vault.getAbstractFileByPath(metaPath);
					
					if (metaFile instanceof TFile) {
						try {
							const metaContent = await this.app.vault.read(metaFile);
							const meta = JSON.parse(metaContent);
							entries.push({
								key: child.basename,
								count: meta.count || 0,
								cachedAt: meta.cachedAt || ''
							});
						} catch {
							entries.push({
								key: child.basename,
								count: 0,
								cachedAt: new Date(child.stat.mtime).toISOString()
							});
						}
					}
				}
			}
		}

		return { files, totalSize, entries };
	}

	async clearAllCache(): Promise<void> {
		this.memoryCache.clear();
		
		const cacheFolder = this.app.vault.getAbstractFileByPath(`${this.settings.dataFolderPath}/cache`);
		
		if (cacheFolder instanceof TFolder) {
			for (const child of cacheFolder.children) {
				if (child instanceof TFile) {
					await this.app.vault.delete(child);
				}
			}
		}
		
		console.log('[Cache] All cache cleared');
	}

	async clearCacheEntry(cacheKey: string): Promise<void> {
		this.memoryCache.delete(cacheKey);
		
		const filePath = this.getCacheFilePath(cacheKey);
		const metaPath = this.getMetaFilePath(cacheKey);
		
		const file = this.app.vault.getAbstractFileByPath(filePath);
		const metaFile = this.app.vault.getAbstractFileByPath(metaPath);
		
		if (file instanceof TFile) {
			await this.app.vault.delete(file);
		}
		if (metaFile instanceof TFile) {
			await this.app.vault.delete(metaFile);
		}
		
		console.log(`[Cache] Entry cleared: ${cacheKey}`);
	}

	clearMemoryCache(): void {
		this.memoryCache.clear();
	}

	// ─────────────────────────────────────────────────────────────
	// CSV Conversion
	// ─────────────────────────────────────────────────────────────

	private convertToCsv(data: Record<string, unknown>[]): string {
		if (data.length === 0) return '';

		const headers = Object.keys(data[0]);
		const headerLine = headers.join(',');
		
		const dataLines = data.map(row => {
			return headers.map(header => {
				const value = row[header];
				return this.escapeCsvValue(value);
			}).join(',');
		});

		return [headerLine, ...dataLines].join('\n');
	}

	private parseCsv(content: string): Record<string, string>[] {
		const lines = content.split('\n').filter(line => line.trim());
		if (lines.length < 2) return [];

		const headers = this.parseCsvLine(lines[0]);
		const results: Record<string, string>[] = [];

		for (let i = 1; i < lines.length; i++) {
			const values = this.parseCsvLine(lines[i]);
			const obj: Record<string, string> = {};
			
			headers.forEach((header, index) => {
				obj[header] = values[index] || '';
			});
			
			results.push(obj);
		}

		return results;
	}

	private parseCsvLine(line: string): string[] {
		const values: string[] = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			
			if (char === '"') {
				if (inQuotes && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (char === ',' && !inQuotes) {
				values.push(current);
				current = '';
			} else {
				current += char;
			}
		}
		
		values.push(current);
		return values;
	}

	private escapeCsvValue(value: unknown): string {
		if (value === null || value === undefined) return '';
		
		const stringValue = String(value);
		
		if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}
		
		return stringValue;
	}

	// ─────────────────────────────────────────────────────────────
	// File System Helpers
	// ─────────────────────────────────────────────────────────────

	private async ensureFolder(path: string): Promise<TFolder> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		
		if (folder instanceof TFolder) {
			return folder;
		}
		
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
			await this.app.vault.modify(existingFile, content);
			return existingFile;
		}
		
		return await this.app.vault.create(path, content);
	}
}
