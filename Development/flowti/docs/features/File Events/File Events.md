---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
type: Feature
---

# File Events

File Events are notification events emitted by the [[Development/flowti/docs/features/Event Bridge/Event Bridge|EventBridge]] whenever files, folders, or event-files change in the vault. They allow services to react to external changes without touching the Obsidian API.

## Overview

```
Obsidian Vault                   EventBridge                    Services
                                                                  │
  file created/modified/      ──► file.created / file.modified    │  eventBus.on("file.created", ...)
    deleted/renamed               file.deleted / file.renamed     │
                                                                  │
  folder created/deleted/     ──► folder.created / folder.deleted │  eventBus.on("folder.renamed", ...)
    renamed                       folder.renamed                  │
                                                                  │
  event-file changed          ──► event.file.triggered            │  eventBus.on("event.file.triggered", ...)
```

Three categories of events, all emitted through the [[Development/flowti/docs/features/Event System/Event System|EventBus]]:

| Category | Events | Trigger |
|----------|--------|---------|
| **File Notifications** | `file.created`, `file.modified`, `file.deleted`, `file.renamed` | Any `TFile` change in the vault |
| **Folder Notifications** | `folder.created`, `folder.deleted`, `folder.renamed` | Any `TFolder` change in the vault |
| **Event-File Notifications** | `event.file.triggered` | A file with frontmatter `type: "Event"` changes |

---

## File Notifications

Emitted whenever a `TFile` is created, modified, deleted, or renamed in the vault.

### Events

| Event | Payload | When |
|-------|---------|------|
| `file.created` | `{ path, source }` | New file added to vault |
| `file.modified` | `{ path, source }` | File content changed |
| `file.deleted` | `{ path, source }` | File removed from vault |
| `file.renamed` | `{ oldPath, newPath, source }` | File path changed |

### `FileChangeSource`

Every file and folder event carries a `source` field indicating the origin of the change:

```typescript
type FileChangeSource = "user" | "obsidian" | "sync" | "plugin" | "unknown";
```

Currently all vault notifications use `"obsidian"`. Future extensions can differentiate between user edits, sync operations, and plugin-initiated changes.

### Subscribing

```typescript
// React to new files
eventBus.on("file.created", (event) => {
  console.log(`New file: ${event.payload.path}`);
});

// React to modifications
eventBus.on("file.modified", (event) => {
  await reindex(event.payload.path);
});

// React to renames
eventBus.on("file.renamed", (event) => {
  const { oldPath, newPath } = event.payload;
  await updateReferences(oldPath, newPath);
});

// React to deletions
eventBus.on("file.deleted", (event) => {
  await removeFromIndex(event.payload.path);
});
```

---

## Folder Notifications

Emitted whenever a `TFolder` is created, deleted, or renamed. There is no `folder.modified` event because folders have no content.

### Events

| Event | Payload | When |
|-------|---------|------|
| `folder.created` | `{ path, source }` | New folder added to vault |
| `folder.deleted` | `{ path, source }` | Folder removed from vault |
| `folder.renamed` | `{ oldPath, newPath, source }` | Folder path changed |

### Subscribing

```typescript
eventBus.on("folder.created", (event) => {
  console.log(`New folder: ${event.payload.path}`);
});

eventBus.on("folder.renamed", (event) => {
  console.log(`${event.payload.oldPath} → ${event.payload.newPath}`);
});
```

---

## Event-File Notifications

Files with frontmatter `type: "Event"` act as event declarations. When such a file changes, the EventBridge emits `event.file.triggered` in addition to the standard file notification.

| Event | Payload | When |
|-------|---------|------|
| `event.file.triggered` | `{ eventName, path, action }` | File with `type: "Event"` is created, modified, deleted, or renamed |

See [[Development/flowti/docs/features/Event Files/Event Files|Event Files]] for the full feature documentation: frontmatter convention, name derivation, use cases, and vault organization.

---

## Event Flow

### File Created

```
User creates "Deploy.md" with type: Event, name: deploy.started
  │
  ├─ vault.on("create")
  │    ├─ emit file.created { path: "Deploy.md", source: "obsidian" }
  │    └─ pendingCreatedPaths.add("Deploy.md")
  │
  └─ metadataCache.on("changed")  (fires after cache is populated)
       ├─ emit metadata.changed { path, frontmatter }
       └─ pendingCreatedPaths has "Deploy.md" → delete, emit:
            event.file.triggered { eventName: "deploy.started", path, action: "created" }
```

### File Modified

```
User edits "Deploy.md"
  │
  └─ vault.on("modify")
       ├─ emit file.modified { path: "Deploy.md", source: "obsidian" }
       └─ cache has type: "Event" + name → emit:
            event.file.triggered { eventName: "deploy.started", path, action: "modified" }
```

### File Renamed

```
User renames "Deploy.md" → "Deploy V2.md"
  │
  └─ vault.on("rename")
       ├─ emit file.renamed { oldPath: "Deploy.md", newPath: "Deploy V2.md", source: "obsidian" }
       └─ cache has type: "Event" + name → emit:
            event.file.triggered { eventName: "deploy.started", path: "Deploy V2.md", action: "renamed" }
```

---

## Full Payload Reference

### File Events

```typescript
// file.created / file.modified / file.deleted
{
  path: string;
  source: FileChangeSource;
}

// file.renamed
{
  oldPath: string;
  newPath: string;
  source: FileChangeSource;
}
```

### Folder Events

```typescript
// folder.created / folder.deleted
{
  path: string;
  source: FileChangeSource;
}

// folder.renamed
{
  oldPath: string;
  newPath: string;
  source: FileChangeSource;
}
```

### Event-File Event

```typescript
// event.file.triggered
{
  eventName: string;   // from frontmatter `name` or derived from basename
  path: string;        // file path in vault
  action: "created" | "modified" | "deleted" | "renamed";
}
```

---

## Related

- [[Development/flowti/docs/features/Event Bridge/Event Bridge|EventBridge]] — translates Obsidian API events into these notifications
- [[Development/flowti/docs/features/Event System/Event System|Event System]] — the EventBus backbone
- [[Development/flowti/docs/features/File System/File System|FileSystemClient]] — request/response API for file operations (create, read, update, delete, move, rename)
