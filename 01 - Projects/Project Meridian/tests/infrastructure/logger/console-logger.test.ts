import { describe, it, expect, vi } from 'vitest';
import { createConsoleLogger } from '../../../src/infrastructure/logger/console-logger.js';

describe('ConsoleLogger', () => {
	it('logs info with structured format (system, message, tick)', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createConsoleLogger();

		logger.info('TestSystem', 'something happened', { tick: 5 });

		expect(spy).toHaveBeenCalledOnce();
		const output = spy.mock.calls[0]?.[0] as string;
		expect(output).toContain('TestSystem');
		expect(output).toContain('something happened');
		spy.mockRestore();
	});

	it('logs warn and error at correct levels', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logger = createConsoleLogger();

		logger.warn('Sys', 'warning');
		logger.error('Sys', 'error');

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(errorSpy).toHaveBeenCalledOnce();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it('respects log level filtering', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createConsoleLogger('warn');

		logger.debug('Sys', 'should be hidden');
		logger.info('Sys', 'should be hidden');

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
