import { Notice } from 'obsidian';
import type { NotificationPort } from '../../domain/shared/notification-port.js';

export class ObsidianNotificationAdapter implements NotificationPort {
	show(message: string): void {
		new Notice(message);
	}
}
