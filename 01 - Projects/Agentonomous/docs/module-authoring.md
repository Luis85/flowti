# Authoring a module

This is the walk-through for adding a new feature module to Agentonomous.
The framework is organized so that a module is a **bounded context** with
three possible faces: pure TS business logic, a Vue UI, and an Obsidian
view wrapper.  Not every module needs every face.

## Quick start

```bash
npm run scaffold:module -- my-feature
```

This creates:

```
src/modules/my-feature/
├── my-feature-module.ts     # Module definition
├── my-feature-settings.ts   # Settings type + defaults + validator
├── my-feature-events.ts     # EventMap augmentation
└── locales/en.json          # i18n messages
tests/modules/my-feature/
└── my-feature-module.test.ts
```

The scaffolder prints next steps.  Follow them to wire the module into
`main.ts` and `all-events.ts`.

## The mental model

```
Modules  →  declare intent (pure TS)
  │
  ├─ settings / commands / views: data only
  ├─ init(ports, settings): wire up
  └─ destroy(): tear down

Ports    →  how a module talks to the world
  eventBus · logger · notifications · dialogs
  settings · vault · storage · scheduler · t · platform
  agents · tasks · views

Presentation (src/ui/)   →  ALL Vue lives here
  panels/, pages/, stores/, layouts/, components/

Infrastructure          →  glues modules to Obsidian
  obsidian/views/         (ItemView wrappers)
  obsidian/*-adapter.ts   (concrete port implementations)
```

**A module never imports `obsidian` or Vue.**  It declares *what* it
wants (a view intent, a command, a settings schema) and PluginCore /
infrastructure does the rest.

## Contributing a setting UI

Add `settingsSchema` to your module:

```ts
settingsSchema: {
    title: 'My Feature',
    fields: [
        { kind: 'toggle',   key: 'enabled',    label: 'Enable my feature' },
        { kind: 'number',   key: 'maxItems',   label: 'Max items', min: 1, max: 1000 },
        { kind: 'dropdown', key: 'mode',       label: 'Mode', options: [
            { value: 'fast', label: 'Fast' },
            { value: 'safe', label: 'Safe' },
        ]},
    ],
},
```

The settings tab renders one section per module, wires reads from
`SettingsPort.loadSection(settingsKey)` and writes to
`SettingsPort.saveSection(settingsKey, updated)`, and invokes your
`onSettingsChange(next)` hook on every edit.  No DOM code required.

## Adding a view (sidebar panel or main pane)

Views are the one place you touch three layers.

### 1. Write the Vue panel in `src/ui/panels/`

```vue
<!-- src/ui/panels/MyFeaturePanel.vue -->
<script setup lang="ts">
import PanelLayout from '../layouts/PanelLayout.vue';
import { useMyFeatureStore } from '../stores/my-feature-store.js';

const store = useMyFeatureStore();
</script>

<template>
    <PanelLayout>
        <template #header>My Feature</template>
        <div>…</div>
    </PanelLayout>
</template>
```

### 2. Write the Pinia store in `src/ui/stores/`

```ts
// src/ui/stores/my-feature-store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMyFeatureStore = defineStore('my-feature', () => {
    const items = ref<string[]>([]);
    return { items };
});
```

### 3. Write the ItemView wrapper in `src/infrastructure/obsidian/views/`

```ts
// src/infrastructure/obsidian/views/my-feature-view.ts
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import type { MountedModuleApp } from '../../../ui/create-module-vue-app.js';
import type { ViewRegistration } from '../view-registry.js';

export const VIEW_TYPE_MY_FEATURE = 'agentonomous-my-feature';

export class MyFeatureView extends ItemView {
    private mounted: MountedModuleApp | null = null;
    constructor(leaf: WorkspaceLeaf, private readonly ctx: PluginContext) { super(leaf); }
    getViewType(): string { return VIEW_TYPE_MY_FEATURE; }
    getDisplayText(): string { return 'My feature'; }
    getIcon(): string { return 'star'; }
    async onOpen(): Promise<void> {
        const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
        const { default: MyFeaturePanel } = await import('../../../ui/panels/MyFeaturePanel.vue');
        this.mounted = createModuleVueApp(MyFeaturePanel, this.ctx, this.contentEl);
    }
    onClose(): Promise<void> { this.mounted?.unmount(); this.mounted = null; return Promise.resolve(); }
}

export const MY_FEATURE_VIEW_REGISTRATION: ViewRegistration = {
    type: VIEW_TYPE_MY_FEATURE,
    displayName: 'My feature',
    icon: 'star',
    defaultLocation: 'right',
    viewFactory: (leaf, ctx) => new MyFeatureView(leaf, ctx),
};
```

