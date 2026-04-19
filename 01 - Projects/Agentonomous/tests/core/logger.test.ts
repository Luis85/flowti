import { describe, expect, it, vi } from 'vitest';
import { Logger } from '../../src/core/logger.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';

describe('Logger', () => {
	it('debug() emits on bus and calls console.debug when level is debug', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'debug');
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const busListener = vi.fn();
		bus.on('log', busListener);
		logger.debug('test-src', 'hello', { extra: true });
		expect(spy).toHaveBeenCalledWith('[agentonomous:test-src]', 'hello', { extra: true });
		expect(busListener).toHaveBeenCalledOnce();
		expect(busListener.mock.calls[0][0].payload.level).toBe('debug');
		spy.mockRestore();
	});

	it('debug() is suppressed when level is info', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'info');
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const busListener = vi.fn();
		bus.on('log', busListener);
		logger.debug('src', 'msg');
		expect(spy).not.toHaveBeenCalled();
		expect(busListener).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('error() always fires regardless of level', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'info');
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		logger.error('src', 'boom');
		expect(spy).toHaveBeenCalledWith('[agentonomous:src]', 'boom');
		spy.mockRestore();
	});

	it('setLevel() changes the active level', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'error');
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		logger.info('src', 'before');
		expect(spy).not.toHaveBeenCalled();
		logger.setLevel('info');
		logger.info('src', 'after');
		expect(spy).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('warn() emits on bus and calls console.warn when level is info or lower', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'info');
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const busListener = vi.fn();
		bus.on('log', busListener);
		logger.warn('src', 'degraded');
		expect(spy).toHaveBeenCalledWith('[agentonomous:src]', 'degraded');
		expect(busListener.mock.calls[0][0].payload.level).toBe('warn');
		spy.mockRestore();
	});

	it('warn() is suppressed when level is error', () => {
		const bus = createEventBus();
		const logger = new Logger(bus, 'error');
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		logger.warn('src', 'degraded');
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
