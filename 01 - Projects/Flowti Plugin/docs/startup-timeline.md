# Plugin startup timeline (what happens when)

This matches the events you see in **`[Flowti:EventTrace]`** (debug mode) and **`[StartupProfile]`** logs.

## 1. Synchronous shell — `plugin.loading` → `plugin.loaded`

- Infrastructure, service **registration**, command/view registration, `ServiceContainer.initializeAll()`.
- **Heavy domain work is not here** (no vault-backed service loads yet).
- **`perf.startup.shell`** — duration of this block (ms).
- **`plugin.loaded`** — includes optional **`shellDurationMs`** (same number).

## 2. Layout gap — `plugin.loaded` → `plugin.deferred.start`

- Flowti’s `onload()` has finished; Obsidian is still preparing the workspace.
- **No Flowti code runs** in this interval; the main thread may be busy with Obsidian or other plugins.
- **`perf.startup.layoutGap`** — wall-clock ms for this wait.
- **`plugin.deferred.start`** — fired when `workspace.onLayoutReady` runs; payload includes **`layoutGapMs`**.

## 3. Deferred startup — `onLayoutReady`

- **`loadDomainServices`**: storage reads, `perf.startup.service`, `perf.startup.segment`, etc.
- Hub registry, data-exchange wiring, **`eventBridge.registerVaultListeners()`**, start page.
- **`perf.startup.phase`** for each tracked phase; **`perf.startup.total`** / **`perf.startup.breakdown`** at the end.
- **`plugin.ready`** — interactive shell is wired; ingestion catch-up may continue in the background.

## 4. Agent World / Excalibur (only when you open the view)

- Opening the **Agent World** leaf runs sprite preload, `engine.start()`, provider, etc.
- **`perf.agentWorld.engine.start`** — total ms for that cold start (includes the Excalibur banner moment).
- Ongoing simulation: **`perf.agentWorld.sample`** / **`perf.agentWorld.slowFrame`**.

## Reading your trace

If you see **`plugin.loaded`** then a long pause before **`settings.loaded`** / **`perf.startup.service`**, that pause is mostly the **layout gap** (section 2), not un-instrumented Flowti work. Check **`perf.startup.layoutGap`** and the **`[StartupProfile]`** line that starts with **`shell=… layoutGap=…`**.
