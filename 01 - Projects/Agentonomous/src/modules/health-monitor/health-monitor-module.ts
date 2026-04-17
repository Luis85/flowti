import { defineModule } from '../../domain/shared/module.js';
import enMessages from './locales/en.json' with { type: 'json' };

type ModuleState = {
	intervalId: ReturnType<typeof setInterval>;
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
		// Guard: if already initialized, destroy first to prevent leaks
		if (state !== null) {
			this.destroy();
		}

		const showHealthCallback = (): void => {
			const summary = ports.t.t('health-monitor.notifications.healthCheck');
			ports.logger.info('health-monitor', summary);
			ports.notifications.show(summary);
		};

		const intervalId = setInterval(() => {
			ports.eventBus.emit('health-monitor', { action: 'health-check' });
		}, 60000);

		state = { intervalId, showHealthCallback };

		ports.logger.info('health-monitor', 'Health monitoring active');
		return Promise.resolve();
	},

	destroy() {
		if (state !== null) {
			clearInterval(state.intervalId);
			state = null;
		}
	},
});
