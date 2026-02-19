---
type: DocumentType
name: Event
abbreviation: ""
folder: "(anywhere in vault)"
icon: zap
---

# Event

An **Event** file is a user-defined custom event declaration. Any Markdown file in the vault with `type: Event` in its frontmatter is treated as an event file by the plugin. When such a file changes, EventBridge emits `event.file.triggered`.

Event files are distinct from [[EventDoc]] files (which are plugin-managed documentation). Event files are the mechanism for users to define and trigger custom events from within their vault.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Event"` | yes | Document type discriminator (case-sensitive — must be `Event`, not `event`) |
| `name` | string | no | Event name (if absent, derived from filename: lowercase, spaces → dots) |

## Behavior

- **Discovery**: EventBridge detects Event files via `metadataCache` when files are created, modified, renamed, or deleted
- **Event emission**: Each change emits `event.file.triggered` with the event name and file path
- **Name resolution**: If `name` frontmatter is present, it's used directly; otherwise, the basename is converted (e.g., `User Created.md` → `user.created`)
- **Case sensitivity**: The `type` field must be exactly `Event` (capitalized). Lowercase `event` is not recognized

## Related Types

- [[EventDoc]] — Plugin-managed event documentation (different purpose)
- [[CategoryDoc]] — Categories that events belong to
