import './health-monitor-events.js';
import { defineModule } from '../../domain/shared/module.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import enMessages from './locales/en.json' with { type: 'json' };

type ModuleState = {
	intervalId: ReturnType<typeof setInterval>;
	busUnsub: Unsubscribe;
	showHealthCallback: () => void;
};

let state: ModuleState | null = null;

export const HealthMonitorModule = defineModule({
	id: 'health-monitor',
	name: 'Health Monitor',
	dependsOn: ['core'],
	messages: { en: enMessages },

	commands: [
		{
			id: 'show-health',
			name: 'Show health status',
			callback: () => { state?.showHealthCallback(); },
		},
	],

	init(ports) {
		const showHealthCallback = (): void => {
			const summary = ports.t.t('health-monitor.notifications.healthCheck');
			ports.logger.info('health-monitor', summary);
			ports.notifications.show(summary);
		};

		const busUnsub = ports.eventBus.on('core', (env) => {
			if (env.payload.phase === 'ready' || env.payload.phase === 'destroyed') {
				// Track module lifecycle via core events (simplified for skeleton)
			}
		});

		const intervalId = setInterval(() => {
			ports.eventBus.emit('health-monitor', { action: 'health-check' });
		}, 60000);

		state = { intervalId, busUnsub, showHealthCallback };

		ports.logger.info('health-monitor', 'Health monitoring active');
		return Promise.resolve();
	},

	destroy() {
		if (state !== null) {
			clearInterval(state.intervalId);
			state.busUnsub();
			state = null;
		}
	},
});
