import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { FileAnalysis } from '../../modules/file-detail/handlers/types.js';

export const useFileDetailStore = defineStore('file-detail', () => {
	const analysis = ref<FileAnalysis | null>(null);
	const error = ref<string | null>(null);

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
