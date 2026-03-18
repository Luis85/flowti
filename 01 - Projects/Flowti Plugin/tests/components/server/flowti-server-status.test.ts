// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from '../test-utils.js';

import '../../../src/components/server/flowti-server-status.js';

describe('flowti-server-status', () => {
	afterEach(() => cleanup());

	it('is defined as a custom element', () => {
		expect(customElements.get('flowti-server-status')).toBeDefined();
	});

	it('renders running state with green dot and label', async () => {
		const el = await fixture('flowti-server-status', {
			running: true,
			pid: 12345,
			port: 3000,
			uptime: 3600,
			url: 'http://localhost:3000',
		});
		const dot = shadowQuery(el, '.dot');
		expect(dot).not.toBeNull();
		expect(dot?.classList.contains('dot--running')).toBe(true);
		const text = shadowText(el);
		expect(text).toContain('Running');
	});

	it('renders stopped state with red dot and label', async () => {
		const el = await fixture('flowti-server-status', {
			running: false,
			pid: 0,
			port: 3000,
			uptime: 0,
			url: '',
		});
		const dot = shadowQuery(el, '.dot');
		expect(dot).not.toBeNull();
		expect(dot?.classList.contains('dot--stopped')).toBe(true);
		const text = shadowText(el);
		expect(text).toContain('Stopped');
	});

	it('shows PID, port, and formatted uptime when running', async () => {
		const el = await fixture('flowti-server-status', {
			running: true,
			pid: 9876,
			port: 4000,
			uptime: 8100, // 2h 15m
			url: 'http://localhost:4000',
		});
		const text = shadowText(el);
		expect(text).toContain('9876');
		expect(text).toContain('4000');
		expect(text).toContain('2h 15m');
	});

	it('formats uptime below 1 hour as minutes and seconds', async () => {
		const el = await fixture('flowti-server-status', {
			running: true,
			pid: 100,
			port: 3000,
			uptime: 185, // 3m 5s
			url: 'http://localhost:3000',
		});
		const text = shadowText(el);
		expect(text).toContain('3m 5s');
	});

	it('disables Start when running, enables Stop/Restart/Visit', async () => {
		const el = await fixture('flowti-server-status', {
			running: true,
			pid: 123,
			port: 3000,
			uptime: 60,
			url: 'http://localhost:3000',
		});
		const buttons = shadowQueryAll<HTMLButtonElement>(el, 'button');
		const startBtn = buttons.find((b) => b.textContent?.trim() === 'Start');
		const stopBtn = buttons.find((b) => b.textContent?.trim() === 'Stop');
		const restartBtn = buttons.find((b) => b.textContent?.trim() === 'Restart');
		const visitBtn = buttons.find((b) => b.textContent?.trim() === 'Visit');

		expect(startBtn?.disabled).toBe(true);
		expect(stopBtn?.disabled).toBe(false);
		expect(restartBtn?.disabled).toBe(false);
		expect(visitBtn?.disabled).toBe(false);
	});

	it('enables Start when stopped, disables Stop/Restart/Visit', async () => {
		const el = await fixture('flowti-server-status', {
			running: false,
			pid: 0,
			port: 3000,
			uptime: 0,
			url: '',
		});
		const buttons = shadowQueryAll<HTMLButtonElement>(el, 'button');
		const startBtn = buttons.find((b) => b.textContent?.trim() === 'Start');
		const stopBtn = buttons.find((b) => b.textContent?.trim() === 'Stop');
		const restartBtn = buttons.find((b) => b.textContent?.trim() === 'Restart');
		const visitBtn = buttons.find((b) => b.textContent?.trim() === 'Visit');

		expect(startBtn?.disabled).toBe(false);
		expect(stopBtn?.disabled).toBe(true);
		expect(restartBtn?.disabled).toBe(true);
		expect(visitBtn?.disabled).toBe(true);
	});

	it('dispatches server-start event', async () => {
		const el = await fixture('flowti-server-status', {
			running: false,
			pid: 0,
			port: 3000,
			uptime: 0,
			url: '',
		});
		const events: string[] = [];
		el.addEventListener('server-start', () => events.push('server-start'));

		const buttons = shadowQueryAll<HTMLButtonElement>(el, 'button');
		const startBtn = buttons.find((b) => b.textContent?.trim() === 'Start');
		startBtn?.click();

		expect(events).toContain('server-start');
	});

	it('dispatches server-stop, server-restart, and server-visit events', async () => {
		const el = await fixture('flowti-server-status', {
			running: true,
			pid: 123,
			port: 3000,
			uptime: 60,
			url: 'http://localhost:3000',
		});
		const events: string[] = [];
		el.addEventListener('server-stop', () => events.push('server-stop'));
		el.addEventListener('server-restart', () => events.push('server-restart'));
		el.addEventListener('server-visit', () => events.push('server-visit'));

		const buttons = shadowQueryAll<HTMLButtonElement>(el, 'button');
		const stopBtn = buttons.find((b) => b.textContent?.trim() === 'Stop');
		const restartBtn = buttons.find((b) => b.textContent?.trim() === 'Restart');
		const visitBtn = buttons.find((b) => b.textContent?.trim() === 'Visit');

		stopBtn?.click();
		restartBtn?.click();
		visitBtn?.click();

		expect(events).toContain('server-stop');
		expect(events).toContain('server-restart');
		expect(events).toContain('server-visit');
	});
});
