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

	it('includes Error message in error output', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logger = createConsoleLogger();

		logger.error('Sys', 'failed', new Error('something broke'));

		const output = spy.mock.calls[0]?.[0] as string;
		expect(output).toContain('something broke');
		spy.mockRestore();
	});

	it('outputs debug messages when level is debug', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createConsoleLogger('debug');

		logger.debug('Sys', 'trace message');

		expect(spy).toHaveBeenCalledOnce();
		const output = spy.mock.calls[0]?.[0] as string;
		expect(output).toContain('trace message');
		spy.mockRestore();
	});

	it('serializes data as JSON in output', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createConsoleLogger();

		logger.info('Sys', 'with data', { key: 'value', count: 42 });

		const output = spy.mock.calls[0]?.[0] as string;
		expect(output).toContain('"key":"value"');
		expect(output).toContain('"count":42');
		spy.mockRestore();
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
