/**
 * Central barrel for every EventMap augmentation.
 *
 * Modules augment the domain's `EventMap` interface via their
 * `*-events.ts` files.  TypeScript needs to see all augmentations to
 * type-check `bus.emit(channel, payload)` calls everywhere.
 *
 * Importing this file ONCE from main.ts pulls in every declaration, so
 * modules no longer need brittle `import './my-events.js'` side-effect
 * lines at the top of their code.
 */
import './domain/shared/core-events.js';
import './domain/shared/vault-events.js';
import './modules/event-inspector/event-inspector-events.js';
import './modules/file-detail/file-detail-events.js';
import './modules/health-monitor/health-monitor-events.js';
