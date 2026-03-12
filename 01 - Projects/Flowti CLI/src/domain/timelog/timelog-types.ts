/**
 * timelog-types.ts — Type definitions for project time logging.
 */

export interface TimeLogEntry {
	date: string;
	person: string;
	hours: number;
	category: string;
	task: string;
	description: string;
}

export interface TimeLogSummary {
	totalHours: number;
	byPerson: Record<string, number>;
	byCategory: Record<string, number>;
	entries: TimeLogEntry[];
}
