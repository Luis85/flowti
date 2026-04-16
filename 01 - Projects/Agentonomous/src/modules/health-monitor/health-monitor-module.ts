import './health-monitor-events.js';
import { defineModule } from '../../domain/shared/module.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import enMessages from './locales/en.json' with { type: 'json' };

let intervalId: ReturnType<typeof setInterval> | null = null;
let busUnsub: Unsubscribe | null = null;

/**
 * Closed over during init() so the statically-declared command callback can
 * reach the ports that are only available at init time.
 */
let showHealthCallback: (() => void) | null = null;

export const HealthMonitorModule = defineModule({
	id: 'health-monitor',
	name: 'Health Monitor',
	dependsOn: ['core'],
	messages: { en: enMessages },

	commands: [
		{
			id: 'show-health',
			name: 'Show health status',
			callback: () => { showHealthCallback?.(); },
		},
	],

	init(ports) {
		showHealthCallback = () => {
			const summary = 'Agentonomous: health check — see console for details';
			ports.logger.info('health-monitor', summary);
			ports.notifications.show(summary);
		};

		busUnsub = ports.eventBus.on('core', (env) => {
			if (env.payload.phase === 'ready' || env.payload.phase === 'destroyed') {
				// Track module lifecycle via core events (simplified for skeleton)
			}
		});

		intervalId = setInterval(() => {
			ports.eventBus.emit('health-monitor', { action: 'health-check' });
		}, 60000);

		ports.logger.info('health-monitor', 'Health monitoring active');
		return Promise.resolve();
	},

	destroy() {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
		busUnsub?.();
		busUnsub = null;
		showHealthCallback = null;
	},
});
