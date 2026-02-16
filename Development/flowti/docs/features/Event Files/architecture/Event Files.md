---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
type: Feature
---

# Event Files

Event Files turn Obsidian notes into **event declarations**. Any file with frontmatter `type: "Event"` becomes a trigger — when it is created, modified, deleted, or renamed, the system emits an `event.file.triggered` event on the [[Development/flowti/docs/features/Event System/Event System|EventBus]]. This enables file-based automations and notifications: external tools, scripts, or sync services can drop a file into the vault to trigger workflows inside Flowti.

## Why Event Files?

Obsidian vaults are folders on disk. Any process — a CI/CD pipeline, a shell script, a cloud sync, another Obsidian plugin — can create or modify files in the vault. Event Files exploit this:

```
External World                 Vault (Disk)                  Flowti IBDE
                                                               │
CI/CD pipeline writes   ──►  Deploy Started.md appears   ──►  event.file.triggered
  a markdown file              in vault folder                 { eventName: "deploy.started",
                                                                 action: "created" }
                                                               │
                                                               ▼
                                                            Services react
                                                            (notifications, automations, UI updates)
```

No API calls, no webhooks, no plugins to install on the external side — just write a file.

---

## Frontmatter Convention

An Event File requires exactly one frontmatter property:

```yaml
---
type: Event
---
```

### Event Name

The event name can be set explicitly or derived automatically:

| Property | Required | Description |
|----------|----------|-------------|
| `type` | Yes | Must be `"Event"` (uppercase E) |
| `name` | No | Explicit event name (e.g. `deploy.started`) |

**If `name` is omitted**, the event name is derived from the file's title: lowercase, spaces replaced with dots.

| File | `name` | Resulting `eventName` |
|------|--------|----------------------|
| `Deploy Started.md` | `deploy.started` | `deploy.started` |
| `Deploy Started.md` | _(omitted)_ | `deploy.started` |
| `Build Failed.md` | _(omitted)_ | `build.failed` |
| `Config Updated.md` | `app.config.changed` | `app.config.changed` |

### Minimal Event File

```markdown
---
type: Event
---
```

The file name *is* the event name. `Build Completed.md` → `build.completed`.

### Event File with Explicit Name

```markdown
---
type: Event
name: ci.deploy.production
---

Optional body — can contain context, logs, metadata for human readers.
```

---

## How It Works

When an Event File changes in the vault, the [[Development/flowti/docs/features/Event Bridge/Event Bridge|EventBridge]] emits `event.file.triggered`:

```typescript
// Payload of event.file.triggered
{
  eventName: string;   // "deploy.started" — from `name` or derived from title
  path: string;        // "Events/Deploy Started.md"
  action: "created" | "modified" | "deleted" | "renamed";
}
```

### Detection per Action

| Vault Action | How It's Detected |
|-------------|-------------------|
| **created** | Deferred: `vault.on("create")` records the path → `metadataCache.on("changed")` picks it up once frontmatter is parsed |
| **modified** | Direct: `vault.on("modify")` reads the metadata cache immediately |
| **renamed** | Direct: `vault.on("rename")` reads the metadata cache immediately |
| **deleted** | Best-effort: `vault.on("delete")` reads the cache, but it may already be cleared |

The deferred create detection ensures that even files copied or synced into the vault (where frontmatter isn't available until the cache parses it) are reliably detected.

---

## Use Cases

### External Automation Triggers

A CI/CD pipeline, cron job, or script creates an Event File in the vault to notify Flowti:

```bash
# From a CI/CD pipeline or script
cat > "/path/to/vault/Events/Deploy Started.md" << 'EOF'
---
type: Event
name: deploy.started
---
Deploy triggered by commit abc123
EOF
```

Flowti picks up the new file and emits `event.file.triggered` with `eventName: "deploy.started"`.

### Notification System

A service listens for Event Files and shows notifications:

```typescript
eventBus.on("event.file.triggered", (event) => {
  const { eventName, path, action } = event.payload;

  if (action === "created") {
    new Notice(`Event: ${eventName}`);
    logger.info(`Event file created: ${path}`);
  }
});
```

### Workflow Orchestration

Chain multiple Event Files into a workflow:

```typescript
// Listen for deploy events
eventBus.on("event.file.triggered", async (event) => {
  if (event.payload.eventName === "deploy.started") {
    await runPreDeployChecks();
  }

  if (event.payload.eventName === "deploy.completed") {
    await notifyTeam();
    await updateDashboard();
  }
});
```

### Cloud Sync Integration

Services like Obsidian Sync, iCloud, or Syncthing can sync Event Files between devices. Creating an Event File on one device triggers the event on all synced devices.

### Data-Driven Event Catalog

Since Event Files are regular notes, they can be queried, linked, and organized like any other vault content:

```
Events/
├── Deploy Started.md        → deploy.started
├── Deploy Completed.md      → deploy.completed
├── Build Failed.md          → build.failed
├── Config Updated.md        → config.updated
└── Backup Completed.md      → backup.completed
```

Use Obsidian's search, tags, or Dataview to list all Event Files:

```dataview
TABLE name as "Event Name", file.ctime as "Created"
FROM "Events"
WHERE type = "Event"
```

---

## Subscribing to Event Files

### Listen to All Event Files

```typescript
eventBus.on("event.file.triggered", (event) => {
  const { eventName, path, action } = event.payload;
  console.log(`[${action}] ${eventName} at ${path}`);
});
```

### Filter by Event Name

```typescript
eventBus.on("event.file.triggered", (event) => {
  if (event.payload.eventName === "deploy.started") {
    handleDeployStarted(event.payload.path);
  }
});
```

### Filter by Action

```typescript
eventBus.on("event.file.triggered", (event) => {
  if (event.payload.action === "created") {
    // Only react to new event files, not modifications
    processNewEvent(event.payload);
  }
});
```

---

## Vault Organization

Event Files can live anywhere in the vault. A recommended structure:

```
Events/                          # Dedicated folder for event files
├── CI/
│   ├── Build Started.md
│   ├── Build Completed.md
│   └── Build Failed.md
├── Deploy/
│   ├── Deploy Started.md
│   └── Deploy Completed.md
└── System/
    ├── Backup Completed.md
    └── Config Updated.md
```

### Conventions

- Use a dedicated `Events/` folder to keep event files separate from regular notes
- Name files with the event meaning — the filename becomes the event name if `name` is omitted
- Use subfolders to group related events (CI, Deploy, System)
- Add context in the file body for human readers — it doesn't affect the event

---

## Limitations

| Limitation | Reason |
|-----------|--------|
| **Delete may not trigger** | Obsidian may clear the metadata cache before the delete listener runs |
| **No payload beyond name/path/action** | The event carries the frontmatter event name and file path, not arbitrary data from the file body |
| **Single event type** | All Event Files emit `event.file.triggered` — services filter by `eventName` |
| **Frontmatter must be parsed** | The file must be valid Markdown with YAML frontmatter; binary files or malformed frontmatter won't trigger |

---

## Related

- [[Development/flowti/docs/features/Event Bridge/Event Bridge|EventBridge]] — the component that detects Event Files and emits `event.file.triggered`
- [[Development/flowti/docs/features/Event System/Event System|Event System]] — the EventBus backbone
- [[Development/flowti/docs/features/File Events/File Events|File Events]] — all file/folder/event-file notification events
