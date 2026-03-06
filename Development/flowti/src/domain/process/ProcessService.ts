/**
 * ProcessService — domain service for process definition management.
 *
 * Scans *.process.canvas files in the vault, parses them into ProcessDefinitions,
 * validates them, and tracks the process catalog.
 *
 * I/O is injected via callbacks (scanner function), keeping the service pure.
 */

import type { ProcessDefinition, ValidationResult } from "./types";
import { parseProcessCanvas } from "./canvasParser";
import type { CanvasJson } from "./canvasParser";
import { validateProcess } from "./validation";
import type { EventBus } from "../../infrastructure/events/EventBus";

/** Callback to scan the vault for process canvas files. */
export type ProcessScanner = () => Promise<Array<{ name: string; filePath: string; content: string }>>;

export class ProcessService {
	private processes: ProcessDefinition[] = [];
	private validationCache = new Map<string, ValidationResult>();
	private scanner: ProcessScanner | null = null;

	constructor(private readonly eventBus: EventBus) {}

	/** Set the scanner callback (deferred initialization from main.ts). */
	setScanner(scanner: ProcessScanner): void {
		this.scanner = scanner;
	}

	/** Scan the vault for process canvas files and parse them. */
	async scanProcesses(): Promise<ProcessDefinition[]> {
		if (!this.scanner) return [];

		const files = await this.scanner();
		const newProcesses: ProcessDefinition[] = [];

		for (const file of files) {
			try {
				const canvas: CanvasJson = JSON.parse(file.content);
				const def = parseProcessCanvas(canvas, file.name, file.filePath);
				if (def) newProcesses.push(def);
			} catch {
				// Malformed canvas — skip silently
			}
		}

		this.processes = newProcesses;
		this.validationCache.clear();

		for (const process of newProcesses) {
			void this.eventBus.emit("process.canvas.synced", {
				processName: process.name,
				filePath: process.filePath,
				nodeCount: process.nodes.length,
				edgeCount: process.edges.length,
			});
		}

		return this.processes;
	}

	/** Returns all scanned process definitions. */
	getProcesses(): ProcessDefinition[] {
		return this.processes;
	}

	/** Returns a process by name. */
	getProcess(name: string): ProcessDefinition | undefined {
		return this.processes.find((p) => p.name === name);
	}

	/** Validates a process definition, using cache when available. */
	validateProcess(def: ProcessDefinition): ValidationResult {
		const cached = this.validationCache.get(def.filePath);
		if (cached) return cached;

		const result = validateProcess(def);
		this.validationCache.set(def.filePath, result);
		return result;
	}

	/** Returns a summary of validation results: { errors, warnings, info, valid }. */
	getValidationSummary(def: ProcessDefinition): Pick<ValidationResult, "errorCount" | "warningCount" | "infoCount" | "valid"> {
		const result = this.validateProcess(def);
		return {
			errorCount: result.errorCount,
			warningCount: result.warningCount,
			infoCount: result.infoCount,
			valid: result.valid,
		};
	}
}
