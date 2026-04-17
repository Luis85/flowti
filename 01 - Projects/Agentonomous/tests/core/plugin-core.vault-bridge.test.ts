import { describe, expect, it, vi } from 'vitest';
import { PluginCore } from '../../src/core/plugin-core.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import '../../src/all-events.js';
import { defineModule } from '../../src/domain/shared/module.js';
import type { EventEnvelope } from '../../src/domain/shared/event-bus.js';
import {
	fakeSettings, fakeCommands, fakeViews, fakeNotifications, fakeDialogs, fakeLogger,
	fakeTranslation, fakePlatform, fakeVault, fakeStorage, fakeScheduler, fakeAgents, fakeTasks,
} from '../__fakes__/fake-ports.js';

describe('PluginCore — vault event bridge', () => {
	it('emits vault changes from the vault port onto the bus', async () => {
		const bus = createEventBus();
		const vault = fakeVault();
		const core = new PluginCore(
			{
				settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(),
				logger: fakeLogger(), notifications: fakeNotifications(), dialogs: fakeDialogs(),
				eventBus: bus, t: fakeTranslation(), platform: fakePlatform(),
				vault, storage: fakeStorage(), scheduler: fakeScheduler(),
				agents: fakeAgents(), tasks: fakeTasks(),
			},
			[defineModule({ id: 'noop', name: 'Noop', async init() {}, destroy() {} })],
		);
		await core.init();

		const received: EventEnvelope<'vault'>[] = [];
		bus.on('vault', (env) => { received.push(env); });

		vault.emitChange({ kind: 'create', path: 'notes/a.md', at: 1 });
		vault.emitChange({ kind: 'modify', path: 'notes/a.md', at: 2 });

		expect(received).toHaveLength(2);
		expect(received[0]?.payload.kind).toBe('create');
		expect(received[1]?.payload.path).toBe('notes/a.md');

		await core.destroy();
	});

	it('unsubscribes from vault on destroy — no further bus emits', async () => {
		const bus = createEventBus();
		const vault = fakeVault();
		const core = new PluginCore(
			{
				settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(),
				logger: fakeLogger(), notifications: fakeNotifications(), dialogs: fakeDialogs(),
				eventBus: bus, t: fakeTranslation(), platform: fakePlatform(),
				vault, storage: fakeStorage(), scheduler: fakeScheduler(),
				agents: fakeAgents(), tasks: fakeTasks(),
			},
			[defineModule({ id: 'noop', name: 'Noop', async init() {}, destroy() {} })],
		);
		await core.init();
		await core.destroy();

		const listener = vi.fn();
		bus.on('vault', listener);
		vault.emitChange({ kind: 'delete', path: 'x.md', at: 1 });
		expect(listener).not.toHaveBeenCalled();
	});
});
