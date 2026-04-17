import { defineModule } from '../../domain/shared/module.js';
import enMessages from './locales/en.json' with { type: 'json' };

const HEALTH_TICK_ID = 'health-monitor:tick';
const HEALTH_TICK_INTERVAL_MS = 60_000;

type ModuleState = {
	showHealthCallback: () => void;
	cancelTick: () => void;
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
		if (state !== null) {
			void this.destroy();
		}

		const showHealthCallback = (): void => {
			const summary = ports.t.t('health-monitor.notifications.healthCheck');
			ports.logger.info('health-monitor', summary);
			ports.notifications.info(summary);
		};

		ports.scheduler.every(HEALTH_TICK_ID, HEALTH_TICK_INTERVAL_MS, () => {
			ports.eventBus.emit('health-monitor', { action: 'health-check' });
		});

		state = {
			showHealthCallback,
			cancelTick: () => { ports.scheduler.cancel(HEALTH_TICK_ID); },
		};

		ports.logger.info('health-monitor', 'Health monitoring active');
		return Promise.resolve();
	},

	destroy() {
		state?.cancelTick();
		state = null;
	},
});
