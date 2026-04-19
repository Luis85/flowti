import { describe, it, expect, vi } from 'vitest';
import type { App } from 'obsidian';
import { ObsidianWorkspaceAdapter } from '../../../src/infrastructure/obsidian/workspace-adapter.js';

describe('ObsidianWorkspaceAdapter', () => {
	function makeFakeApp(abstractFile: unknown, leafSpy?: ReturnType<typeof vi.fn>): App {
		return {
			vault: {
				getAbstractFileByPath: vi.fn(() => abstractFile),
			},
			workspace: {
				getLeaf: leafSpy ?? vi.fn(() => ({ openFile: vi.fn().mockResolvedValue(undefined) })),
			},
		} as unknown as App;
	}

	it('opens file in current leaf when mode=current', async () => {
		const openFileSpy = vi.fn().mockResolvedValue(undefined);
		const leafSpy = vi.fn(() => ({ openFile: openFileSpy }));
		const { TFile } = await import('obsidian');
		const tfile = Object.create(TFile.prototype);
		const app = makeFakeApp(tfile, leafSpy);
		const adapter = new ObsidianWorkspaceAdapter(app);
		const result = await adapter.openFile('Books/dune.md', 'current');
		expect(result.kind).toBe('ok');
		expect(leafSpy).toHaveBeenCalledWith(false);
		expect(openFileSpy).toHaveBeenCalledWith(tfile);
	});

	it('opens file in tab when mode=tab', async () => {
		const openFileSpy = vi.fn().mockResolvedValue(undefined);
		const leafSpy = vi.fn(() => ({ openFile: openFileSpy }));
		const { TFile } = await import('obsidian');
		const tfile = Object.create(TFile.prototype);
		const app = makeFakeApp(tfile, leafSpy);
		const adapter = new ObsidianWorkspaceAdapter(app);
		const result = await adapter.openFile('Books/dune.md', 'tab');
		expect(result.kind).toBe('ok');
		expect(leafSpy).toHaveBeenCalledWith('tab');
	});

	it('opens file in split when mode=split', async () => {
		const leafSpy = vi.fn(() => ({ openFile: vi.fn().mockResolvedValue(undefined) }));
		const { TFile } = await import('obsidian');
		const tfile = Object.create(TFile.prototype);
		const app = makeFakeApp(tfile, leafSpy);
		const adapter = new ObsidianWorkspaceAdapter(app);
		const result = await adapter.openFile('Books/dune.md', 'split');
		expect(result.kind).toBe('ok');
		expect(leafSpy).toHaveBeenCalledWith('split');
	});

	it('returns err not-found when path resolves to nothing', async () => {
		const app = makeFakeApp(null);
		const adapter = new ObsidianWorkspaceAdapter(app);
		const result = await adapter.openFile('Missing/file.md', 'tab');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error).toContain('not-found');
	});

	it('returns err not-found when path resolves to a TFolder (not TFile)', async () => {
		const { TFolder } = await import('obsidian');
		const folder = Object.create(TFolder.prototype);
		const app = makeFakeApp(folder);
		const adapter = new ObsidianWorkspaceAdapter(app);
		const result = await adapter.openFile('Books', 'tab');
		expect(result.kind).toBe('err');
	});

	it('returns err open-failed when workspace.openFile rejects', async () => {
		const openFileSpy = vi.fn().mockRejectedValue(new Error('boom'));
		const leafSpy = vi.fn(() => ({ openFile: openFileSpy }));
		const { TFile } = await import('obsidian');
		const tfile = Object.create(TFile.prototype);
		const app = makeFakeApp(tfile, leafSpy);
		const adapter = new ObsidianWorkspaceAdapter(app);
		const result = await adapter.openFile('Books/dune.md', 'tab');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error.startsWith('open-failed:')).toBe(true);
		expect(result.error).toContain('boom');
	});
});