### 4. Declare the intent in your module

```ts
// my-feature-module.ts
import { VIEW_TYPE_MY_FEATURE } from '../../infrastructure/obsidian/views/my-feature-view.js';

export const MyFeatureModule = defineModule({
    // …
    views: [{
        type: VIEW_TYPE_MY_FEATURE,
        displayName: 'My feature',
        icon: 'star',
        defaultLocation: 'right',
    }],
});
```

### 5. Register the factory in the aggregator

```ts
// src/infrastructure/obsidian/views/index.ts
import { MY_FEATURE_VIEW_REGISTRATION } from './my-feature-view.js';

export const VIEW_REGISTRATIONS: readonly ViewRegistration[] = [
    HOMEPAGE_VIEW_REGISTRATION,
    EVENT_INSPECTOR_VIEW_REGISTRATION,
    FILE_DETAIL_VIEW_REGISTRATION,
    MY_FEATURE_VIEW_REGISTRATION,  // ← add
];
```

That's it.  `main.ts` filters `VIEW_REGISTRATIONS` to the intents your
module actually declared, so forgetting to register the factory will
log a warning at startup.

## Using ports inside a module

```ts
init(ports, settings) {
    // 1. Subscribe to events
    const unsub = ports.eventBus.on('vault', (env) => {
        ports.logger.info('my-feature', `Vault change: ${env.payload.kind} ${env.payload.path}`);
    });

    // 2. Persist structured data
    void ports.storage.saveJson('my-feature', 'last-run', { at: Date.now() });

    // 3. Schedule work — never use raw setInterval
    ports.scheduler.every('my-feature:sync', 60_000, () => { /* … */ });

    // 4. Ask the user
    void ports.dialogs.confirm({
        title: 'Confirm',
        message: 'Really delete everything?',
        destructive: true,
    }).then((yes) => { if (yes) ports.notifications.success('Deleted'); });

    // 5. Read/write files via the vault port
    const result = await ports.vault.read('notes/plan.md');
    if (result.kind === 'err') ports.notifications.warn(result.error);
}
```

## The module singleton pattern

Modules that hold runtime state (the bus subscription, a buffer, a
scheduled tick) use a module-scope `let state: ModuleState | null = null`
pattern:

```ts
type ModuleState = { busUnsub: Unsubscribe; buffer: Envelope[] };
let state: ModuleState | null = null;

export const MyModule = defineModule({
    init(ports) {
        if (state !== null) void this.destroy();  // self-guard
        const busUnsub = ports.eventBus.onAny((env) => { state?.buffer.push(env); });
        state = { busUnsub, buffer: [] };
    },
    destroy() {
        state?.busUnsub();
        state = null;
    },
});
```

This is intentional — there is exactly one instance per module per
plugin load.  Don't refactor it into per-instance state unless you're
reworking the whole `Module` contract.

## Testing a module

Every module has `tests/modules/<name>/<name>-module.test.ts`.  Use
`fakeModulePorts()` from `tests/__fakes__/fake-ports.ts`:

```ts
import { fakeModulePorts, fakeScheduler } from '../../__fakes__/fake-ports.js';

it('scheduled tick emits on the bus', async () => {
    const scheduler = fakeScheduler();
    const bus = createEventBus();
    const ports = fakeModulePorts({ scheduler, eventBus: bus });

    await MyModule.init(ports, MY_DEFAULTS);
    await scheduler.fire('my-module:tick');

    // assert what changed
});
```

The fake scheduler has a `.fire(id)` method — no `vi.useFakeTimers` needed.

## Error handling

Use `tryAsync` / `trySync` for anything that can throw:

```ts
import { tryAsync } from '../../domain/shared/try-async.js';

const result = await tryAsync(
    () => expensiveCall(),
    { code: 'MY_FEATURE_FAILED', source: 'my-feature', severity: 'user' },
);
if (isErr(result)) {
    ports.eventBus.emit('error', result.error);  // ErrorHandler surfaces it
    return;
}
```

## Checklist before shipping a module

- [ ] `npm test` passes (lint + typecheck + unit tests)
- [ ] `npm run build` produces a clean `dist/main.js`
- [ ] Module registered in `src/main.ts`
- [ ] Events augmentation registered in `src/all-events.ts`
- [ ] `destroy()` unsubscribes every listener and cancels every scheduled task
- [ ] If the module has a view: ViewRegistration added to `src/infrastructure/obsidian/views/index.ts`
- [ ] `settingsSchema` declared if the module has user-visible settings
- [ ] Locales added to `locales/en.json`
