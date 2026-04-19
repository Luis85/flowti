import { describe, it, expect } from 'vitest';
import { decideTabAction } from '../../../../src/infrastructure/obsidian/views/file-detail-tab-policy.js';

describe('decideTabAction', () => {
	it('accepts when the view has no current file (fresh leaf)', () => {
		const decision = decideTabAction({
			currentPath: undefined,
			newPath: 'data/first.json',
			otherLeafPaths: [],
		});
		expect(decision).toEqual({ kind: 'accept' });
	});

	it('accepts when the incoming state carries no file', () => {
		const decision = decideTabAction({
			currentPath: 'data/first.json',
			newPath: null,
			otherLeafPaths: [],
		});
		expect(decision).toEqual({ kind: 'accept' });
	});

	it('accepts when the incoming file matches the file already shown', () => {
		const decision = decideTabAction({
			currentPath: 'data/first.json',
			newPath: 'data/first.json',
			otherLeafPaths: [],
		});
		expect(decision).toEqual({ kind: 'accept' });
	});

	it('activates an existing file-detail leaf that already shows the requested file', () => {
		const decision = decideTabAction({
			currentPath: 'data/first.json',
			newPath: 'data/other.csv',
			otherLeafPaths: ['notes/ignore.json', 'data/other.csv'],
		});
		expect(decision).toEqual({ kind: 'activate', leafIndex: 1 });
	});

	it('opens a new tab when the file is different and no other leaf has it', () => {
		const decision = decideTabAction({
			currentPath: 'data/first.json',
			newPath: 'data/other.csv',
			otherLeafPaths: ['notes/ignore.json'],
		});
		expect(decision).toEqual({ kind: 'newTab', path: 'data/other.csv' });
	});

	it('skips null entries in otherLeafPaths when checking for duplicates', () => {
		const decision = decideTabAction({
			currentPath: 'data/first.json',
			newPath: 'data/other.csv',
			otherLeafPaths: [null, null],
		});
		expect(decision).toEqual({ kind: 'newTab', path: 'data/other.csv' });
	});
});
