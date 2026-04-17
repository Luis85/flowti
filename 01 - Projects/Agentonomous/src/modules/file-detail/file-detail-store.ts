import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { FileAnalysis } from './handlers/types.js';

export type FileDetailState = {
	readonly analysis: FileAnalysis | null;
	readonly error: string | null;
};

let pending: FileDetailState = { analysis: null, error: null };

export function setFileDetail(analysis: FileAnalysis | null, error: string | null): void {
	pending = { analysis, error };
}

export function clearFileDetail(): void {
	pending = { analysis: null, error: null };
}

export const useFileDetailStore = defineStore('file-detail', () => {
	const analysis = ref<FileAnalysis | null>(pending.analysis);
	const error = ref<string | null>(pending.error);

	function setAnalysis(value: FileAnalysis | null): void {
		analysis.value = value;
		error.value = null;
	}

	function setError(message: string): void {
		analysis.value = null;
		error.value = message;
	}

	function clear(): void {
		analysis.value = null;
		error.value = null;
	}

	return { analysis, error, setAnalysis, setError, clear };
});
