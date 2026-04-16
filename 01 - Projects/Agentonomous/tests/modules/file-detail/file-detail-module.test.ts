import { describe, expect, it } from 'vitest';
import { fakeModulePorts } from '../../__fakes__/fake-ports.js';

describe('FileDetailModule', () => {
	it('init logs and resolves when enabled', async () => {
		const { FileDetailModule } = await import('../../../src/modules/file-detail/file-detail-module.js');
		const ports = fakeModulePorts();
		await FileDetailModule.init(ports, { enabled: true });
		expect(ports.logger.info).toHaveBeenCalledWith('file-detail', 'File Detail module initialized');
	});

	it('init logs disabled message when settings.enabled is false', async () => {
		const { FileDetailModule } = await import('../../../src/modules/file-detail/file-detail-module.js');
		const ports = fakeModulePorts();
		await FileDetailModule.init(ports, { enabled: false });
		expect(ports.logger.info).toHaveBeenCalledWith('file-detail', 'File Detail module disabled by settings');
	});

	it('destroy runs without error', async () => {
		const { FileDetailModule } = await import('../../../src/modules/file-detail/file-detail-module.js');
		expect(() => FileDetailModule.destroy()).not.toThrow();
	});

	it('declares csv and json extensions', async () => {
		const { FileDetailModule, VIEW_TYPE_FILE_DETAIL } = await import('../../../src/modules/file-detail/file-detail-module.js');
		expect(FileDetailModule.extensions).toHaveLength(2);
		expect(FileDetailModule.extensions?.[0]).toEqual({ ext: 'csv', viewType: VIEW_TYPE_FILE_DETAIL });
		expect(FileDetailModule.extensions?.[1]).toEqual({ ext: 'json', viewType: VIEW_TYPE_FILE_DETAIL });
	});

	it('handler registry resolves csv handler', async () => {
		const { getHandler } = await import('../../../src/modules/file-detail/handlers/handler-registry.js');
		const handler = getHandler('csv');
		expect(handler).toBeDefined();
		expect(handler?.extension).toBe('csv');
	});

	it('handler registry resolves json handler', async () => {
		const { getHandler } = await import('../../../src/modules/file-detail/handlers/handler-registry.js');
		const handler = getHandler('json');
		expect(handler).toBeDefined();
		expect(handler?.extension).toBe('json');
	});

	it('handler registry returns undefined for unknown extension', async () => {
		const { getHandler } = await import('../../../src/modules/file-detail/handlers/handler-registry.js');
		expect(getHandler('pdf')).toBeUndefined();
	});
});
