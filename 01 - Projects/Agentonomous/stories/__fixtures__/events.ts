import type { EventEnvelope } from '../../src/domain/shared/event-bus.js';

// Storybook-only EventMap channels.  Declaring them here means the
// fixture below compiles without `as never` casts — the Inspector
// doesn't care about payload shape, but TypeScript does.
declare module '../../src/domain/shared/event-bus.js' {
	interface EventMap {
		'settings:changed': { readonly key: string };
		'module:ready': { readonly id: string };
		'lifecycle:started': Record<string, never>;
	}
}

export const sampleEvents: readonly EventEnvelope[] = [
	{
		channel: 'settings:changed',
		payload: { key: 'theme' },
		traceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		eventId: 'evt-001',
		timestamp: Date.now() - 5000,
	},
	{
		channel: 'module:ready',
		payload: { id: 'core' },
		traceId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
		eventId: 'evt-002',
		timestamp: Date.now() - 3000,
	},
	{
		channel: 'module:ready',
		payload: { id: 'event-inspector' },
		traceId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
		eventId: 'evt-003',
		parentId: 'evt-002',
		timestamp: Date.now() - 2800,
	},
	{
		channel: 'lifecycle:started',
		payload: {},
		traceId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
		eventId: 'evt-004',
		timestamp: Date.now() - 1000,
	},
	{
		channel: 'settings:changed',
		payload: { key: 'locale' },
		traceId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
		eventId: 'evt-005',
		timestamp: Date.now() - 500,
	},
];
