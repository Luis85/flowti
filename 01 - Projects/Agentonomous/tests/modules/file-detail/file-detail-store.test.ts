import { describe, expect, it, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFileDetailStore, setFileDetail, clearFileDetail } from '../../../src/modules/file-detail/file-detail-store.js';
import type { FileAnalysis } from '../../../src/modules/file-detail/handlers/types.js';

const sampleAnalysis: FileAnalysis = {
	fileName: 'test.json',
	extension: '.json',
	sizeBytes: 1024,
	summary: { Keys: 5, Format: 'JSON' },
};

describe('useFileDetailStore', () => {
	beforeEach(() => {
		clearFileDetail();
		setActivePinia(createPinia());
	});

	it('starts with null analysis and null error', () => {
		const store = useFileDetailStore();
		expect(store.analysis).toBeNull();
		expect(store.error).toBeNull();
	});

	it('setAnalysis sets analysis and clears error', () => {
		const store = useFileDetailStore();
		store.setError('some error');
		store.setAnalysis(sampleAnalysis);
		expect(store.analysis).toEqual(sampleAnalysis);
		expect(store.error).toBeNull();
	});

	it('setError sets error and clears analysis', () => {
		const store = useFileDetailStore();
		store.setAnalysis(sampleAnalysis);
		store.setError('read failed');
		expect(store.error).toBe('read failed');
		expect(store.analysis).toBeNull();
	});

	it('clear() resets both to null', () => {
		const store = useFileDetailStore();
		store.setAnalysis(sampleAnalysis);
		store.clear();
		expect(store.analysis).toBeNull();
		expect(store.error).toBeNull();
	});
});

describe('setFileDetail (pre-mount bridge)', () => {
	beforeEach(() => {
		clearFileDetail();
	});

	it('seeds store with analysis on creation', () => {
		setFileDetail(sampleAnalysis, null);
		setActivePinia(createPinia());
		const store = useFileDetailStore();
		expect(store.analysis).toEqual(sampleAnalysis);
		expect(store.error).toBeNull();
	});

	it('seeds store with error on creation', () => {
		setFileDetail(null, 'file not found');
		setActivePinia(createPinia());
		const store = useFileDetailStore();
		expect(store.analysis).toBeNull();
		expect(store.error).toBe('file not found');
	});

	it('clearFileDetail resets pending state', () => {
		setFileDetail(sampleAnalysis, null);
		clearFileDetail();
		setActivePinia(createPinia());
		const store = useFileDetailStore();
		expect(store.analysis).toBeNull();
	});
});
