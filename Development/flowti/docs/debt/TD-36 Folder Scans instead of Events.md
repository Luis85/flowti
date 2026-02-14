---
status: open
severity: low
effort:
layer: infrastructure
category: duplication
description:
---
Relates to [[TD-32 normalizeDocFrontmatter writes during render]]
### Current Design

Make scans read-only. Collect non-conforming files during scan. Normalize once per session (deduplicated) after scan completes. This eliminates writes during render while preserving auto-normalization behavior.

## To consider

Please review if a centralized solution by using the EventBus would be better suited.