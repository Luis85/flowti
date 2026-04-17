import { Notice } from 'obsidian';
import type { NotificationPort, NotificationOptions } from '../../domain/shared/notification-port.js';

const DEFAULT_DURATION: Record<'info' | 'success' | 'warn' | 'error', number> = {
	info: 4000,
	success: 3000,
	warn: 8000,
	error: 10000,
};

const PREFIX: Record<'info' | 'success' | 'warn' | 'error', string> = {
	info: '',
	success: '✓ ',
	warn: '⚠ ',
	error: '✕ ',
};

export class ObsidianNotificationAdapter implements NotificationPort {
	info(message: string, opts?: NotificationOptions): void { this.emit('info', message, opts); }
	success(message: string, opts?: NotificationOptions): void { this.emit('success', message, opts); }
	warn(message: string, opts?: NotificationOptions): void { this.emit('warn', message, opts); }
	error(message: string, opts?: NotificationOptions): void { this.emit('error', message, opts); }
	show(message: string, opts?: NotificationOptions): void { this.info(message, opts); }

	private emit(severity: 'info' | 'success' | 'warn' | 'error', message: string, opts?: NotificationOptions): void {
		const duration = opts?.durationMs ?? DEFAULT_DURATION[severity];
		new Notice(`${PREFIX[severity]}${message}`, duration);
	}
}
