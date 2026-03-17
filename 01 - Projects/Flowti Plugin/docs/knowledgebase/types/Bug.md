---
type: DocumentType
name: Bug
abbreviation: ""
folder: inbox/
icon: bug
---

# Bug

A **Bug** is a defect report captured in the inbox. Bugs follow the same inbox lifecycle as ideas but use a dedicated type to distinguish defects from feature requests and improvements.

Bug reports live in the inbox folder. The filename is the bug title, written as a user-observed statement (e.g., "when running a pipeline, the progress bar does not update").

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Bug"` | yes | Document type discriminator |
| `stage` | enum | yes | `open` · `in-progress` · `fixed` · `archived` |
| `origin` | `"inbox"` | yes | Source identifier |
| `domain` | string | yes | Affected domain |
| `parent` | wikilink | no | Link to parent PRD |
| `description` | string | yes | One-sentence bug description |
| `tags` | string[] | no | Categorization tags |
| `priority` | enum | no | `0 - low` · `01 - medium` · `2 - high` |
| `rank` | number \| null | no | Granular ordering within priority tier |
| `related` | wikilink[] | no | Links to related bugs or ideas |
| `note` | string | no | Root cause and fix summary |
| `fixed_date` | date | no | Date the bug was fixed (YYYY-MM-DD) |
| `fixed_by` | wikilink | no | Cycle or increment that fixed the bug |
| `fixed_in` | string | no | Alternative field for fix reference |

## Section Template

Bug body content is typically minimal — most information lives in frontmatter. If additional context is needed:

1. Steps to Reproduce
2. Expected Behavior
3. Actual Behavior
4. Root Cause (filled when fixed)

## Lifecycle

```
open → in-progress → fixed → archived
```

- **open**: Bug reported, not yet triaged
- **in-progress**: Being investigated or fixed
- **fixed**: Root cause identified, fix deployed
- **archived**: Verified fixed, retained for traceability
